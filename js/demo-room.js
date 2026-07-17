/* Southland AI — демо-комната: иллюстрированная гостиная 1280×800
 * в нейтральных бежево-серых тонах. Композиция выровнена по маскам движка:
 * ковёр-эллипс внизу по центру, диван в центре (подушки в точках маски),
 * шторы у краёв кадра, окно слева, торшер справа. Чистый canvas 2D,
 * шум — только через LCG (Math.random не используется). */
(function () {
  'use strict';
  window.SL = window.SL || {};

  var W = 1280, H = 800;

  function lcg(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* Прямоугольник со скруглением; r — число или {tl,tr,br,bl} */
  function rr(x2, x, y, w, h, r) {
    var tl, tr, br, bl;
    if (typeof r === 'number') { tl = tr = br = bl = r; }
    else { tl = r.tl || 0; tr = r.tr || 0; br = r.br || 0; bl = r.bl || 0; }
    x2.beginPath();
    x2.moveTo(x + tl, y);
    x2.lineTo(x + w - tr, y);
    x2.arcTo(x + w, y, x + w, y + tr, tr);
    x2.lineTo(x + w, y + h - br);
    x2.arcTo(x + w, y + h, x + w - br, y + h, br);
    x2.lineTo(x + bl, y + h);
    x2.arcTo(x, y + h, x, y + h - bl, bl);
    x2.lineTo(x, y + tl);
    x2.arcTo(x, y, x + tl, y, tl);
    x2.closePath();
  }

  function ell(x2, cx, cy, rx, ry, fill) {
    x2.beginPath();
    x2.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { x2.fillStyle = fill; x2.fill(); }
  }

  /* Лист растения: два квадратичных лепестка + прожилка */
  function leaf(x2, bx, by, tx, ty, wd, color) {
    var mx = (bx + tx) / 2, my = (by + ty) / 2;
    var dx = tx - bx, dy = ty - by;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * wd, ny = dx / len * wd;
    x2.beginPath();
    x2.moveTo(bx, by);
    x2.quadraticCurveTo(mx + nx, my + ny, tx, ty);
    x2.quadraticCurveTo(mx - nx, my - ny, bx, by);
    x2.closePath();
    x2.fillStyle = color;
    x2.fill();
    x2.beginPath();
    x2.moveTo(bx, by);
    x2.quadraticCurveTo(mx + nx * 0.2, my + ny * 0.2, tx, ty);
    x2.strokeStyle = 'rgba(42,50,36,.28)';
    x2.lineWidth = 1.2;
    x2.stroke();
  }

  /* Штора: основа + вертикальные складки + волнистая кромка + кольца */
  function drape(x2, px, pw) {
    var py = 104, ph = 494, folds = 6, fw = pw / folds, i;
    var g = x2.createLinearGradient(px, 0, px + pw, 0);
    g.addColorStop(0, '#b1a68d');
    g.addColorStop(0.5, '#a0957c');
    g.addColorStop(1, '#aca188');
    x2.fillStyle = g;
    x2.fillRect(px, py, pw, ph);
    for (i = 0; i < folds; i++) {
      var fx = px + i * fw;
      var fg = x2.createLinearGradient(fx, 0, fx + fw, 0);
      fg.addColorStop(0, 'rgba(255,255,255,.15)');
      fg.addColorStop(0.45, 'rgba(255,255,255,0)');
      fg.addColorStop(0.78, 'rgba(58,48,36,.16)');
      fg.addColorStop(1, 'rgba(58,48,36,.03)');
      x2.fillStyle = fg;
      x2.fillRect(fx, py, fw, ph);
    }
    /* волнистая нижняя кромка */
    x2.beginPath();
    x2.moveTo(px, py + ph);
    for (i = 0; i < folds; i++)
      x2.quadraticCurveTo(px + (i + 0.5) * fw, py + ph - 12, px + (i + 1) * fw, py + ph);
    x2.strokeStyle = 'rgba(58,48,36,.28)';
    x2.lineWidth = 2;
    x2.stroke();
    /* кольца на карнизе */
    x2.strokeStyle = '#6e634f';
    x2.lineWidth = 2;
    for (i = 0; i <= folds; i++) {
      x2.beginPath();
      x2.arc(px + i * fw, 101, 4, 0, Math.PI * 2);
      x2.stroke();
    }
  }

  /* Картина в раме: тень, рама, паспарту, простая «абстракция» */
  function picture(x2, px, py, pw, ph, art) {
    x2.fillStyle = 'rgba(66,55,42,.18)';
    x2.fillRect(px + 5, py + 6, pw, ph);
    x2.fillStyle = '#847966';
    x2.fillRect(px, py, pw, ph);
    x2.fillStyle = '#d6cdbb';
    x2.fillRect(px + 9, py + 9, pw - 18, ph - 18);
    var ax = px + 18, ay = py + 18, aw = pw - 36, ah = ph - 36;
    x2.save();
    x2.beginPath();
    x2.rect(ax, ay, aw, ah);
    x2.clip();
    if (art === 'sun') {
      x2.fillStyle = '#c1b69e';
      x2.fillRect(ax, ay, aw, ah);
      x2.fillStyle = '#ac9a76';
      x2.beginPath();
      x2.arc(ax + aw * 0.5, ay + ah * 0.38, aw * 0.20, 0, Math.PI * 2);
      x2.fill();
      x2.fillStyle = '#948d78';
      x2.beginPath();
      x2.ellipse(ax + aw * 0.28, ay + ah * 1.02, aw * 0.52, ah * 0.42, 0, 0, Math.PI * 2);
      x2.fill();
      x2.fillStyle = '#7f785f';
      x2.beginPath();
      x2.ellipse(ax + aw * 0.86, ay + ah * 1.08, aw * 0.55, ah * 0.44, 0, 0, Math.PI * 2);
      x2.fill();
    } else {
      x2.fillStyle = '#b5ab92';
      x2.fillRect(ax, ay, aw, ah);
      x2.strokeStyle = '#77806a';
      x2.lineWidth = 3;
      for (var i = 0; i < 3; i++) {
        var sx = ax + aw * (0.28 + i * 0.22);
        x2.beginPath();
        x2.moveTo(sx, ay + ah);
        x2.quadraticCurveTo(sx + (i - 1) * 14, ay + ah * 0.45, sx + (i - 1) * 22, ay + ah * 0.14);
        x2.stroke();
        x2.beginPath();
        x2.ellipse(sx + (i - 1) * 22, ay + ah * 0.14, 6, 10, (i - 1) * 0.5, 0, Math.PI * 2);
        x2.fillStyle = '#8a9278';
        x2.fill();
      }
    }
    x2.restore();
  }

  /* Диванная подушка в точке маски движка (вписана в эллипс маски) */
  function pillow(x2, cx, cy, rot, color) {
    x2.save();
    x2.translate(cx, cy);
    x2.rotate(rot);
    rr(x2, -66, -41, 132, 82, 26);
    x2.fillStyle = color;
    x2.fill();
    x2.strokeStyle = 'rgba(58,48,36,.20)';
    x2.lineWidth = 2;
    x2.stroke();
    rr(x2, -52, -30, 104, 60, 18);
    x2.strokeStyle = 'rgba(255,255,255,.16)';
    x2.lineWidth = 1.6;
    x2.stroke();
    x2.restore();
  }

  function create() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x2 = c.getContext('2d');
    var g, i;

    /* ── потолок ── */
    g = x2.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#d0cabb');
    g.addColorStop(1, '#c3bcad');
    x2.fillStyle = g;
    x2.fillRect(0, 0, W, 120);
    x2.fillStyle = 'rgba(255,255,255,.35)';
    x2.fillRect(0, 115, W, 3);
    x2.fillStyle = 'rgba(80,68,52,.20)';
    x2.fillRect(0, 118, W, 3);

    /* ── стены ── */
    g = x2.createLinearGradient(0, 120, 0, 556);
    g.addColorStop(0, '#b6ac9c');
    g.addColorStop(1, '#aca290');
    x2.fillStyle = g;
    x2.fillRect(0, 120, W, 436);
    /* лёгкое затемнение к углам */
    g = x2.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(46,38,28,.08)');
    g.addColorStop(0.22, 'rgba(46,38,28,0)');
    g.addColorStop(0.78, 'rgba(46,38,28,0)');
    g.addColorStop(1, 'rgba(46,38,28,.10)');
    x2.fillStyle = g;
    x2.fillRect(0, 120, W, 436);

    /* ── плинтус ── */
    x2.fillStyle = '#9a8d77';
    x2.fillRect(0, 542, W, 16);
    x2.fillStyle = 'rgba(255,255,255,.28)';
    x2.fillRect(0, 542, W, 3);
    x2.fillStyle = 'rgba(60,48,36,.25)';
    x2.fillRect(0, 555, W, 3);

    /* ── пол с плашками ── */
    g = x2.createLinearGradient(0, 556, 0, H);
    g.addColorStop(0, '#a3947f');
    g.addColorStop(1, '#8a7b65');
    x2.fillStyle = g;
    x2.fillRect(0, 556, W, H - 556);
    var rows = [558, 576, 598, 626, 662, 706, 758, 800];
    x2.strokeStyle = 'rgba(74,60,44,.18)';
    x2.lineWidth = 1.4;
    for (i = 1; i < rows.length - 1; i++) {
      x2.beginPath();
      x2.moveTo(0, rows[i]);
      x2.lineTo(W, rows[i]);
      x2.stroke();
    }
    x2.strokeStyle = 'rgba(74,60,44,.13)';
    x2.lineWidth = 1.2;
    for (i = 0; i < rows.length - 1; i++) {
      var offs = (i % 2) ? 128 : 34;
      for (var sx = offs; sx < W; sx += 214) {
        x2.beginPath();
        x2.moveTo(sx, rows[i] + 2);
        x2.lineTo(sx, rows[i + 1] - 2);
        x2.stroke();
      }
    }

    /* ── окно слева ── */
    x2.fillStyle = 'rgba(66,55,42,.16)';
    x2.fillRect(158, 146, 256, 334);
    x2.fillStyle = '#8d8172';
    x2.fillRect(150, 138, 256, 334);
    x2.fillStyle = '#776d5f';
    x2.fillRect(162, 150, 232, 310);
    /* светлый проём */
    g = x2.createLinearGradient(0, 154, 0, 456);
    g.addColorStop(0, '#efe9d8');
    g.addColorStop(0.6, '#e3e3d2');
    g.addColorStop(1, '#d5dccd');
    x2.fillStyle = g;
    x2.fillRect(166, 154, 224, 302);
    /* переплёт */
    x2.fillStyle = '#8d8172';
    x2.fillRect(274, 154, 8, 302);
    x2.fillRect(166, 296, 224, 8);
    /* блики на стёклах */
    x2.save();
    x2.beginPath();
    x2.rect(166, 154, 224, 302);
    x2.clip();
    x2.fillStyle = 'rgba(255,255,255,.20)';
    x2.beginPath();
    x2.moveTo(190, 456); x2.lineTo(300, 154); x2.lineTo(340, 154); x2.lineTo(230, 456);
    x2.closePath(); x2.fill();
    x2.fillStyle = 'rgba(255,255,255,.12)';
    x2.beginPath();
    x2.moveTo(250, 456); x2.lineTo(360, 154); x2.lineTo(378, 154); x2.lineTo(268, 456);
    x2.closePath(); x2.fill();
    x2.restore();
    /* подоконник */
    x2.fillStyle = '#a89e8a';
    x2.fillRect(140, 466, 276, 14);
    x2.fillStyle = 'rgba(60,48,36,.20)';
    x2.fillRect(140, 480, 276, 5);

    /* ── картины на стене ── */
    picture(x2, 452, 168, 132, 154, 'sun');
    picture(x2, 700, 196, 136, 116, 'stems');

    /* ── карнизы и шторы у краёв кадра ── */
    x2.fillStyle = '#776c5a';
    x2.fillRect(26, 96, 150, 6);
    x2.fillRect(1104, 96, 150, 6);
    x2.fillStyle = '#6e634f';
    x2.beginPath(); x2.arc(26, 99, 5, 0, Math.PI * 2); x2.fill();
    x2.beginPath(); x2.arc(176, 99, 5, 0, Math.PI * 2); x2.fill();
    x2.beginPath(); x2.arc(1104, 99, 5, 0, Math.PI * 2); x2.fill();
    x2.beginPath(); x2.arc(1254, 99, 5, 0, Math.PI * 2); x2.fill();
    drape(x2, 36, 134);
    drape(x2, 1110, 134);

    /* ── мягкий сноп света из окна ── */
    g = x2.createLinearGradient(280, 190, 420, 556);
    g.addColorStop(0, 'rgba(255,246,220,.10)');
    g.addColorStop(1, 'rgba(255,246,220,0)');
    x2.fillStyle = g;
    x2.beginPath();
    x2.moveTo(170, 190); x2.lineTo(400, 190); x2.lineTo(545, 556); x2.lineTo(230, 556);
    x2.closePath(); x2.fill();
    x2.fillStyle = 'rgba(255,246,224,.07)';
    x2.beginPath();
    x2.moveTo(150, 556); x2.lineTo(470, 556); x2.lineTo(620, 800); x2.lineTo(60, 800);
    x2.closePath(); x2.fill();

    /* ── ковёр-эллипс (по маске rug: центр 0.5/0.80; рисуем чуть меньше
     * зоны полного веса, чтобы перекраска покрывала ковёр целиком) ── */
    ell(x2, 640, 644, 516, 120, '#ab9f88');
    x2.strokeStyle = 'rgba(92,78,58,.30)';
    x2.lineWidth = 5;
    x2.beginPath(); x2.ellipse(640, 644, 512, 117, 0, 0, Math.PI * 2); x2.stroke();
    x2.lineWidth = 2.5;
    x2.strokeStyle = 'rgba(92,78,58,.28)';
    x2.beginPath(); x2.ellipse(640, 644, 482, 106, 0, 0, Math.PI * 2); x2.stroke();
    x2.lineWidth = 1.5;
    x2.strokeStyle = 'rgba(92,78,58,.22)';
    x2.beginPath(); x2.ellipse(640, 644, 449, 94, 0, 0, Math.PI * 2); x2.stroke();
    /* ромбы-орнамент по кольцу */
    x2.fillStyle = 'rgba(92,78,58,.22)';
    for (i = 0; i < 14; i++) {
      var t = i / 14 * Math.PI * 2;
      var mx = 640 + Math.cos(t) * 414, my = 644 + Math.sin(t) * 82;
      x2.beginPath();
      x2.moveTo(mx - 12, my); x2.lineTo(mx, my - 8); x2.lineTo(mx + 12, my); x2.lineTo(mx, my + 8);
      x2.closePath(); x2.fill();
    }
    /* медальон в видимой части */
    x2.strokeStyle = 'rgba(92,78,58,.20)';
    x2.lineWidth = 2;
    x2.beginPath(); x2.ellipse(640, 706, 120, 26, 0, 0, Math.PI * 2); x2.stroke();
    x2.beginPath();
    x2.moveTo(640 - 24, 706); x2.lineTo(640, 706 - 12); x2.lineTo(640 + 24, 706); x2.lineTo(640, 706 + 12);
    x2.closePath();
    x2.fillStyle = 'rgba(92,78,58,.22)';
    x2.fill();

    /* ── тени под мебелью ── */
    ell(x2, 640, 646, 372, 38, 'rgba(50,40,28,.16)');
    ell(x2, 1076, 618, 58, 12, 'rgba(50,40,28,.14)');
    ell(x2, 1150, 692, 58, 12, 'rgba(50,40,28,.14)');
    ell(x2, 205, 712, 62, 13, 'rgba(50,40,28,.15)');

    /* ── диван (заполняет зону полного веса маски sofa: центр 0.5/0.60) ── */
    /* спинка */
    rr(x2, 320, 352, 640, 196, { tl: 34, tr: 34, br: 0, bl: 0 });
    g = x2.createLinearGradient(0, 352, 0, 548);
    g.addColorStop(0, '#99907d');
    g.addColorStop(1, '#8d846f');
    x2.fillStyle = g;
    x2.fill();
    x2.strokeStyle = 'rgba(58,48,36,.20)';
    x2.lineWidth = 2;
    x2.stroke();
    /* швы спинки */
    x2.strokeStyle = 'rgba(40,32,22,.10)';
    x2.lineWidth = 2;
    x2.beginPath(); x2.moveTo(534, 366); x2.lineTo(534, 500); x2.stroke();
    x2.beginPath(); x2.moveTo(746, 366); x2.lineTo(746, 500); x2.stroke();
    /* подушки — ровно в точках маски pillows (0.42/0.56 и 0.58/0.56) */
    pillow(x2, 538, 448, -0.05, '#b3a88e');
    pillow(x2, 742, 448, 0.05, '#8e8775');
    /* сиденье */
    rr(x2, 396, 490, 240, 78, 18);
    x2.fillStyle = '#a59c87';
    x2.fill();
    x2.strokeStyle = 'rgba(58,48,36,.16)';
    x2.lineWidth = 2;
    x2.stroke();
    rr(x2, 644, 490, 240, 78, 18);
    x2.fillStyle = '#a19881';
    x2.fill();
    x2.stroke();
    /* база */
    rr(x2, 320, 558, 640, 56, { tl: 0, tr: 0, br: 16, bl: 16 });
    x2.fillStyle = '#877e6b';
    x2.fill();
    x2.fillStyle = 'rgba(40,32,22,.12)';
    x2.fillRect(320, 558, 640, 8);
    /* подлокотники (закрывают зону полного веса маски по бокам) */
    rr(x2, 284, 396, 100, 218, { tl: 34, tr: 34, br: 10, bl: 10 });
    g = x2.createLinearGradient(284, 0, 384, 0);
    g.addColorStop(0, '#a29981');
    g.addColorStop(1, '#8c836e');
    x2.fillStyle = g;
    x2.fill();
    x2.strokeStyle = 'rgba(58,48,36,.20)';
    x2.stroke();
    rr(x2, 896, 396, 100, 218, { tl: 34, tr: 34, br: 10, bl: 10 });
    g = x2.createLinearGradient(896, 0, 996, 0);
    g.addColorStop(0, '#8c836e');
    g.addColorStop(1, '#a29981');
    x2.fillStyle = g;
    x2.fill();
    x2.stroke();
    /* ножки */
    x2.fillStyle = '#6e5d46';
    x2.fillRect(334, 614, 14, 26);
    x2.fillRect(548, 614, 14, 26);
    x2.fillRect(720, 614, 14, 26);
    x2.fillRect(932, 614, 14, 26);

    /* ── приставной столик справа от дивана (за пределами маски sofa) ── */
    x2.fillStyle = '#7a6a52';
    x2.fillRect(1071, 516, 10, 96);
    ell(x2, 1076, 613, 30, 8, '#75654e');
    ell(x2, 1076, 516, 48, 13, '#75654e');
    ell(x2, 1076, 510, 48, 13, '#98876c');
    x2.strokeStyle = 'rgba(255,255,255,.20)';
    x2.lineWidth = 1.5;
    x2.beginPath(); x2.ellipse(1076, 510, 40, 10, 0, Math.PI, Math.PI * 2); x2.stroke();
    /* книги и вазочка */
    x2.fillStyle = '#8d7f6d';
    x2.fillRect(1043, 498, 42, 7);
    x2.fillStyle = '#a39380';
    x2.fillRect(1047, 491, 36, 7);
    x2.fillStyle = '#8f8274';
    x2.beginPath();
    x2.moveTo(1094, 504); x2.lineTo(1106, 504); x2.lineTo(1103, 474); x2.lineTo(1097, 474);
    x2.closePath(); x2.fill();
    x2.strokeStyle = '#77806a';
    x2.lineWidth = 2;
    x2.beginPath(); x2.moveTo(1100, 474); x2.quadraticCurveTo(1106, 456, 1114, 448); x2.stroke();
    x2.beginPath(); x2.moveTo(1100, 474); x2.quadraticCurveTo(1096, 458, 1088, 452); x2.stroke();

    /* ── торшер справа: мягкое пятно света + абажур + стойка ── */
    g = x2.createRadialGradient(1150, 380, 10, 1150, 380, 175);
    g.addColorStop(0, 'rgba(244,227,170,.30)');
    g.addColorStop(1, 'rgba(244,227,170,0)');
    x2.fillStyle = g;
    x2.fillRect(975, 205, 305, 350);
    ell(x2, 1150, 702, 92, 20, 'rgba(244,227,170,.15)');
    x2.fillStyle = '#6f6455';
    x2.fillRect(1146, 400, 8, 286);
    ell(x2, 1150, 686, 34, 9, '#6f6455');
    x2.beginPath();
    x2.moveTo(1112, 406); x2.lineTo(1188, 406); x2.lineTo(1174, 332); x2.lineTo(1126, 332);
    x2.closePath();
    g = x2.createLinearGradient(0, 332, 0, 406);
    g.addColorStop(0, '#cfc4a6');
    g.addColorStop(1, '#e2d7ba');
    x2.fillStyle = g;
    x2.fill();
    x2.strokeStyle = 'rgba(90,76,56,.35)';
    x2.lineWidth = 2;
    x2.stroke();
    x2.strokeStyle = 'rgba(255,244,200,.55)';
    x2.lineWidth = 3;
    x2.beginPath(); x2.moveTo(1115, 404); x2.lineTo(1185, 404); x2.stroke();

    /* ── растение в кадке слева ── */
    leaf(x2, 205, 648, 128, 494, 26, '#77806a');
    leaf(x2, 205, 648, 160, 452, 28, '#68715c');
    leaf(x2, 205, 648, 200, 430, 30, '#828b74');
    leaf(x2, 205, 648, 242, 452, 28, '#6d7663');
    leaf(x2, 205, 648, 274, 502, 26, '#7c8570');
    leaf(x2, 205, 648, 152, 556, 22, '#828b74');
    leaf(x2, 205, 648, 260, 560, 22, '#68715c');
    x2.beginPath();
    x2.moveTo(176, 706); x2.lineTo(234, 706); x2.lineTo(228, 646); x2.lineTo(182, 646);
    x2.closePath();
    x2.fillStyle = '#95866d';
    x2.fill();
    x2.fillStyle = '#a08f74';
    x2.fillRect(174, 634, 62, 14);
    x2.fillStyle = 'rgba(255,255,255,.14)';
    x2.fillRect(182, 648, 8, 56);

    /* ── лёгкая глубина: свет сверху, тень снизу ── */
    g = x2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,252,242,.05)');
    g.addColorStop(0.5, 'rgba(255,252,242,0)');
    g.addColorStop(1, 'rgba(52,42,30,.06)');
    x2.fillStyle = g;
    x2.fillRect(0, 0, W, H);

    /* ── мелкий шум (детерминированный) ── */
    var noise = document.createElement('canvas');
    noise.width = noise.height = 96;
    var nx = noise.getContext('2d');
    var nimg = nx.createImageData(96, 96);
    var nd = nimg.data;
    var rnd = lcg(11);
    for (i = 0; i < nd.length; i += 4) {
      var val = 128 + (rnd() - 0.5) * 70;
      nd[i] = nd[i + 1] = nd[i + 2] = val;
      nd[i + 3] = 255;
    }
    nx.putImageData(nimg, 0, 0);
    x2.save();
    x2.globalAlpha = 0.03;
    x2.globalCompositeOperation = 'overlay';
    x2.fillStyle = x2.createPattern(noise, 'repeat');
    x2.fillRect(0, 0, W, H);
    x2.restore();

    return c;
  }

  SL.demoRoom = { create: create };
})();
