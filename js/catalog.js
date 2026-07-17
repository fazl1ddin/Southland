/* Southland AI — каталог: «магазинная» подборка предметов под стиль.
 * SL.catalog.suggest(opts) → карточки {item, name, priceText, retailer, url, svg}.
 * Всё детерминировано (хэш от style.id+item+color) — никакого Math.random. */
window.SL = window.SL || {};

(function () {
  'use strict';

  /* djb2-хэш — единственный источник «случайности» */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /* Осветлить (k>0) / затемнить (k<0) hex-цвет */
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function m(c) { return Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); }
    return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1);
  }

  /* «24 990 ₽» */
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }

  /* Магазины: ссылки строго на поиск, запрос уходит через encodeURIComponent */
  var RETAILERS = [
    { name: 'IKEA',          base: 'https://www.ikea.com/us/en/search/?q=' },
    { name: 'Wayfair',       base: 'https://www.wayfair.com/keyword.php?keyword=' },
    { name: 'Divan.ru',      base: 'https://www.divan.ru/search?q=' },
    { name: 'Ozon',          base: 'https://www.ozon.ru/search/?text=' },
    { name: 'Яндекс Маркет', base: 'https://market.yandex.ru/search?text=' }
  ];

  /* Типы предметов: русский запрос, вилка цен (₽) и пул имён-коллекций.
   * Пулы ровно по 10 имён: индекс (номер_стиля*3 + хэш) % 10 даёт РАЗНЫЕ имена
   * для всех 8 стилей при одном предмете (3 взаимно просто с 10). */
  var ITEMS = {
    rug:      { noun: 'Ковёр',    q: 'ковёр',                 min: 12000, max: 35000,
                names: ['Сапфир', 'Медина', 'Фьорд', 'Гэтсби', 'Атлас', 'Оазис', 'Мираж', 'Севилья', 'Норд', 'Тебриз'] },
    sofa:     { noun: 'Диван',    q: 'диван',                 min: 45000, max: 120000,
                names: ['Монро', 'Осло', 'Верона', 'Луар', 'Манхэттен', 'Киото', 'Бриз', 'Гранд', 'Селин', 'Астер'] },
    armchair: { noun: 'Кресло',   q: 'кресло',                min: 18000, max: 55000,
                names: ['Ротонда', 'Люмьер', 'Фрида', 'Порто', 'Дюна', 'Скаген', 'Богема', 'Вельвет', 'Ява', 'Клуб'] },
    lamp:     { noun: 'Торшер',   q: 'торшер',                min: 6000,  max: 24000,
                names: ['Луна', 'Аврора', 'Гало', 'Селена', 'Маяк', 'Жемчуг', 'Латунь', 'Полночь', 'Эклипс', 'Опал'] },
    curtains: { noun: 'Шторы',    q: 'шторы',                 min: 4000,  max: 15000,
                names: ['Вуаль', 'Муссон', 'Прага', 'Сумерки', 'Каскад', 'Бархат', 'Дымка', 'Ривьера', 'Лён', 'Утро'] },
    table:    { noun: 'Столик',   q: 'журнальный столик',     min: 9000,  max: 32000,
                names: ['Орбита', 'Грань', 'Мрамор', 'Квадро', 'Сакура', 'Устрица', 'Волна', 'Эбен', 'Тик', 'Соло'] },
    plant:    { noun: 'Растение', q: 'комнатное растение',    min: 2000,  max: 9000,
                names: ['Монстера', 'Фикус', 'Оливия', 'Пальма', 'Сансевьера', 'Эвкалипт', 'Бонсай', 'Юкка', 'Папоротник', 'Алоэ'] },
    pillow:   { noun: 'Подушка',  q: 'декоративная подушка',  min: 1500,  max: 6000,
                names: ['Перо', 'Инка', 'Ромб', 'Карамель', 'Мята', 'Соты', 'Полоса', 'Клетка', 'Звезда', 'Бахрома'] },
    paint:    { noun: 'Краска',   q: 'краска для стен',       min: 3000,  max: 12000,
                names: ['Иней', 'Пергамент', 'Тростник', 'Гавань', 'Оникс', 'Латте', 'Полынь', 'Фарфор', 'Грифель', 'Мел'] },
    art:      { noun: 'Постер',   q: 'постер в раме',         min: 4000,  max: 18000,
                names: ['Линии', 'Дюны', 'Полдень', 'Ботаника', 'Горизонт', 'Джаз', 'Сад', 'Тень', 'Овал', 'Река'] }
  };

  /* Инлайн-SVG миниатюры (~90×56): силуэт предмета в переданном цвете + акцент */
  var SVGS = {
    rug: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<ellipse cx="45" cy="30" rx="36" ry="16" fill="' + c + '"/>'
        + '<ellipse cx="45" cy="30" rx="27" ry="11" fill="none" stroke="' + shade(c, 0.35) + '" stroke-width="1.6"/>'
        + '<ellipse cx="45" cy="30" rx="18" ry="7" fill="' + shade(c, -0.25) + '"/>'
        + '<ellipse cx="45" cy="30" rx="8" ry="3.4" fill="none" stroke="' + a + '" stroke-width="1.2"/></svg>';
    },
    sofa: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect x="14" y="16" width="62" height="16" rx="5" fill="' + shade(c, 0.12) + '"/>'
        + '<rect x="8" y="26" width="74" height="14" rx="6" fill="' + c + '"/>'
        + '<rect x="8" y="18" width="11" height="22" rx="5" fill="' + shade(c, -0.18) + '"/>'
        + '<rect x="71" y="18" width="11" height="22" rx="5" fill="' + shade(c, -0.18) + '"/>'
        + '<rect x="25" y="19" width="12" height="10" rx="3" fill="' + a + '" opacity=".85"/>'
        + '<rect x="41" y="19" width="12" height="10" rx="3" fill="' + shade(a, 0.25) + '" opacity=".85"/>'
        + '<path d="M16 40 v6 M74 40 v6" stroke="' + a + '" stroke-width="2"/></svg>';
    },
    armchair: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect x="27" y="13" width="36" height="19" rx="7" fill="' + shade(c, 0.12) + '"/>'
        + '<rect x="23" y="26" width="44" height="13" rx="6" fill="' + c + '"/>'
        + '<rect x="20" y="17" width="9" height="21" rx="4" fill="' + shade(c, -0.18) + '"/>'
        + '<rect x="61" y="17" width="9" height="21" rx="4" fill="' + shade(c, -0.18) + '"/>'
        + '<rect x="36" y="19" width="14" height="9" rx="3" fill="' + a + '" opacity=".8"/>'
        + '<path d="M28 39 v7 M62 39 v7" stroke="' + a + '" stroke-width="2"/></svg>';
    },
    lamp: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<path d="M33 8 h24 l7 15 h-38 z" fill="' + c + '"/>'
        + '<circle cx="45" cy="27" r="4" fill="' + a + '" opacity=".9"/>'
        + '<line x1="45" y1="24" x2="45" y2="46" stroke="' + shade(c, -0.3) + '" stroke-width="2.5"/>'
        + '<path d="M33 48 h24" stroke="' + shade(c, -0.3) + '" stroke-width="3" stroke-linecap="round"/></svg>';
    },
    curtains: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<line x1="8" y1="8" x2="82" y2="8" stroke="' + a + '" stroke-width="2"/>'
        + '<path d="M12 10 h20 c-4 14 -4 26 1 38 h-23 c5 -12 5 -24 2 -38 z" fill="' + c + '"/>'
        + '<path d="M78 10 h-20 c4 14 4 26 -1 38 h23 c-5 -12 -5 -24 -2 -38 z" fill="' + shade(c, -0.12) + '"/>'
        + '<path d="M19 13 c-1 11 -1 22 2 32 M64 13 c1 11 1 22 -2 32" stroke="' + shade(c, -0.28) + '" stroke-width="1.4" fill="none"/></svg>';
    },
    table: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<path d="M27 23 l-4 23 M63 23 l4 23 M45 26 v20" stroke="' + shade(c, -0.3) + '" stroke-width="2.5" fill="none"/>'
        + '<ellipse cx="45" cy="20" rx="26" ry="7" fill="' + shade(c, -0.2) + '"/>'
        + '<ellipse cx="45" cy="18" rx="26" ry="7" fill="' + c + '"/>'
        + '<ellipse cx="45" cy="18" rx="17" ry="4.2" fill="none" stroke="' + a + '" stroke-width="1" opacity=".6"/></svg>';
    },
    plant: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<path d="M45 38 C45 26 37 17 29 13 C32 26 38 33 45 38 Z" fill="' + c + '"/>'
        + '<path d="M45 38 C45 26 53 17 61 13 C58 26 52 33 45 38 Z" fill="' + shade(c, -0.18) + '"/>'
        + '<path d="M45 38 C42 27 44 15 45 9 C47 17 48 29 45 38 Z" fill="' + shade(c, 0.18) + '"/>'
        + '<path d="M35 38 h20 l-3 12 h-14 z" fill="' + shade(a, -0.25) + '"/>'
        + '<path d="M35 38 h20" stroke="' + a + '" stroke-width="2"/></svg>';
    },
    pillow: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect x="25" y="11" width="40" height="34" rx="11" fill="' + c + '" transform="rotate(7 45 28)"/>'
        + '<rect x="30" y="16" width="30" height="24" rx="8" fill="none" stroke="' + shade(c, 0.3) + '" stroke-width="1.4" transform="rotate(7 45 28)"/>'
        + '<circle cx="45" cy="28" r="2.6" fill="' + a + '"/></svg>';
    },
    paint: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect x="30" y="20" width="30" height="24" rx="3" fill="' + shade(c, -0.22) + '"/>'
        + '<ellipse cx="45" cy="20" rx="15" ry="4.5" fill="' + c + '"/>'
        + '<path d="M33 14 a12 8 0 0 1 24 0" stroke="' + a + '" stroke-width="2" fill="none"/>'
        + '<path d="M60 24 c4 3 4 9 0 11" fill="none" stroke="' + c + '" stroke-width="3"/></svg>';
    },
    art: function (c, a) {
      return '<svg width="90" height="56" viewBox="0 0 90 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect x="24" y="8" width="42" height="40" fill="none" stroke="' + a + '" stroke-width="2.5"/>'
        + '<rect x="29" y="13" width="32" height="30" fill="' + shade(c, 0.4) + '"/>'
        + '<circle cx="52" cy="21" r="4.5" fill="' + a + '"/>'
        + '<path d="M29 43 l10 -12 7 8 6 -9 9 13 z" fill="' + c + '"/></svg>';
    }
  };

  /* Цена: детерминированная точка в вилке, округление до «красивых» …990 / …90 */
  function priceFor(def, key) {
    var raw = def.min + (hash('p|' + key) % 997) / 997 * (def.max - def.min);
    var step = def.max >= 20000 ? 1000 : 100;
    var p = Math.round(raw / step) * step - 10;
    if (p < def.min) p = def.min + step - 10;
    return fmt(p);
  }

  /* Базовый цвет силуэта, если пользовательский цвет не задан: берём акценты стиля */
  function pickHex(style, id) {
    var zone = { rug: 'rug', sofa: 'sofa', armchair: 'sofa', curtains: 'curtains', paint: 'walls' }[id];
    if (zone && style.accents && style.accents[zone]) return style.accents[zone];
    if (id === 'plant') return '#5f7d55';
    return style.palette[hash(id + '|' + style.id) % style.palette.length];
  }

  SL.catalog = {
    /* opts: {style, items?:['rug',...], color?:{name,hex}, limit?:3} */
    suggest: function (opts) {
      opts = opts || {};
      var style = opts.style || SL.STYLES[0];
      var limit = opts.limit || 3;
      var color = opts.color || null;

      var asked = (opts.items || []).filter(function (id) { return ITEMS[id]; });
      var askedSet = {};
      asked.forEach(function (id) { askedSet[id] = 1; });

      /* Первым — предмет по теме, дальше сопутствующие */
      var list = asked.length ? asked.slice() : ['sofa', 'rug', 'lamp'];
      var companions = ['lamp', 'armchair', 'pillow', 'table', 'plant', 'art', 'rug', 'sofa', 'curtains'];
      for (var i = 0; i < companions.length && list.length < limit; i++) {
        if (list.indexOf(companions[i]) < 0) list.push(companions[i]);
      }
      list = list.slice(0, limit);

      /* Порядковый номер стиля — для разведения имён коллекций по стилям */
      var ord = 0;
      for (var s = 0; s < SL.STYLES.length; s++) if (SL.STYLES[s].id === style.id) { ord = s; break; }

      return list.map(function (id, idx) {
        var def = ITEMS[id];
        /* Цвет применяем к явно запрошенным предметам (или к первому, если тему не задали) */
        var useColor = !!(color && color.hex && (askedSet[id] || (asked.length === 0 && idx === 0)));
        var cname = useColor ? (color.name || '') : '';
        var key = style.id + '|' + id + '|' + cname;

        var name = def.noun + ' „' + def.names[(ord * 3 + hash(id + '|' + cname)) % def.names.length] + '“';
        var retailer = RETAILERS[hash('r|' + key) % RETAILERS.length];
        var q = def.q + (cname ? ' ' + cname : '') + ' ' + style.productTags[0];
        var mainHex = useColor ? color.hex : pickHex(style, id);

        return {
          item: id,
          name: name,
          priceText: priceFor(def, key),
          retailer: retailer.name,
          url: retailer.base + encodeURIComponent(q),
          svg: SVGS[id](mainHex, style.palette[0])
        };
      });
    }
  };
})();
