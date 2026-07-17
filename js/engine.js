/* Southland AI — «нейродвижок»: canvas-конвейер стилизации интерьера.
 * prepare() нормализует исходник (max-сторона 1440px), render() делает
 * LUT-грейдинг кадра, зонные перекраски по мягким маскам с сохранением
 * светлоты, затем glow/виньетку/зерно; thumb() — быстрая миниатюра.
 * Только чистые функции над canvas, без DOM-запросов; вся «случайность» —
 * LCG от seed, Math.random не используется вовсе. */
(function () {
  'use strict';
  window.SL = window.SL || {};

  /* ── утилиты ──────────────────────────────────────────────────────── */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* smoothstep: плавный переход e0→e1 */
  function sstep(e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbaStr(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }

  /* Детерминированный генератор (LCG) вместо Math.random */
  function makeLCG(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* RGB(0..255) → HSL(0..1), результат в out — без аллокаций в цикле */
  function rgbToHsl(r, g, b, out) {
    r *= (1 / 255); g *= (1 / 255); b *= (1 / 255);
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    var l = (max + min) * 0.5, h = 0, s = 0, d = max - min;
    if (d > 0.0001) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    out[0] = h; out[1] = s; out[2] = l;
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; else if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  /* HSL(0..1) → RGB(0..255), результат в out */
  function hslToRgb(h, s, l, out) {
    if (s <= 0.0001) { out[0] = out[1] = out[2] = l * 255; return; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    out[0] = hue2rgb(p, q, h + 1 / 3) * 255;
    out[1] = hue2rgb(p, q, h) * 255;
    out[2] = hue2rgb(p, q, h - 1 / 3) * 255;
  }

  /* Лерп оттенка по короткой дуге цветового круга */
  function hueLerp(a, b, t) {
    var d = b - a;
    if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
    var h = a + d * t;
    if (h < 0) h += 1; else if (h >= 1) h -= 1;
    return h;
  }

  /* Скретч-массивы пиксельного прохода (однопоточно — безопасно) */
  var HSL_T = [0, 0, 0], RGB_T = [0, 0, 0];

  /* ── маски зон (u,v нормированы 0..1, мягкий край) ────────────────── */

  var ZONES = { all: 0, ceiling: 1, walls: 2, floor: 3, curtains: 4, rug: 5, sofa: 6, pillows: 7 };
  /* порядок применения: крупные фоновые зоны раньше, мебель поверх, all — последним */
  var ZONE_ORDER = ['ceiling', 'walls', 'floor', 'curtains', 'rug', 'sofa', 'pillows', 'all'];

  /* Вес зоны в точке. Часть слагаемых по y предвычислена построчно. */
  function zoneW(zone, u, wWalls, wCeil, wFloorY, wCurtY, dRug2, dSofa4, dPil2) {
    var dx, d, w1, w2;
    switch (zone) {
      case 0: return 1;                                   /* all */
      case 1: return wCeil;                               /* потолок */
      case 2: return wWalls;                              /* стены */
      case 3:                                             /* пол минус ковёр */
        if (wFloorY <= 0) return 0;
        if (dRug2 >= 1) return wFloorY;
        dx = (u - 0.5) * (1 / 0.44);
        d = Math.sqrt(dx * dx + dRug2);
        w1 = 1 - sstep(0.92, 1.0, d);
        return wFloorY * (1 - w1 * 0.85);
      case 4:                                             /* шторы у краёв */
        if (wCurtY <= 0) return 0;
        w1 = 1 - sstep(0.085, 0.14, u);
        w2 = sstep(0.86, 0.915, u);
        return (w1 > w2 ? w1 : w2) * wCurtY;
      case 5:                                             /* ковёр-эллипс */
        if (dRug2 >= 1) return 0;
        dx = (u - 0.5) * (1 / 0.44);
        d = Math.sqrt(dx * dx + dRug2);
        w1 = 1 - sstep(0.92, 1.0, d);
        if (w1 <= 0) return 0;
        /* мебель стоит поверх ковра: ядро дивана приглушает перекраску */
        if (dSofa4 < 1) {
          dx = (u - 0.5) * (1 / 0.30); dx *= dx; dx *= dx;
          d = dx + dSofa4;
          if (d < 1) {
            d = Math.sqrt(Math.sqrt(d));
            w1 *= 1 - (1 - sstep(0.92, 1.0, d)) * 0.75;
          }
        }
        return w1;
      case 6:                                             /* диван — скруглённый прямоугольник */
        if (dSofa4 >= 1) return 0;
        dx = (u - 0.5) * (1 / 0.30); dx *= dx; dx *= dx;
        d = dx + dSofa4;
        if (d >= 1) return 0;
        d = Math.sqrt(Math.sqrt(d));
        return 1 - sstep(0.92, 1.0, d);
      case 7:                                             /* две подушки */
        if (dPil2 >= 1) return 0;
        dx = (u - 0.42) * (1 / 0.07);
        d = Math.sqrt(dx * dx + dPil2);
        w1 = 1 - sstep(0.82, 1.0, d);
        dx = (u - 0.58) * (1 / 0.07);
        d = Math.sqrt(dx * dx + dPil2);
        w2 = 1 - sstep(0.82, 1.0, d);
        return w1 > w2 ? w1 : w2;
    }
    return 0;
  }

  /* ── подготовка параметров рендера ────────────────────────────────── */

  /* Эффективный грейд: базовый + дельты adjust (складываются) + plants */
  function effectiveGrade(grade, refinements) {
    var g = {
      temp: grade.temp || 0, tint: grade.tint || 0,
      brightness: grade.brightness || 0, contrast: grade.contrast || 0,
      saturation: grade.saturation || 0,
      shadows: grade.shadows || '#000000', shadowStrength: grade.shadowStrength || 0,
      highlights: grade.highlights || '#ffffff', highlightStrength: grade.highlightStrength || 0,
      vignette: grade.vignette || 0, glow: grade.glow || 0,
      glowColor: grade.glowColor || '#ffffff', grain: grade.grain || 0
    };
    for (var i = 0; i < refinements.length; i++) {
      var rf = refinements[i];
      if (!rf) continue;
      if (rf.type === 'adjust') {
        var key = rf.param === 'warmth' ? 'temp' : rf.param;
        if (key === 'temp' || key === 'brightness' || key === 'contrast' || key === 'saturation')
          g[key] = clamp(g[key] + (rf.delta || 0), -1, 1);
      } else if (rf.type === 'plants') {
        g.saturation = clamp(g.saturation + 0.06, -1, 1); /* лёгкая свежесть */
      }
    }
    return g;
  }

  /* Список перекрасок: сначала accents стиля (strength 0.5, в ZONE_ORDER),
   * затем recolor-правки строго В ПОРЯДКЕ ДЕЙСТВИЙ ПОЛЬЗОВАТЕЛЯ (0.85) —
   * последовательное применение даёт естественную семантику «поздняя правка
   * побеждает», в том числе зона поверх более раннего recolor 'all'.
   * Accent зоны, которую пользователь перекрасил сам, пропускается. */
  function buildRecolors(style, refinements) {
    var list = [], userZones = {}, t, i, rf;
    for (i = 0; i < refinements.length; i++) {
      rf = refinements[i];
      if (rf && rf.type === 'recolor' && ZONES[rf.target] !== undefined) userZones[rf.target] = true;
    }
    function push(target, hex, strength) {
      var rgb = hexToRgb(hex);
      rgbToHsl(rgb[0], rgb[1], rgb[2], HSL_T);
      /* hueTrust: у почти серой цели тон не определён — тянем только насыщенность */
      var hueTrust = HSL_T[1] * 5; if (hueTrust > 1) hueTrust = 1;
      list.push({
        zone: ZONES[target], h: HSL_T[0], s: HSL_T[1], l: HSL_T[2],
        strength: strength, hueTrust: hueTrust
      });
    }
    var acc = style.accents || {};
    for (i = 0; i < ZONE_ORDER.length; i++) {
      t = ZONE_ORDER[i];
      if (acc[t] && ZONES[t] !== undefined && !userZones[t]) push(t, acc[t], 0.5);
    }
    for (i = 0; i < refinements.length; i++) {
      rf = refinements[i];
      if (rf && rf.type === 'recolor' && rf.hex && ZONES[rf.target] !== undefined)
        push(rf.target, rf.hex, 0.85);
    }
    return list;
  }

  function hasPlants(refinements) {
    for (var i = 0; i < refinements.length; i++)
      if (refinements[i] && refinements[i].type === 'plants') return true;
    return false;
  }

  /* ── пиксельный проход: LUT-грейдинг + тонирование + перекраски ───── */

  function pixelPass(data, W, H, g, recolors) {
    /* LUT на канал: яркость + температура/оттенок + контраст.
     * Затемнение — мультипликативно (иначе контраст его «съедает»),
     * осветление — подъём к белому с сохранением светов. */
    var lutR = new Uint8Array(256), lutG = new Uint8Array(256), lutB = new Uint8Array(256);
    var slope = 1 + g.contrast * 0.95, b = g.brightness;
    var tR = g.temp * 0.20 + g.tint * 0.10;
    var tG = -g.tint * 0.10;
    var tB = -g.temp * 0.20 + g.tint * 0.10;
    for (var i = 0; i < 256; i++) {
      var xv = i * (1 / 255);
      if (b < 0) xv *= 1 + b * 1.1;
      else xv += b * 0.45 * (1 - xv);
      lutR[i] = clamp(Math.round((0.5 + (xv + tR - 0.5) * slope) * 255), 0, 255);
      lutG[i] = clamp(Math.round((0.5 + (xv + tG - 0.5) * slope) * 255), 0, 255);
      lutB[i] = clamp(Math.round((0.5 + (xv + tB - 0.5) * slope) * 255), 0, 255);
    }
    var satF = 1 + g.saturation; if (satF < 0) satF = 0;
    var sh = hexToRgb(g.shadows), hi = hexToRgb(g.highlights);
    var shS = g.shadowStrength, hiS = g.highlightStrength;
    var shR = sh[0], shG = sh[1], shB = sh[2];
    var hiR = hi[0], hiG = hi[1], hiB = hi[2];
    var n = recolors.length;
    var hsl = HSL_T, rgb = RGB_T;
    var invW = 1 / W, invH = 1 / H;
    var p = 0;

    for (var yy = 0; yy < H; yy++) {
      var v = (yy + 0.5) * invH;
      /* построчные компоненты масок */
      var wWalls = sstep(0.14, 0.24, v) * (1 - sstep(0.48, 0.68, v));
      var wCeil = 1 - sstep(0.08, 0.20, v);
      var wFloorY = sstep(0.68, 0.82, v);
      var wCurtY = 1 - sstep(0.69, 0.75, v);
      var dRug = (v - 0.80) * (1 / 0.17); var dRug2 = dRug * dRug;
      var dSofa = (v - 0.60) * (1 / 0.17); dSofa *= dSofa; var dSofa4 = dSofa * dSofa;
      var dPil = (v - 0.56) * (1 / 0.06); var dPil2 = dPil * dPil;

      for (var xx = 0; xx < W; xx++, p += 4) {
        var u = (xx + 0.5) * invW;
        var r = lutR[data[p]], gg = lutG[data[p + 1]], bb = lutB[data[p + 2]];

        /* насыщенность вокруг лумы */
        var luma = 0.299 * r + 0.587 * gg + 0.114 * bb;
        if (satF !== 1) {
          r = luma + (r - luma) * satF;
          gg = luma + (gg - luma) * satF;
          bb = luma + (bb - luma) * satF;
        }

        /* тонирование теней (1−L)² и светов L² */
        var L = luma * (1 / 255);
        var wS = (1 - L) * (1 - L) * shS;
        var wH = L * L * hiS;
        r += (shR - r) * wS + (hiR - r) * wH;
        gg += (shG - gg) * wS + (hiG - gg) * wH;
        bb += (shB - bb) * wS + (hiB - bb) * wH;
        if (r < 0) r = 0; else if (r > 255) r = 255;
        if (gg < 0) gg = 0; else if (gg > 255) gg = 255;
        if (bb < 0) bb = 0; else if (bb > 255) bb = 255;

        /* зонные перекраски: hue/sat к цели, светлота исходная (≤10% к цели) */
        for (var k = 0; k < n; k++) {
          var rc = recolors[k];
          var w = zoneW(rc.zone, u, wWalls, wCeil, wFloorY, wCurtY, dRug2, dSofa4, dPil2);
          if (w <= 0.01) continue;
          var kk = w * rc.strength;
          rgbToHsl(r, gg, bb, hsl);
          var h0 = hsl[0], s0 = hsl[1], l0 = hsl[2];
          /* очень светлые пиксели (окно, блики) — источники света, их не красим */
          if (l0 > 0.80) { kk *= 1 - sstep(0.80, 0.96, l0); if (kk <= 0.008) continue; }
          /* тон снэпится к целевому быстрее насыщенности — иначе на краях
           * маски появляется «радуга» из промежуточных оттенков */
          var kh = sstep(0.02, 0.30, kk);
          var trust = s0 * 5; if (trust > 1) trust = 1;
          kh += (1 - kh) * (1 - trust);   /* серый пиксель — тон сразу целевой */
          kh *= rc.hueTrust;              /* серая цель — тон не трогаем */
          hsl[0] = hueLerp(h0, rc.h, kh);
          hsl[1] = s0 + (rc.s - s0) * kk;
          /* кромка маски: при большом сдвиге тона гасим насыщенность —
           * переход идёт через серое, а не через цветной ободок */
          var ridge = 4 * w * (1 - w);
          if (ridge > 0.02 && trust > 0.2) {
            var hd = rc.h - h0;
            if (hd > 0.5) hd -= 1; else if (hd < -0.5) hd += 1;
            if (hd < 0) hd = -hd;
            hd *= 3 * rc.hueTrust; if (hd > 1) hd = 1;
            hsl[1] *= 1 - 0.55 * ridge * hd;
          }
          hsl[2] = l0 + (rc.l - l0) * 0.10 * kk;
          hslToRgb(hsl[0], hsl[1], hsl[2], rgb);
          r = rgb[0]; gg = rgb[1]; bb = rgb[2];
        }

        data[p] = r; data[p + 1] = gg; data[p + 2] = bb;
      }
    }
  }

  /* ── оверлеи: glow, виньетка, зерно, растения ─────────────────────── */

  /* Шум зависит только от (size, seed) — кэшируем последний, чтобы не
   * пересоздавать канвас на каждой правке из чата */
  var noiseMemo = { size: 0, seed: 0, canvas: null };

  function noiseCanvas(size, seed) {
    if (noiseMemo.canvas && noiseMemo.size === size && noiseMemo.seed === seed) return noiseMemo.canvas;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;
    var rnd = makeLCG((seed * 7919 + 17) >>> 0);
    for (var i = 0; i < d.length; i += 4) {
      var val = 128 + (rnd() - 0.5) * 96;
      d[i] = d[i + 1] = d[i + 2] = val;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    noiseMemo.size = size; noiseMemo.seed = seed; noiseMemo.canvas = c;
    return c;
  }

  function softLightOp(ctx) {
    ctx.globalCompositeOperation = 'soft-light';
    if (ctx.globalCompositeOperation !== 'soft-light') return 'overlay';
    return 'soft-light';
  }

  function overlays(ctx, W, H, g, seed, plants) {
    var gr;
    ctx.save();

    /* световые пятна glow — позиции детерминированы от seed */
    if (g.glow > 0.005) {
      var fr = seed * 0.6180339887498949; fr -= Math.floor(fr);
      var cx = W * (0.3 + 0.4 * fr), cy = H * 0.22;
      var rad = Math.max(W, H) * 0.30;
      var col = hexToRgb(g.glowColor);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = g.glow;
      gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, rgbaStr(col, 0.9));
      gr.addColorStop(1, rgbaStr(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      var cx2 = W - cx;
      gr = ctx.createRadialGradient(cx2, cy, 0, cx2, cy, rad * 0.75);
      gr.addColorStop(0, rgbaStr(col, 0.7));
      gr.addColorStop(1, rgbaStr(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }

    /* виньетка */
    if (g.vignette > 0.005) {
      var rOut = Math.sqrt(W * W + H * H) * 0.52;
      gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, rOut);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = g.vignette * 0.55;
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }

    /* зерно — шумовой паттерн от seed */
    if (g.grain > 0.003) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = g.grain;
      ctx.fillStyle = ctx.createPattern(noiseCanvas(128, seed), 'repeat');
      ctx.fillRect(0, 0, W, H);
    }

    /* растения: зелёные градиент-овалы у нижних углов */
    if (plants) {
      ctx.globalCompositeOperation = softLightOp(ctx);
      ctx.globalAlpha = 0.05;
      var pts = [[W * 0.10, H * 0.92], [W * 0.90, H * 0.92]];
      for (var i = 0; i < 2; i++) {
        gr = ctx.createRadialGradient(pts[i][0], pts[i][1], 0, pts[i][0], pts[i][1], W * 0.30);
        gr.addColorStop(0, 'rgba(63,128,76,1)');
        gr.addColorStop(1, 'rgba(63,128,76,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── публичное API ────────────────────────────────────────────────── */

  /* Нормализованная копия исходника: max-сторона 1440px (не увеличиваем) */
  function prepare(source) {
    var sw = source.naturalWidth || source.width;
    var sh = source.naturalHeight || source.height;
    var k = Math.min(1, 1440 / Math.max(sw, sh));
    var w = Math.max(1, Math.round(sw * k));
    var h = Math.max(1, Math.round(sh * k));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(source, 0, 0, w, h);
    return c;
  }

  /* Полный рендер: новый canvas того же размера, src не изменяется */
  function render(src, style, refinements, seed) {
    refinements = refinements || [];
    seed = Math.max(1, Math.floor(seed || 1));
    var W = src.width, H = src.height;
    var out = document.createElement('canvas');
    out.width = W; out.height = H;
    var ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);

    var g = effectiveGrade(style.grade, refinements);
    var recolors = buildRecolors(style, refinements);
    var img = ctx.getImageData(0, 0, W, H);
    pixelPass(img.data, W, H, g, recolors);
    ctx.putImageData(img, 0, 0);

    overlays(ctx, W, H, g, seed, hasPlants(refinements));
    return out;
  }

  /* Миниатюра для карусели: cover-кроп + облегчённый конвейер
   * (грейдинг + accents, один glow-блик, простая виньетка, без зерна) */
  function thumb(src, style, w, h) {
    w = w || 208; h = h || 104;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });

    var sw = src.width, sh = src.height;
    var k = Math.max(w / sw, h / sh);
    var cw = w / k, ch = h / k;
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);

    var g = effectiveGrade(style.grade, []);
    var recolors = buildRecolors(style, []);
    var img = ctx.getImageData(0, 0, w, h);
    pixelPass(img.data, w, h, g, recolors);
    ctx.putImageData(img, 0, 0);

    ctx.save();
    if (g.glow > 0.005) {
      var col = hexToRgb(g.glowColor);
      var gr = ctx.createRadialGradient(w * 0.55, h * 0.20, 0, w * 0.55, h * 0.20, w * 0.45);
      gr.addColorStop(0, rgbaStr(col, 0.9));
      gr.addColorStop(1, rgbaStr(col, 0));
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = g.glow;
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    if (g.vignette > 0.005) {
      var gv = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
      gv.addColorStop(0, 'rgba(0,0,0,0)');
      gv.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = g.vignette * 0.45;
      ctx.fillStyle = gv;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  SL.engine = { prepare: prepare, render: render, thumb: thumb };
})();
