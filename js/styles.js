/* Southland AI — данные стилей интерьера.
 * Каждый стиль = грейдинг всего кадра (grade) + зонные перекраски предметов (accents).
 * Все параметры нормированы: temp/tint/brightness/contrast/saturation в -1..1, прочие 0..1. */
window.SL = window.SL || {};

SL.STYLES = [
  {
    id: 'artdeco',
    name: 'Ар-деко «Noir»',
    tagline: 'изумрудный бархат · шампань-золото · мрамор',
    palette: ['#C9A96A', '#2E6B5E', '#121318'],
    swatchClass: 'sw-deco',
    grade: {
      temp: 0.06, tint: -0.02, brightness: -0.14, contrast: 0.22, saturation: -0.04,
      shadows: '#0d1a16', shadowStrength: 0.42,
      highlights: '#e9c988', highlightStrength: 0.30,
      vignette: 0.5, glow: 0.32, glowColor: '#e9c988', grain: 0.05
    },
    accents: { walls: '#1c2b27', sofa: '#2E6B5E', rug: '#d9cdae', curtains: '#1E463E' },
    keywords: ['ар-деко', 'ардеко', 'арт-деко', 'артдеко', 'noir', 'нуар', 'гэтсби', 'deco'],
    productTags: ['ар-деко', 'изумрудный', 'золото']
  },
  {
    id: 'midcentury',
    name: 'Мид-сенчури модерн',
    tagline: 'тик · горчица · графичные формы',
    palette: ['#a96f3d', '#3f5a52', '#d9c8a8'],
    swatchClass: 'sw-mid',
    grade: {
      temp: 0.22, tint: 0.02, brightness: 0.02, contrast: 0.12, saturation: 0.10,
      shadows: '#3a2c1e', shadowStrength: 0.28,
      highlights: '#f0d9a8', highlightStrength: 0.22,
      vignette: 0.28, glow: 0.18, glowColor: '#f0c987', grain: 0.05
    },
    accents: { sofa: '#3f5a52', rug: '#b3773d', curtains: '#c8a86a', walls: '#cbb99b' },
    keywords: ['мид-сенчури', 'мидсенчури', 'mid-century', 'midcentury', '60-е', 'шестидесят'],
    productTags: ['мид-сенчури', 'винтаж', 'тик']
  },
  {
    id: 'scandi',
    name: 'Скандинавский',
    tagline: 'светлое дерево · лён · дневной свет',
    palette: ['#efece4', '#8e9a94', '#b9b2a2'],
    swatchClass: 'sw-sca',
    grade: {
      temp: -0.04, tint: 0.0, brightness: 0.16, contrast: -0.06, saturation: -0.14,
      shadows: '#5a6062', shadowStrength: 0.16,
      highlights: '#f6f2e8', highlightStrength: 0.30,
      vignette: 0.10, glow: 0.10, glowColor: '#f6f2e8', grain: 0.04
    },
    accents: { walls: '#e9e4d8', sofa: '#aab6ad', rug: '#d8d2c2', curtains: '#e2ddd0' },
    keywords: ['сканди', 'скандинав', 'scandi', 'nordic', 'хюгге', 'hygge'],
    productTags: ['скандинавский', 'светлое дерево', 'лён']
  },
  {
    id: 'loft',
    name: 'Лофт',
    tagline: 'кирпич · металл · честный бетон',
    palette: ['#6e4f41', '#2b2b2e', '#8c8a8d'],
    swatchClass: 'sw-loft',
    grade: {
      temp: 0.08, tint: -0.04, brightness: -0.10, contrast: 0.26, saturation: -0.10,
      shadows: '#1d1c1f', shadowStrength: 0.38,
      highlights: '#d8c4a8', highlightStrength: 0.16,
      vignette: 0.42, glow: 0.16, glowColor: '#e0b578', grain: 0.10
    },
    accents: { walls: '#6e4f41', sofa: '#4a4a4e', rug: '#5c5650', curtains: '#3a3a3e' },
    keywords: ['лофт', 'loft', 'индастриал', 'industrial', 'кирпич'],
    productTags: ['лофт', 'индустриальный', 'металл']
  },
  {
    id: 'japandi',
    name: 'Джапанди',
    tagline: 'ваби-саби · оттенки чая · тишина',
    palette: ['#cfc4ae', '#57584e', '#e6ded0'],
    swatchClass: 'sw-jap',
    grade: {
      temp: 0.06, tint: 0.02, brightness: 0.06, contrast: -0.10, saturation: -0.24,
      shadows: '#4a463c', shadowStrength: 0.20,
      highlights: '#efe8d8', highlightStrength: 0.24,
      vignette: 0.18, glow: 0.08, glowColor: '#efe0c0', grain: 0.06
    },
    accents: { walls: '#ddd4c2', sofa: '#8b8474', rug: '#cbbfa6', curtains: '#c9bfa9' },
    keywords: ['джапанди', 'japandi', 'ваби', 'ваби-саби', 'япон', 'дзен'],
    productTags: ['джапанди', 'ваби-саби', 'бежевый']
  },
  {
    id: 'boho',
    name: 'Бохо',
    tagline: 'терракота · ротанг · этника',
    palette: ['#d29a55', '#9c4f39', '#7b6b4c'],
    swatchClass: 'sw-boho',
    grade: {
      temp: 0.30, tint: 0.05, brightness: 0.04, contrast: 0.10, saturation: 0.22,
      shadows: '#4a3020', shadowStrength: 0.26,
      highlights: '#f4d9a8', highlightStrength: 0.26,
      vignette: 0.24, glow: 0.20, glowColor: '#f2c684', grain: 0.07
    },
    accents: { rug: '#b0642f', sofa: '#a4643c', walls: '#d9bd97', curtains: '#c08a4e' },
    keywords: ['бохо', 'boho', 'этни', 'ротанг', 'макраме'],
    productTags: ['бохо', 'терракотовый', 'ротанг']
  },
  {
    id: 'coastal',
    name: 'Прибрежный',
    tagline: 'морская соль · выбеленное дерево · бриз',
    palette: ['#dfe7e6', '#7fa3a8', '#c9c0ab'],
    swatchClass: 'sw-coast',
    grade: {
      temp: -0.18, tint: -0.02, brightness: 0.14, contrast: -0.02, saturation: 0.02,
      shadows: '#3e5a60', shadowStrength: 0.18,
      highlights: '#eef4f2', highlightStrength: 0.30,
      vignette: 0.12, glow: 0.12, glowColor: '#dceef0', grain: 0.04
    },
    accents: { walls: '#dde6e2', sofa: '#7fa3a8', rug: '#d6cfba', curtains: '#c2d5d4' },
    keywords: ['прибрежн', 'coastal', 'морск', 'среднеземномор', 'средиземномор'],
    productTags: ['морской', 'голубой', 'прибрежный']
  },
  {
    id: 'minimal',
    name: 'Минимализм',
    tagline: 'ничего лишнего · графит · свет',
    palette: ['#e8e8e6', '#4c4c50', '#b9b9b6'],
    swatchClass: 'sw-min',
    grade: {
      temp: -0.06, tint: 0.0, brightness: 0.08, contrast: 0.08, saturation: -0.30,
      shadows: '#3c3c40', shadowStrength: 0.22,
      highlights: '#f2f2f0', highlightStrength: 0.24,
      vignette: 0.16, glow: 0.06, glowColor: '#f2f2f0', grain: 0.03
    },
    accents: { walls: '#e4e4e2', sofa: '#6a6a6e', rug: '#cfcfcb', curtains: '#dededb' },
    keywords: ['минимал', 'minimal', 'лаконичн', 'строг'],
    productTags: ['минимализм', 'серый', 'лаконичный']
  }
];

SL.styleById = function (id) {
  for (var i = 0; i < SL.STYLES.length; i++) if (SL.STYLES[i].id === id) return SL.STYLES[i];
  return SL.STYLES[0];
};

/* Словарь цветов для чата и движка: русское название → hex + форма для товарного запроса */
SL.COLORS = {
  'синий':        { hex: '#274a7a', q: 'синий' },
  'голубой':      { hex: '#6da3c9', q: 'голубой' },
  'бирюзовый':    { hex: '#2e8b8b', q: 'бирюзовый' },
  'зелёный':      { hex: '#3e7a4e', q: 'зелёный' },
  'зеленый':      { hex: '#3e7a4e', q: 'зелёный' },
  'изумрудный':   { hex: '#2E6B5E', q: 'изумрудный' },
  'оливковый':    { hex: '#708247', q: 'оливковый' },
  'красный':      { hex: '#9e3434', q: 'красный' },
  'бордовый':     { hex: '#6e2436', q: 'бордовый' },
  'терракотовый': { hex: '#c05f3c', q: 'терракотовый' },
  'оранжевый':    { hex: '#d07a35', q: 'оранжевый' },
  'жёлтый':       { hex: '#d2ab3e', q: 'жёлтый' },
  'желтый':       { hex: '#d2ab3e', q: 'жёлтый' },
  'горчичный':    { hex: '#c29a3a', q: 'горчичный' },
  'золотой':      { hex: '#C9A96A', q: 'золотой' },
  'розовый':      { hex: '#c9798f', q: 'розовый' },
  'пудровый':     { hex: '#d8b2b2', q: 'пудровый' },
  'фиолетовый':   { hex: '#6d5291', q: 'фиолетовый' },
  'лавандовый':   { hex: '#9a8ec2', q: 'лавандовый' },
  'серый':        { hex: '#8a8a8e', q: 'серый' },
  'графитовый':   { hex: '#4c4c50', q: 'графитовый' },
  'белый':        { hex: '#eeeeea', q: 'белый' },
  'чёрный':       { hex: '#26262a', q: 'чёрный' },
  'черный':       { hex: '#26262a', q: 'чёрный' },
  'бежевый':      { hex: '#d8c4a4', q: 'бежевый' },
  'кремовый':     { hex: '#e8dcc4', q: 'кремовый' },
  'коричневый':   { hex: '#7a5638', q: 'коричневый' }
};

/* Предметы-мишени: русские формы → id зоны движка + названия для чата/товаров */
SL.TARGETS = {
  rug:      { label: 'Ковёр',   acc: 'ковёр',   item: 'rug',      forms: ['ковёр', 'ковер', 'ковр', 'палас'] },
  walls:    { label: 'Стены',   acc: 'стены',   item: 'paint',    forms: ['стен', 'обои', 'покраск'] },
  sofa:     { label: 'Диван',   acc: 'диван',   item: 'sofa',     forms: ['диван', 'соф', 'кушетк', 'кресл'] },
  curtains: { label: 'Шторы',   acc: 'шторы',   item: 'curtains', forms: ['штор', 'занавес', 'гардин', 'тюль'] },
  ceiling:  { label: 'Потолок', acc: 'потолок', item: 'lamp',     forms: ['потол'] },
  floor:    { label: 'Пол',     acc: 'пол',     item: 'rug',      forms: ['пол ', 'пола', 'полу', 'паркет', 'ламинат'] },
  pillows:  { label: 'Подушки', acc: 'подушки', item: 'pillow',   forms: ['подушк', 'плед', 'текстиль'] }
};
