/* Southland — оркестратор приложения.
 * SL.app: состояние, загрузка фото (файл / drag&drop / демо), оверлей анализа,
 * карусель стилей с ленивыми превью, рендер «до/после», интенты чата,
 * скачивание и шаринг результата. */
(function () {
  'use strict';
  window.SL = window.SL || {};

  var state = {
    src: null,        // canvas подготовленного фото
    styleId: 'artdeco',
    refinements: [],
    seed: 1,
    _result: null,    // последний отрендеренный canvas «после»
    _gen: 0           // поколение очереди превью — для отмены при новом фото
  };

  var inited = false;
  var greeted = false;
  var overlayTimers = [];
  var upErrTimer = 0;
  var dotEls = [];

  var ADJ_LABEL = { warmth: 'Тепло света', brightness: 'Яркость', contrast: 'Контраст', saturation: 'Насыщенность' };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- обёртки над смежными модулями: их сбой не должен ронять приложение ---------- */

  function refLabels() {
    return state.refinements.map(function (r) { return r.label; });
  }

  function suggest(items, color) {
    try {
      return SL.catalog.suggest({
        style: SL.styleById(state.styleId),
        items: items,
        color: color,
        limit: 3
      }) || [];
    } catch (e) { console.warn('[Southland] catalog.suggest:', e); return []; }
  }

  /* Ответ бота: текст-шаблон берёт chat.replyFor, chips/товары добавляет app */
  function botReply(action, extra) {
    extra = extra || {};
    var reply = null;
    try { reply = SL.chat.replyFor(action, state); } catch (e) { console.warn('[Southland] chat.replyFor:', e); }
    reply = reply || {};
    var opts = {};
    var chips = extra.chips || reply.chips;
    if (chips && chips.length) opts.chips = chips;
    if (extra.products && extra.products.length) opts.products = extra.products;
    try { SL.chat.botSay(reply.html || 'Готово — взгляните на результат выше.', opts); }
    catch (e) { console.warn('[Southland] chat.botSay:', e); }
  }

  /* ---------- загрузка фото ---------- */

  /* Ошибка загрузки: подменяем текст .up-note на 4 секунды */
  function upError(msg) {
    var note = document.querySelector('.up-note');
    if (!note) return;
    if (note.dataset.orig === undefined) note.dataset.orig = note.textContent;
    note.textContent = msg;
    note.classList.add('up-error', 'on');
    clearTimeout(upErrTimer);
    upErrTimer = setTimeout(function () {
      note.textContent = note.dataset.orig;
      note.classList.remove('up-error', 'on');
    }, 4000);
  }

  function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      upError('Это не похоже на изображение — нужен JPG, PNG или WEBP');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      upError('Файл больше 20 МБ — выберите фото полегче');
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () { handlePhoto(img); };
      img.onerror = function () { upError('Не удалось прочитать изображение — попробуйте другой файл'); };
      img.src = rd.result;
    };
    rd.onerror = function () { upError('Не удалось прочитать файл — попробуйте ещё раз'); };
    rd.readAsDataURL(file);
  }

  /* Приём фото (Image или canvas демо-комнаты) — общая точка входа */
  function handlePhoto(source) {
    var prepared;
    try { prepared = SL.engine.prepare(source); }
    catch (e) { console.warn('[Southland] engine.prepare:', e); return; }
    if (!prepared) return;
    state.src = prepared;
    state.refinements = [];
    state.seed = 1;
    state._result = null;
    document.body.dataset.stage = 'studio';
    runOverlay();
  }

  /* ---------- оверлей анализа ---------- */

  function runOverlay() {
    var overlay = $('overlay'), text = $('overlayText'), bar = $('overlayBar');
    overlayTimers.forEach(clearTimeout);
    overlayTimers = [];
    var T = function (fn, ms) { overlayTimers.push(setTimeout(fn, ms)); };
    var stage = function (msg, p) { text.textContent = msg; bar.style.transform = 'scaleX(' + p + ')'; };

    bar.style.transform = 'scaleX(0)';
    overlay.classList.add('on');
    stage('Определяю планировку…', 0.16);
    T(function () { stage('Читаю свет и материалы…', 0.52); }, 600);
    T(function () { stage('Примеряю стили…', 0.86); }, 1200);
    T(function () { bar.style.transform = 'scaleX(1)'; }, 2050);
    T(buildStudio, 120); // тяжёлая работа — пока оверлей на экране
    T(finishOverlay, 2500);
  }

  /* Карусель + первый рендер выбранного стиля */
  function buildStudio() {
    try {
      var style = SL.styleById(state.styleId);
      buildCarousel();
      state._result = SL.engine.render(state.src, style, state.refinements, state.seed);
      SL.compare.setImages(state.src, state._result);
      SL.compare.setPosition(55);
      updateCaption(style);
      markActive(style.id);
      queueThumbs();
    } catch (e) { console.warn('[Southland] подготовка студии:', e); }
  }

  function finishOverlay() {
    $('overlay').classList.remove('on');
    $('overlayBar').style.transform = 'scaleX(0)'; // оверлей скрыт — вернём бар без анимации
    var styles = $('styles');
    if (styles) styles.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!greeted) {
      greeted = true;
      try { SL.chat.greet(SL.styleById(state.styleId).name); }
      catch (e) { console.warn('[Southland] chat.greet:', e); }
    } else {
      try { SL.chat.botSay('Новое фото — начнём сначала: правки сброшены, стили примерены заново. Выбирайте настроение.'); }
      catch (e) { console.warn('[Southland] chat.botSay:', e); }
    }
  }

  /* ---------- карусель стилей ---------- */

  function makeCard(style) {
    var card = document.createElement('div');
    card.className = 'scard';
    card.dataset.id = style.id;
    card.setAttribute('role', 'option');
    card.tabIndex = 0;
    card.setAttribute('aria-selected', 'false');
    card.setAttribute('aria-label', style.name);

    var inn = document.createElement('div');
    inn.className = 'scard-in';

    var sw = document.createElement('div');
    sw.className = 'swatch ' + style.swatchClass; // класс-заглушка виден, пока превью считается
    var cv = document.createElement('canvas');
    cv.width = 208; cv.height = 104;
    sw.appendChild(cv);

    var nm = document.createElement('div');
    nm.className = 'sname';
    nm.textContent = style.name;

    var dots = document.createElement('div');
    dots.className = 'dots3';
    for (var i = 0; i < style.palette.length; i++) {
      var d = document.createElement('i');
      d.style.background = style.palette[i];
      dots.appendChild(d);
    }

    inn.appendChild(sw); inn.appendChild(nm); inn.appendChild(dots);
    card.appendChild(inn);

    card.addEventListener('click', function () { selectStyle(style.id); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        selectStyle(style.id);
      }
    });
    return card;
  }

  function buildCarousel() {
    var track = $('styleTrack');
    track.innerHTML = '';
    for (var i = 0; i < SL.STYLES.length; i++) track.appendChild(makeCard(SL.STYLES[i]));
    track.scrollLeft = 0;
    updateDots();
  }

  /* Превью лениво, по одному стилю на кадр; активный стиль — первым */
  function queueThumbs() {
    var gen = ++state._gen;
    var track = $('styleTrack');
    var active = SL.styleById(state.styleId);
    var order = [active];
    for (var i = 0; i < SL.STYLES.length; i++) {
      if (SL.STYLES[i].id !== active.id) order.push(SL.STYLES[i]);
    }
    var n = 0;
    function step() {
      if (gen !== state._gen || !state.src || n >= order.length) return; // очередь устарела или кончилась
      var style = order[n++];
      var card = track.querySelector('.scard[data-id="' + style.id + '"]');
      if (card) {
        try {
          var t = SL.engine.thumb(state.src, style);
          var cv = card.querySelector('canvas');
          if (t && cv) {
            cv.width = t.width;
            cv.height = t.height;
            cv.getContext('2d').drawImage(t, 0, 0);
          }
        } catch (e) { console.warn('[Southland] engine.thumb:', e); }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateDots() {
    var track = $('styleTrack');
    if (!track || !dotEls.length) return;
    var max = track.scrollWidth - track.clientWidth;
    var p = max > 0 ? track.scrollLeft / max : 0;
    var idx = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2;
    for (var i = 0; i < dotEls.length; i++) dotEls[i].classList.toggle('on', i === idx);
  }

  /* ---------- выбор стиля и рендер ---------- */

  function updateCaption(style) {
    $('styleNowName').textContent = '◆ ' + style.name;
    $('styleNowTag').textContent = style.tagline;
  }

  function markActive(id) {
    var cards = $('styleTrack').children;
    for (var i = 0; i < cards.length; i++) {
      var on = cards[i].dataset.id === id;
      cards[i].classList.toggle('active', on);
      cards[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function selectStyle(id, opts) {
    opts = opts || {};
    var style = SL.styleById(id);
    var changed = state.styleId !== style.id;
    state.styleId = style.id; // refinements сохраняются — меняется только настроение
    updateCaption(style);
    markActive(style.id);
    if (opts.fromChat) { // докрутить карусель до карточки, страницу не трогаем
      var track = $('styleTrack');
      var card = track.querySelector('.scard[data-id="' + style.id + '"]');
      if (card) track.scrollTo({ left: Math.max(0, card.offsetLeft - 26), behavior: 'smooth' });
    }
    if (changed) rerender();
    if (changed || opts.fromChat) botReply({ type: 'style', styleId: style.id });
  }

  /* Вуаль включается сразу, рендер — через двойной rAF, чтобы она успела показаться */
  function rerender() {
    if (!state.src) return;
    var veil = $('renderVeil');
    veil.classList.add('on');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try {
          state._result = SL.engine.render(state.src, SL.styleById(state.styleId), state.refinements, state.seed);
          SL.compare.setAfter(state._result);
        } catch (e) { console.warn('[Southland] engine.render:', e); }
        veil.classList.remove('on');
      });
    });
  }

  /* ---------- интенты чата ---------- */

  function applyIntent(a) {
    if (!a || !a.type) return;
    switch (a.type) {

      case 'recolor': {
        if (!state.src) return;
        if (!a.hex) { botReply(a); break; } // мишень без цвета — chat переспросит
        var t = a.target || 'all';
        var tLabel = t === 'all' ? 'Вся комната' : (SL.TARGETS[t] ? SL.TARGETS[t].label : t);
        var ref = {
          type: 'recolor', target: t, hex: a.hex, colorName: a.colorName,
          label: tLabel + ': ' + (a.colorName || a.hex)
        };
        var found = -1;
        for (var i = 0; i < state.refinements.length; i++) {
          if (state.refinements[i].type === 'recolor' && state.refinements[i].target === t) { found = i; break; }
        }
        if (found >= 0) state.refinements[found] = ref; else state.refinements.push(ref);
        rerender();
        var items = (t !== 'all' && SL.TARGETS[t]) ? [SL.TARGETS[t].item] : undefined;
        botReply(a, { chips: refLabels(), products: suggest(items, { name: a.colorName, hex: a.hex }) });
        break;
      }

      case 'adjust': {
        if (!a.param) break;
        var label = a.label || (ADJ_LABEL[a.param] || a.param) + (a.delta >= 0 ? ': больше' : ': меньше');
        var ex = null;
        for (var j = 0; j < state.refinements.length; j++) {
          if (state.refinements[j].type === 'adjust' && state.refinements[j].param === a.param) { ex = state.refinements[j]; break; }
        }
        if (ex) { // повторные правки одного параметра складываются
          ex.delta = clamp(ex.delta + (a.delta || 0), -0.5, 0.5);
          ex.label = label;
        } else {
          state.refinements.push({ type: 'adjust', param: a.param, delta: clamp(a.delta || 0, -0.5, 0.5), label: label });
        }
        rerender();
        botReply(a, { chips: refLabels() });
        break;
      }

      case 'style':
        selectStyle(a.styleId, { fromChat: true });
        break;

      case 'plants': {
        var has = state.refinements.some(function (r) { return r.type === 'plants'; });
        if (!has) state.refinements.push({ type: 'plants', label: 'Растения: добавлены' });
        rerender();
        botReply(a, { chips: refLabels(), products: suggest(['plant']) });
        break;
      }

      case 'products': {
        var list = (a.items && a.items.length) ? a.items : ['sofa', 'rug', 'lamp'];
        botReply(a, { products: suggest(list, a.color) });
        break;
      }

      case 'undo':
        state.refinements.pop();
        rerender();
        botReply(a, { chips: refLabels() });
        break;

      case 'reset':
        state.refinements = [];
        state.seed = 1;
        rerender();
        botReply(a);
        break;

      case 'variant':
        state.seed++;
        rerender();
        botReply(a);
        break;

      case 'download':
        doDownload();
        botReply(a);
        break;

      case 'help':
      default:
        botReply(a); // help и незнакомые интенты — текст даёт chat.replyFor
        break;
    }
  }

  /* onAction для SL.chat.init: принимает массив интентов или {intents:[...]} */
  function onAction(actions) {
    if (!actions) return;
    var list = Array.isArray(actions) ? actions
      : (Array.isArray(actions.intents) ? actions.intents : [actions]);
    for (var i = 0; i < list.length; i++) applyIntent(list[i]);
  }

  /* ---------- кнопки результата ---------- */

  function doDownload() {
    if (!state._result) return;
    var a = document.createElement('a');
    a.download = 'southland-' + state.styleId + '.png';
    a.href = state._result.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function doShare() {
    var btn = $('btnShare');
    var flash = function () {
      btn.classList.add('flash');
      setTimeout(function () { btn.classList.remove('flash'); }, 600);
    };
    var meta = {
      title: 'Southland — AI-дизайнер интерьера',
      text: 'Мой новый интерьер от Southland',
      url: location.href
    };
    if (navigator.share) {
      if (state._result && state._result.toBlob && navigator.canShare) {
        state._result.toBlob(function (blob) {
          var shared = false;
          if (blob) {
            var file = new File([blob], 'southland-' + state.styleId + '.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              navigator.share({ files: [file], title: meta.title }).catch(function () { /* отмена — не ошибка */ });
              shared = true;
            }
          }
          if (!shared) navigator.share(meta).catch(function () { /* отмена — не ошибка */ });
        }, 'image/png');
      } else {
        navigator.share(meta).catch(function () { /* отмена — не ошибка */ });
      }
      return;
    }
    // фолбэк: адрес страницы в буфер обмена + мигнуть кнопкой
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(meta.url).then(flash, flash);
    } else {
      flash();
    }
  }

  /* ---------- инициализация ---------- */

  function init() {
    if (inited) return;
    var required = ['STYLES', 'styleById', 'engine', 'demoRoom', 'compare', 'chat', 'catalog'];
    var missing = [];
    for (var i = 0; i < required.length; i++) {
      if (!window.SL || !SL[required[i]]) missing.push(required[i]);
    }
    if (missing.length) {
      console.warn('[Southland] app: не хватает модулей (' + missing.join(', ') + ') — запуск отменён');
      return;
    }
    inited = true;

    SL.compare.init();
    SL.chat.init(onAction);

    /* — загрузка: кнопка, клик по зоне, drag&drop, демо — */
    var dz = $('dropzone'), fi = $('fileInput');
    $('btnChoose').addEventListener('click', function () { fi.click(); });
    dz.addEventListener('click', function (e) {
      if (e.target.closest('button')) return; // кнопки внутри зоны работают сами
      fi.click();
    });
    fi.addEventListener('change', function () {
      handleFile(fi.files && fi.files[0]);
      fi.value = ''; // то же фото можно выбрать повторно
    });
    dz.addEventListener('dragover', function (e) {
      e.preventDefault();
      dz.classList.add('dragover');
    });
    dz.addEventListener('dragleave', function (e) {
      if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
    });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('dragover');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
    $('btnDemo').addEventListener('click', function () {
      try { handlePhoto(SL.demoRoom.create()); }
      catch (e) { console.warn('[Southland] demoRoom.create:', e); }
    });

    /* — карусель: стрелки и ромбы-точки — */
    var track = $('styleTrack');
    $('carPrev').addEventListener('click', function () { track.scrollBy({ left: -230, behavior: 'smooth' }); });
    $('carNext').addEventListener('click', function () { track.scrollBy({ left: 230, behavior: 'smooth' }); });
    var dotsBox = $('carDots');
    dotsBox.innerHTML = '';
    dotEls = [];
    for (var d = 0; d < 3; d++) {
      var dot = document.createElement('i');
      dotsBox.appendChild(dot);
      dotEls.push(dot);
    }
    updateDots();
    track.addEventListener('scroll', updateDots, { passive: true });

    /* — действия под слайдером — */
    $('btnDownload').addEventListener('click', doDownload);
    $('btnShare').addEventListener('click', doShare);
    $('btnVariant').addEventListener('click', function () { applyIntent({ type: 'variant' }); });
  }

  SL.app = {
    state: state,
    init: init,
    rerender: rerender,
    onAction: onAction,
    selectStyle: selectStyle
  };

  document.addEventListener('DOMContentLoaded', SL.app.init);
})();
