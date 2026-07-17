/* Southland AI — чат-консьерж: русскоязычный NLU-парсер команд + рендер сообщений.
 * SL.chat.parse — чистая функция (без DOM), остальное работает с #chatBody/#chatForm.
 * Вся «случайность» — детерминированные хэши от текста запроса. */
window.SL = window.SL || {};

(function () {
  'use strict';

  /* ---------- утилиты ---------- */

  function hash(s) {
    var h = 5381;
    s = String(s);
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* нижний регистр, ё→е, паддинг пробелами — чтобы границы слов ловились по краям */
  function norm(s) {
    return ' ' + String(s || '').toLowerCase().replace(/ё/g, 'е') + ' ';
  }

  function regEsc(s) { return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'); }

  var B = '(^|[^а-яa-z])'; /* «граница слова» слева (после norm: только а-я и латиница) */

  /* ---------- словарь цветов: стем + допустимые прилагательные окончания ---------- */

  var ADJ_END = {};
  ['ый', 'ий', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ым', 'им', 'ом', 'ем',
   'ого', 'его', 'ому', 'ему', 'ую', 'юю', 'ых', 'их', 'ыми', 'ими', 'ей', 'ою', 'ею'
  ].forEach(function (e) { ADJ_END[e] = 1; });

  var COLOR_DEFS = null;
  function colorDefs() {
    if (COLOR_DEFS) return COLOR_DEFS;
    COLOR_DEFS = [];
    var seen = {};
    for (var name in SL.COLORS) {
      if (!Object.prototype.hasOwnProperty.call(SL.COLORS, name)) continue;
      var c = SL.COLORS[name];
      var stem = name.toLowerCase().replace(/ё/g, 'е').replace(/(ый|ий|ой)$/, '');
      if (seen[stem]) continue;
      seen[stem] = 1;
      COLOR_DEFS.push({ stem: stem, name: c.q, hex: c.hex });
    }
    /* длинные стемы раньше — «зелен» не перехватит «зеленоват…» у более точного */
    COLOR_DEFS.sort(function (a, b) { return b.stem.length - a.stem.length; });
    return COLOR_DEFS;
  }

  /* Первый цвет в фразе: слово должно НАЧИНАТЬСЯ со стема и кончаться
   * прилагательным окончанием — «синим» да, «апельсин»/«серьёзно» нет. */
  function findColor(t) {
    var words = t.match(/[а-яa-z]+/g) || [];
    var defs = colorDefs();
    for (var w = 0; w < words.length; w++) {
      for (var d = 0; d < defs.length; d++) {
        var st = defs[d].stem;
        if (words[w].indexOf(st) === 0) {
          var tail = words[w].slice(st.length);
          if (tail && ADJ_END[tail]) return { name: defs[d].name, hex: defs[d].hex };
        }
      }
    }
    return null;
  }

  /* ---------- мишени (SL.TARGETS) ---------- */

  function targetMatchers() {
    if (targetMatchers._m) return targetMatchers._m;
    var m = [];
    for (var id in SL.TARGETS) {
      if (!Object.prototype.hasOwnProperty.call(SL.TARGETS, id)) continue;
      var forms = SL.TARGETS[id].forms, res = [], seen = {};
      for (var i = 0; i < forms.length; i++) {
        var f = forms[i].toLowerCase().replace(/ё/g, 'е').trim();
        if (seen[f]) continue;
        seen[f] = 1;
        if (f === 'пол' || f === 'пола' || f === 'полу') {
          /* «пол/пола/полу» — только как отдельное слово, иначе ловит «получше» */
          if (!seen['__пол']) { seen['__пол'] = 1; res.push(new RegExp(B + 'пол(а|у|ом|е)?([^а-яa-z]|$)')); }
        } else if (f === 'соф') {
          res.push(new RegExp(B + 'соф[аыуоей]'));
        } else {
          res.push(new RegExp(B + regEsc(f)));
        }
      }
      m.push({ id: id, res: res });
    }
    targetMatchers._m = m;
    return m;
  }

  /* Все мишени фразы в порядке упоминания */
  function findTargets(t) {
    var found = [], ms = targetMatchers();
    for (var i = 0; i < ms.length; i++) {
      var best = -1;
      for (var r = 0; r < ms[i].res.length; r++) {
        var mm = ms[i].res[r].exec(t);
        if (mm && (best < 0 || mm.index < best)) best = mm.index;
      }
      if (best >= 0) found.push({ id: ms[i].id, pos: best });
    }
    found.sort(function (a, b) { return a.pos - b.pos; });
    return found.map(function (f) { return f.id; });
  }

  function hasPronoun(t) {
    return new RegExp(B + '(его|ее|их|ей|ему|ним|ней|него|нее)([^а-яa-z]|$)').test(t);
  }

  /* «цветы» как растения, но не «цвет»/«цветовой» — только точные словоформы */
  function hasFlowers(t) {
    return new RegExp(B + '(цветы|цветов|цветок|цветочек|цветочки|цветами|цветам|цветах)([^а-яa-z]|$)').test(t);
  }

  /* «зелень» как растения (существительное), «зелёный» — это цвет */
  function hasGreenery(t) {
    return /растени/.test(t) || new RegExp(B + '(зелень|зелени|зеленью)([^а-яa-z]|$)').test(t);
  }

  /* Предметы для товарной подборки (шире, чем TARGETS: кресло, столик, картина…) */
  var ITEM_PATTERNS = [
    { item: 'lamp',     re: /торшер|ламп|светильн|люстр/ },
    { item: 'armchair', re: /кресл/ },
    { item: 'sofa',     re: /диван|кушетк|соф[аыуое]/ },
    { item: 'rug',      re: /ковер|ковр|палас/ },
    { item: 'curtains', re: /штор|занавес|гардин|тюль/ },
    { item: 'pillow',   re: /подушк|плед/ },
    { item: 'table',    re: /стол(?!б)/ },
    { item: 'plant',    re: /растени|фикус|монстер/ },
    { item: 'paint',    re: /краск|обои/ },
    { item: 'art',      re: /картин|постер|панно/ }
  ];

  function findItems(t) {
    var out = [];
    for (var i = 0; i < ITEM_PATTERNS.length; i++) {
      var m = ITEM_PATTERNS[i].re.exec(t);
      if (m && out.indexOf(ITEM_PATTERNS[i].item) < 0) out.push(ITEM_PATTERNS[i].item);
    }
    if (hasFlowers(t) && out.indexOf('plant') < 0) out.push('plant');
    return out;
  }

  /* Стиль по keywords/имени/id */
  function findStyle(t) {
    for (var i = 0; i < SL.STYLES.length; i++) {
      var st = SL.STYLES[i];
      var kws = st.keywords.concat([st.id]);
      for (var k = 0; k < kws.length; k++) {
        var kw = kws[k].toLowerCase().replace(/ё/g, 'е');
        if (new RegExp(B + regEsc(kw)).test(t)) return st.id;
      }
    }
    return null;
  }

  /* ---------- SL.chat ---------- */

  SL.chat = {
    _ctx: { lastTarget: null, lastColor: null },
    _greeted: false,
    _queue: [],
    _busy: false,

    /* --- NLU: чистая функция, текст → {intents:[...]} --- */
    parse: function (text) {
      var raw = String(text || '');
      var t = norm(raw);
      var intents = [];
      var ctx = SL.chat._ctx;

      function add(intent) { intent.text = raw; intents.push(intent); }

      /* служебные команды */
      var isReset = /сброс|начать заново|начни заново|заново|исходн|с нуля|обнули/.test(t);
      if (isReset) add({ type: 'reset' });
      else if (/отмен|верни(те)?[^а-яa-z,]*как было|верни, как было|убери последн|шаг назад|откат/.test(t)) add({ type: 'undo' });

      if ((/вариант/.test(t) && /друг|еще|нов|альтернатив/.test(t)) || /перегенер/.test(t)) add({ type: 'variant' });

      if (/скач/.test(t) || (/сохран/.test(t) && !/планировк/.test(t))) add({ type: 'download' });

      /* смена стиля */
      var styleId = findStyle(t);
      if (styleId) add({ type: 'style', styleId: styleId });

      /* товары: «где купить…», «покажи ссылки/товары/мебель», «магазин» */
      var wantsProducts = /товар|мебел|магазин|shop|ссылк|покупк/.test(t)
        || /где куп/.test(t)
        || new RegExp(B + '(куплю|купить|купи)([^а-яa-z]|$)').test(t);
      if (wantsProducts) {
        var items = findItems(t);
        var pColor = findColor(t);
        var p = { type: 'products' };
        if (items.length) p.items = items;
        if (pColor) p.color = pColor;
        add(p);
      }

      /* глобальные правки света/цвета кадра.
       * ВАЖНО: «стены светлее»/«сделай его темнее» — тоже adjust brightness:
       * мы честно осветляем/затемняем весь кадр, а не перекрашиваем зону. */
      if (/тепле|уютн/.test(t)) add({ type: 'adjust', param: 'warmth', delta: 0.15, label: 'Свет: теплее' });
      else if (/холодн|прохладн/.test(t)) add({ type: 'adjust', param: 'warmth', delta: -0.15, label: 'Свет: холоднее' });

      if (/светле|ярче|осветл/.test(t)) add({ type: 'adjust', param: 'brightness', delta: 0.12, label: 'Кадр: светлее' });
      else if (/темне|приглуш|затемн/.test(t)) add({ type: 'adjust', param: 'brightness', delta: -0.12, label: 'Кадр: темнее' });

      if (/контраст/.test(t)) {
        var minus = /меньше|убери|убав|сниз|мягче|слабее/.test(t);
        add({ type: 'adjust', param: 'contrast', delta: minus ? -0.12 : 0.12, label: minus ? 'Контраст: мягче' : 'Контраст: выше' });
      }

      if (/насыщенн|сочн/.test(t)) add({ type: 'adjust', param: 'saturation', delta: 0.15, label: 'Цвет: сочнее' });
      else if (/пастельн|спокойн|блекл/.test(t)) add({ type: 'adjust', param: 'saturation', delta: -0.15, label: 'Цвет: пастельнее' });

      /* растения: «растения», «цветы», «зелень» — но не «цвет…» и не цвет «зелёный» */
      var wantsPlants = !wantsProducts && (hasGreenery(t) || hasFlowers(t));
      if (wantsPlants) add({ type: 'plants', label: 'Растения: добавлены' });

      /* перекраска зон: цвет + мишень / местоимение / контекст */
      if (!wantsProducts) {
        var color = findColor(t);
        var targets = findTargets(t);

        if (color) {
          if (targets.length) {
            targets.forEach(function (tg) {
              add({ type: 'recolor', target: tg, hex: color.hex, colorName: color.name,
                    label: SL.TARGETS[tg].label + ': ' + color.name });
            });
            ctx.lastTarget = targets[0];
            ctx.lastColor = color;
          } else if (!wantsPlants) {
            /* цвет без мишени: местоимение или последняя мишень из контекста, иначе весь кадр */
            var tg2 = (hasPronoun(t) && ctx.lastTarget) ? ctx.lastTarget : (ctx.lastTarget || 'all');
            var lbl = tg2 === 'all' ? 'Вся сцена: ' + color.name : SL.TARGETS[tg2].label + ': ' + color.name;
            add({ type: 'recolor', target: tg2, hex: color.hex, colorName: color.name, label: lbl });
            ctx.lastColor = color;
          }
        } else if (targets.length) {
          ctx.lastTarget = targets[0]; /* запоминаем: следующий «синий» ляжет сюда */
          if (!intents.length) add({ type: 'help', ask: 'color', target: targets[0] });
        }
      }

      if (!intents.length) add({ type: 'help' });
      return { intents: intents };
    },

    /* --- тексты ответов: 3-5 вариаций на интент, выбор — хэшем от запроса --- */
    replyFor: function (action, state) {
      var a = action || {};
      var st = state || {};
      var style = a.styleId ? SL.styleById(a.styleId)
        : (st.style || SL.styleById(st.styleId || (SL.app && SL.app.state && SL.app.state.styleId)));
      var sName = style ? style.name : 'выбранный стиль';
      var key = (a.text || '') + '|' + (a.type || '') + '|' + (a.target || '') + (a.colorName || '') + (a.param || '') + (a.styleId || '');
      function v(arr) { return arr[hash(key) % arr.length]; }

      var tdef = a.target && SL.TARGETS[a.target];
      var noun = tdef ? tdef.acc : 'всё вокруг';
      var nounCap = noun.charAt(0).toUpperCase() + noun.slice(1);
      var col = a.colorName || '';
      var html, chips;

      switch (a.type) {
        case 'recolor':
          html = v([
            'Готово — перекрасила ' + esc(noun) + ' в ' + esc(col) + '. Планировка сохранена, поменялось только настроение.',
            esc(nounCap) + ' теперь в оттенке «' + esc(col) + '» — хорошо ложится на ' + esc(sName) + '.',
            'Перекрасила ' + esc(noun) + ' в ' + esc(col) + '. Захотите вернуть — просто скажите «отмени».',
            'Есть! ' + esc(nounCap) + ' — ' + esc(col) + '. В стилистике «' + esc(sName) + '» смотрится благородно.',
            'Приняла: ' + esc(noun) + ' — в ' + esc(col) + '. Остальное не трогала, планировка прежняя.'
          ]);
          break;

        case 'adjust': {
          var plus = (a.delta || 0) >= 0;
          if (a.param === 'warmth') html = plus ? v([
            'Добавила тепла в свет — «' + esc(sName) + '» зазвучал уютнее.',
            'Сделала свет теплее, как от вечерних ламп. Планировка не тронута.',
            'Чуть теплее: добавила янтаря в подсветку кадра.',
            'Согрела сцену — тёплый свет мягко лёг на «' + esc(sName) + '».'
          ]) : v([
            'Охладила свет — стало свежее и графичнее.',
            'Убрала теплоту: кадр стал прохладнее, почти северный свет.',
            'Чуть холоднее — так фактуры читаются строже.'
          ]);
          else if (a.param === 'brightness') html = plus ? v([
            'Осветлила весь кадр — так и стены выглядят светлее, и воздуха стало больше.',
            'Подняла яркость всей сцены: со светом я работаю целиком, не по зонам — планировка прежняя.',
            'Стало светлее — осветляю весь кадр разом, поэтому светлеет и всё, что в нём.',
            'Добавила света во весь кадр — комната задышала.'
          ]) : v([
            'Приглушила свет по всему кадру — камернее и глубже.',
            'Затемнила сцену целиком: вечернее настроение для «' + esc(sName) + '».',
            'Чуть темнее весь кадр — тени стали бархатнее.'
          ]);
          else if (a.param === 'contrast') html = plus ? v([
            'Подняла контраст — линии стали чётче, «' + esc(sName) + '» собраннее.',
            'Добавила контраста: света ярче, тени глубже.',
            'Контраст выше — кадр стал графичнее.'
          ]) : v([
            'Смягчила контраст — картинка стала спокойнее.',
            'Убавила контраст: переходы света теперь плавнее.',
            'Контраст мягче — так «' + esc(sName) + '» выглядит нежнее.'
          ]);
          else html = plus ? v([
            'Сделала цвета сочнее — «' + esc(sName) + '» заиграл.',
            'Добавила насыщенности: оттенки стали звонче.',
            'Чуть больше цвета — интерьер ожил.'
          ]) : v([
            'Увела палитру в пастель — спокойно и дорого.',
            'Приглушила цвета: мягкие, выцветшие на солнце оттенки.',
            'Меньше насыщенности — «' + esc(sName) + '» стал тише и элегантнее.'
          ]);
          break;
        }

        case 'style':
          html = v([
            'Примерила «' + esc(sName) + '»' + (style && style.tagline ? ': ' + esc(style.tagline) : '') + '. Планировка прежняя — новый только характер.',
            'Переключила на «' + esc(sName) + '». Мебель на местах, сменилось настроение.',
            '«' + esc(sName) + '» — отличный выбор. Все ваши правки я сохранила.',
            'Готово: теперь это «' + esc(sName) + '»' + (style && style.tagline ? ' — ' + esc(style.tagline) : '') + '.'
          ]);
          break;

        case 'plants':
          html = v([
            'Добавила зелени — пара растений сразу оживила «' + esc(sName) + '».',
            'Немного живого: растения в кадре, воздух стал свежее.',
            'Зелень на месте — интерьер задышал. Ниже — что можно поставить у себя.',
            'Расставила растения — «' + esc(sName) + '» любит живые акценты.'
          ]);
          break;

        case 'products':
          html = v([
            'Подобрала вещи под «' + esc(sName) + '» — всё со ссылками на магазины:',
            'Вот что я нашла в магазинах под вашу палитру «' + esc(sName) + '»:',
            'Собрала небольшую витрину под «' + esc(sName) + '» — взгляните:',
            'Эти предметы поддержат «' + esc(sName) + '» в реальной комнате:'
          ]);
          break;

        case 'undo':
          html = v([
            'Вернула как было — последняя правка снята.',
            'Откатила последний шаг. Всё остальное на месте.',
            'Убрала последнее изменение — смотрим предыдущую версию.'
          ]);
          break;

        case 'reset':
          html = v([
            'Начала с чистого листа: все правки сняты, остался чистый «' + esc(sName) + '».',
            'Сбросила изменения — перед вами исходная подача стиля «' + esc(sName) + '».',
            'Всё обнулила. Планировка и фото ваши, стиль — «' + esc(sName) + '» без правок.'
          ]);
          break;

        case 'variant':
          html = v([
            'Секунду… готово — другой вариант света.',
            'Перегенерировала: та же идея, другое настроение.',
            'Ещё один вариант — сравните с прежним.'
          ]);
          break;

        case 'download':
          html = v([
            'Сохраняю кадр в PNG — заберите его в загрузках.',
            'Готово, файл ушёл в загрузки. Отличный кадр для мудборда.',
            'Скачала для вас текущий результат в PNG.'
          ]);
          break;

        default: /* help */
          if (a.ask === 'color' && tdef) {
            html = v([
              'В какой цвет перекрасить ' + esc(noun) + '? Например: синий, изумрудный, терракотовый.',
              'Поняла, работаем со следующим: ' + esc(noun) + '. Назовите цвет — бежевый, графитовый, бордовый?',
              esc(nounCap) + ' — отличная идея. Осталось выбрать оттенок: скажем, «изумрудный» или «пудровый».'
            ]);
            chips = ['Синий', 'Изумрудный', 'Терракотовый', 'Бежевый'];
          } else {
            html = v([
              'Я поняла не всё, но помочь смогу: скажите, например, «сделай ковёр синим», «теплее свет», «добавь растения» или «покажи товары».',
              'Немного не разобрала. Попробуйте так: «стены бежевые», «сделай темнее», «в стиле лофт», «где купить диван».',
              'Хм, такого я пока не умею. Зато умею перекрашивать («ковёр — изумрудный»), править свет («светлее», «теплее») и подбирать мебель («покажи товары»).'
            ]);
            chips = ['Сделай ковёр синим', 'Теплее свет', 'Добавь растения', 'Покажи товары'];
          }
      }

      return { html: html, chips: chips };
    },

    /* --- DOM: инициализация чата --- */
    init: function (onAction) {
      var self = this;
      var form = document.getElementById('chatForm');
      var input = document.getElementById('chatInput');

      function handle(text) {
        text = String(text || '').trim();
        if (!text) return;
        self.userSay(text);
        var res = self.parse(text);
        if (typeof onAction === 'function') onAction(res.intents);
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = input.value;
        input.value = '';
        input.focus();
        handle(val);
      });

      var qchips = document.querySelector('.qchips');
      if (qchips) qchips.addEventListener('click', function (e) {
        var b = e.target.closest('.qchip');
        if (b && b.dataset.msg) handle(b.dataset.msg);
      });
    },

    /* --- приветствие (один раз, после первого рендера) --- */
    greet: function (styleName) {
      if (this._greeted) return;
      this._greeted = true;
      this.botSay(
        'Добрый день! Я — консьерж Southland. Уже примерила на вашу комнату стиль «' + esc(styleName) +
        '» — планировка сохранена до сантиметра. Скомандуйте, что поправить: «сделай ковёр синим», ' +
        '«теплее свет», «добавь растения» — или спросите, где купить мебель под результат.',
        { chips: ['Перекраска зон', 'Свет и цвет', 'Подбор мебели'] }
      );
    },

    /* --- сообщения --- */
    userSay: function (text) {
      var body = document.getElementById('chatBody');
      if (!body) return;
      var el = document.createElement('div');
      el.className = 'msg user';
      el.innerHTML = '<span class="who">Вы</span>' + esc(text);
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    },

    /* botSay ставит ответы в очередь: сначала «печатает…» 500–800 мс, потом текст */
    botSay: function (html, opts) {
      this._queue.push({ html: html, opts: opts || {} });
      this._pump();
    },

    _pump: function () {
      var self = this;
      if (self._busy) return;
      var job = self._queue.shift();
      if (!job) return;
      var body = document.getElementById('chatBody');
      if (!body) return;
      self._busy = true;

      var typing = document.createElement('div');
      typing.className = 'msg bot typing';
      typing.innerHTML = '<i>●</i><i>●</i><i>●</i>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      var delay = 500 + (hash(job.html) % 300); /* детерминированные 500–800 мс */
      setTimeout(function () {
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        var el = document.createElement('div');
        el.className = 'msg bot';
        el.innerHTML = '<span class="who">Консьерж</span>' + job.html
          + self._chipsHtml(job.opts.chips)
          + self._productsHtml(job.opts.products);
        body.appendChild(el);
        body.scrollTop = body.scrollHeight;
        self._busy = false;
        self._pump();
      }, delay);
    },

    _chipsHtml: function (chips) {
      if (!chips || !chips.length) return '';
      return '<div class="chips">' + chips.map(function (c) {
        return '<span class="chip">' + esc(c) + '</span>';
      }).join('') + '</div>';
    },

    _productsHtml: function (products) {
      if (!products || !products.length) return '';
      return '<div class="products">' + products.map(function (p) {
        return '<div class="pcard"><div class="pcard-in">'
          + '<div class="pthumb">' + p.svg + '</div>'
          + '<div class="pname">' + esc(p.name) + '</div>'
          + '<div class="pmeta"><span class="price">' + esc(p.priceText) + '</span>'
          + '<span class="retail">' + esc(p.retailer) + '</span></div>'
          + '<a class="pview" href="' + esc(p.url) + '" target="_blank" rel="noopener">Смотреть →</a>'
          + '</div></div>';
      }).join('') + '</div>';
    }
  };
})();
