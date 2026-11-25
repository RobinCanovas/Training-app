import { FOODS, macrosOf } from './foods.js';

// ───────────── Repas types (quantités en g / ml, aliments crus sauf mention) ─────────────
export const MEALS = {
  bkf: {
    id: 'bkf', name: 'Petit-déjeuner', title: 'Bol d’avoine énergie', icon: 'Sunrise',
    items: [['oats', 90], ['milk', 300], ['banana', 120], ['honey', 20], ['pb', 15]],
    how: 'Avoine + lait 2 min au micro-ondes, puis banane écrasée, miel, beurre de cacahuète. Prêt en 3 min.',
  },
  lunch: {
    id: 'lunch', name: 'Déjeuner', title: 'Riz – poulet – légumes', icon: 'Utensils',
    items: [['rice', 120], ['chicken', 120], ['veg', 150], ['oil', 10], ['oj', 250]],
    how: 'Riz (≈ 10 min), poulet à la poêle 6–7 min, légumes surgelés poêlés. Prépare 3–4 portions le dimanche.',
  },
  shake: {
    id: 'shake', name: 'Shake Liquid Mass', title: 'Shake Liquid Mass', icon: 'GlassWater',
    items: [['milk', 400], ['oats', 50], ['banana', 120], ['pb', 15], ['whey', 25], ['honey', 20]],
    how: 'Tout dans le shaker (ou blender) · 30 s · à boire en moins de 15 min. C’est ton filet de sécurité anti-oubli.',
  },
  snack: {
    id: 'snack', name: 'Collation course', title: 'Avant / après la course', icon: 'Zap',
    items: [['banana', 120], ['dates', 40], ['bread', 70], ['honey', 20], ['skyr', 100]],
    how: 'Avant (60–90 min avant) : pain + miel + banane. Après (dans les 30 min) : skyr + dattes.',
  },
  dinner: {
    id: 'dinner', name: 'Dîner', title: 'Pâtes bolo express', icon: 'Moon',
    items: [['pasta', 130], ['beef5', 100], ['tomato', 150], ['cheese', 10], ['oil', 5]],
    how: 'Pâtes 10 min, bœuf haché 5 min à la poêle, coulis, fromage râpé. Un filet d’huile d’olive à la fin.',
  },
};
for (const m of Object.values(MEALS)) m.macros = macrosOf(m.items);

export const DAY_TYPES = {
  std: { id: 'std', name: 'Jour standard', meals: ['bkf', 'lunch', 'shake', 'dinner'] },
  run: { id: 'run', name: 'Jour de course', meals: ['bkf', 'lunch', 'shake', 'snack', 'dinner'] },
};
for (const d of Object.values(DAY_TYPES)) {
  d.items = d.meals.flatMap((id) => MEALS[id].items);
  d.macros = macrosOf(d.items);
}

// Horaires par défaut (modifiables dans les réglages). Jour de course : shake avancé, collation à 17:30.
export const DEFAULT_TIMES = {
  std: { bkf: '07:30', lunch: '12:30', shake: '16:30', dinner: '19:45' },
  run: { bkf: '07:30', lunch: '12:30', shake: '15:30', snack: '17:30', dinner: '20:00' },
};

// ───────────── Recettes express (≤ 5 min) ─────────────
export const RECIPES = [
  {
    id: 'liquid', name: 'Shake Liquid Mass', time: '2 min', tag: 'Liquide',
    lead: 'À boire en 2 minutes. À avoir toujours sous la main : lait + avoine + banane + whey.',
    items: MEALS.shake.items,
    steps: ['Verse le lait dans le shaker, ajoute whey, avoine, beurre de cacahuète, miel.', 'Écrase la banane dans le shaker (ou passe tout au blender 30 s).', 'Secoue 30 s. Boire en moins de 15 minutes.'],
    swap: 'Pas de blender : flocons d’avoine fins (ou moulus au mixeur la veille) pour éviter les grumeaux.',
  },
  {
    id: 'oats', name: 'Overnight oats choco-banane', time: '3 min la veille', tag: 'Prépa',
    lead: 'Prêt au réveil, zéro cuisine : idéal pour les matins où tu « oublies » de manger.',
    items: [['oats', 90], ['milk', 250], ['skyr', 150], ['banana', 120], ['honey', 20], ['nuts', 20]],
    steps: ['Dans un bocal : avoine, lait, skyr, miel. Mélange.', 'Ferme et place au frigo toute la nuit.', 'Au matin : ajoute la banane en rondelles et les noix concassées.'],
    swap: 'Ajoute 1 c. à café de cacao non sucré si tu aimes le chocolat.',
  },
  {
    id: 'wrap', name: 'Wraps thon – avocat', time: '5 min', tag: 'Sans cuisson',
    lead: 'Sans cuisson, se mange en marchant : parfait entre deux cours ou à la BU.',
    items: [['wrap', 124], ['tuna', 112], ['avocado', 80], ['cheese', 20], ['oj', 250]],
    steps: ['Écrase l’avocat et étale-le sur les wraps.', 'Ajoute thon égoutté et fromage râpé, roule serré.', 'Accompagne d’un verre de jus d’orange.'],
    swap: 'Remplace le thon par 2 œufs durs si tu as préparé des œufs.',
  },
  {
    id: 'riceegg', name: 'Riz – œufs micro-ondes', time: '5 min', tag: 'Micro-ondes',
    lead: 'Le plan B quand il n’y a rien : un sachet de riz et 3 œufs.',
    items: [['ricecooked', 250], ['egg', 165], ['oil', 10], ['avocado', 60], ['bread', 50]],
    steps: ['Chauffe le sachet de riz 2 min au micro-ondes.', 'Œufs brouillés à la poêle 2 min avec l’huile.', 'Sers sur le riz, avocat en tranches, pain à côté.'],
    swap: 'Ajoute une pincée de sel, du paprika ou de la sauce soja pour varier.',
  },
  {
    id: 'skyrbowl', name: 'Bol skyr – avoine – miel', time: '2 min', tag: 'Sans cuisson',
    lead: 'Dessert ou collation protéinée qui complète un repas léger.',
    items: [['skyr', 250], ['oats', 60], ['banana', 120], ['honey', 25], ['nuts', 25]],
    steps: ['Skyr dans un bol, avoine par-dessus.', 'Banane en rondelles, miel, noix.', 'Mélange et mange tout de suite (ou laisse 10 min si tu préfères l’avoine ramollie).'],
    swap: 'Pas de skyr : yaourt grec nature, la valeur en protéines baisse un peu.',
  },
  {
    id: 'pbsand', name: 'Sandwich PB – banane + lait', time: '3 min', tag: 'Sans cuisson',
    lead: 'Sans réchauffer, se transporte facilement : le repas qui rentre dans un sac de cours.',
    items: [['bread', 110], ['pb', 30], ['banana', 120], ['honey', 15], ['milk', 400]],
    steps: ['Tartine le beurre de cacahuète sur le pain, ajoute la banane et le miel.', 'Un grand verre de lait entier à côté.'],
    swap: 'Pas de lait : un yaourt à boire ou un shake de la poudre de whey avec de l’eau + 1 banane.',
  },
  {
    id: 'rescue', name: 'Dépannage 1 minute', time: '1 min', tag: 'Oubli',
    lead: 'Aucune cuisine, aucun shaker : lait, banane, noix, dattes. À garder dans le sac.',
    items: [['milk', 500], ['banana', 120], ['nuts', 40], ['dates', 60]],
    steps: ['Boire le lait.', 'Manger la banane, les noix et les dattes dans l’heure.'],
    swap: 'Intolérance au lactose : lait sans lactose ou boisson soja enrichie.',
  },
];
for (const r of RECIPES) r.macros = macrosOf(r.items);

// ───────────── Ajouts rapides (extras comptés dans les « restants ») ─────────────
export const QUICK = [
  { id: 'q-banana', label: 'Banane', items: [['banana', 120]] },
  { id: 'q-milk', label: 'Lait entier 500 ml', items: [['milk', 500]] },
  { id: 'q-skyr', label: 'Skyr 150 g + miel', items: [['skyr', 150], ['honey', 15]] },
  { id: 'q-nuts', label: 'Poignée de noix 40 g', items: [['nuts', 40]] },
  { id: 'q-dates', label: '4 dattes (≈ 90 g)', items: [['dates', 90]] },
  { id: 'q-oj', label: 'Jus d’orange 250 ml', items: [['oj', 250]] },
  { id: 'q-pbtoast', label: '2 tartines beurre de cacahuète + miel', items: [['bread', 80], ['pb', 25], ['honey', 15]] },
  { id: 'q-shake', label: 'Shake Liquid Mass en plus', items: MEALS.shake.items },
].map((q) => ({ ...q, macros: macrosOf(q.items) }));

// ───────────── Alarmes anti-oubli (à programmer dans l’appli Horloge) ─────────────
export const ALARM_DAYS = { all: 'Tous les jours', std: 'Lun, mer, jeu, sam, dim', run: 'Mar, ven' };

export function buildAlarms(times) {
  const s = times.std, r = times.run;
  // un repas à la même heure les deux types de jours = une alarme ; sinon deux alarmes, chacune avec ses jours
  const both = (key, label, note, labelRun) => (s[key] === r[key]
    ? [{ t: s[key], label, note, days: ALARM_DAYS.all }]
    : [{ t: s[key], label, note, days: ALARM_DAYS.std }, { t: r[key], label: labelRun, note, days: ALARM_DAYS.run }]);
  return [
    ...both('bkf', 'Petit-déjeuner + créatine 5 g', 'Le bol d’avoine, et la créatine dans un verre d’eau.', 'Petit-déjeuner + créatine 5 g (course)'),
    { t: '10:30', label: 'Hydratation : 1ʳᵉ bouteille', note: '0,75 L à finir avant midi.', days: ALARM_DAYS.all },
    ...both('lunch', 'Déjeuner', 'Même si « pas faim » : mange au moins le féculent et la protéine.', 'Déjeuner (course)'),
    { t: '15:00', label: 'Hydratation : 2ᵉ bouteille', note: 'Cumul visé : 1,5 L.', days: ALARM_DAYS.all },
    ...both('shake', 'Shake Liquid Mass', 'À boire en 15 min. Repas raté plus tôt ? C’est ici que tu le rattrapes.', 'Shake Liquid Mass (course)'),
    { t: r.snack, label: 'Collation course', note: 'Banane + pain-miel avant, skyr + dattes après.', days: ALARM_DAYS.run },
    ...both('dinner', 'Dîner', 'Pâtes bolo express.', 'Dîner (course)'),
    { t: '21:15', label: 'Bilan du soir', note: 'Ouvre l’appli, coche, regarde les restants. > 400 kcal restantes ? 500 ml de lait + 1 banane.', days: ALARM_DAYS.all },
    { t: '21:30', label: 'Prépa de demain', note: 'Overnight oats au frigo, shaker + whey dans le sac, eau remplie.', days: ALARM_DAYS.all },
  ].sort((a, b) => a.t.localeCompare(b.t) || a.days.localeCompare(b.days));
}

export const RESCUE = [
  'Bois le shake tout de suite (≈ 800 kcal, 2 min).',
  'Pas de shaker ? 500 ml de lait entier + 1 banane + 40 g de noix (≈ 680 kcal).',
  'Ne double pas le repas suivant : rattrape dans les 2 heures qui suivent avec 1 ajout rapide.',
];

// ───────────── Liste de courses : agrège les repas de la semaine ─────────────
export function weeklyShopping({ stdDays, runDays, margin }) {
  const need = {};
  const add = (items, times) => {
    for (const [id, q] of items) need[id] = (need[id] || 0) + q * times;
  };
  add(DAY_TYPES.std.items, stdDays);
  add(DAY_TYPES.run.items, runDays);
  const k = margin ? 1.1 : 1;
  const lines = Object.entries(need).map(([id, q]) => {
    const F = FOODS[id];
    const total = Math.round(q * k);
    const packs = Math.ceil(total / F.pack[0]);
    return { id, name: F.n, cat: F.cat, total, unit: F.u, packs, packLabel: F.pack[1], piece: F.piece };
  });
  return lines;
}

export const EXTRA_STOCK = [
  { id: 'creatine', name: 'Créatine monohydrate (Creapure®)', note: '5 g par jour, dans un verre d’eau avec le petit-déjeuner.' },
  { id: 'omega3', name: 'Oméga-3 (EPA + DHA)', note: '≈ 1 g EPA + DHA par jour, au repas.' },
  { id: 'mg', name: 'Magnésium bisglycinate', note: 'Le soir, dose de l’étiquette.' },
];
