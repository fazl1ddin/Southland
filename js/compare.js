/* Southland — слайдер сравнения «до/после».
 * SL.compare: init / setImages / setAfter / setPosition.
 * Управление: range поверх кадра, pointer-драг по всей области, дабл-клик — 50%. */
(function () {
  'use strict';
  window.SL = window.SL || {};

  var cmp = null, cvBefore = null, cvAfter = null, range = null;
  var dragging = false;

  /* Позиция разделителя из экранной координаты X */
  function posFromX(clientX) {
    var r = cmp.getBoundingClientRect();
    if (r.width <= 0) return;
    SL.compare.setPosition((clientX - r.left) / r.width * 100);
  }

  /* Нарисовать канвас-источник в целевой канвас 1:1 */
  function paint(target, source) {
    if (!target || !source) return;
    if (target.width !== source.width) target.width = source.width;
    if (target.height !== source.height) target.height = source.height;
    var ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0);
  }

  SL.compare = {
    init: function () {
      cmp = document.getElementById('cmp');
      cvBefore = document.getElementById('cvBefore');
      cvAfter = document.getElementById('cvAfter');
      range = document.getElementById('splitRange');
      if (!cmp || !cvBefore || !cvAfter || !range) {
        console.warn('[Southland] compare: разметка слайдера не найдена');
        return;
      }

      // range → позиция (нативный драг невидимого ползунка)
      range.addEventListener('input', function () {
        SL.compare.setPosition(parseFloat(range.value));
      });

      // pointer-драг по всей области сравнения
      cmp.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        try { cmp.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
        posFromX(e.clientX);
      });
      cmp.addEventListener('pointermove', function (e) {
        if (dragging) posFromX(e.clientX);
      });
      var stop = function (e) {
        dragging = false;
        try { cmp.releasePointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
      };
      cmp.addEventListener('pointerup', stop);
      cmp.addEventListener('pointercancel', stop);

      // дабл-клик — вернуть разделитель в центр
      cmp.addEventListener('dblclick', function () {
        SL.compare.setPosition(50);
      });
    },

    /* before может быть null — тогда левый канвас не трогаем */
    setImages: function (before, after) {
      if (before) paint(cvBefore, before);
      paint(cvAfter, after);
    },

    setAfter: function (after) {
      paint(cvAfter, after);
    },

    setPosition: function (pct) {
      var p = Math.max(4, Math.min(96, Number(pct) || 0));
      p = Math.round(p * 10) / 10;
      if (cmp) cmp.style.setProperty('--split', p + '%');
      if (range) {
        range.value = String(p);
        range.setAttribute('aria-valuenow', String(p));
      }
    }
  };
})();
