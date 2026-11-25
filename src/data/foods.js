// Aliments — valeurs moyennes pour 100 g (ou 100 ml) : [kcal, protéines, glucides, lipides]
// Repères génériques (tables usuelles) ; les étiquettes de tes produits priment.
// m = macros / 100 g · piece = poids d'une unité (g) · pack = taille d'un conditionnement courant (g ou ml)
export const FOODS = {
  oats:       { n: 'Flocons d’avoine',            u: 'g',  m: [375, 13.5, 61, 7],     cat: 'Féculents',            pack: [500, 'paquet de 500 g'] },
  rice:       { n: 'Riz basmati (cru)',            u: 'g',  m: [350, 8, 77, 0.8],      cat: 'Féculents',            pack: [1000, 'sachet de 1 kg'] },
  pasta:      { n: 'Pâtes (crues)',                u: 'g',  m: [355, 12.5, 72, 1.5],   cat: 'Féculents',            pack: [500, 'paquet de 500 g'] },
  bread:      { n: 'Pain (baguette / complet)',    u: 'g',  m: [250, 9, 45, 3],        cat: 'Féculents',            pack: [250, 'baguette (≈ 250 g)'] },
  wrap:       { n: 'Wraps (tortillas de blé)',     u: 'g',  m: [300, 8.5, 49, 7],      cat: 'Féculents',            piece: [62, 'wrap'], pack: [496, 'paquet de 8 wraps'] },
  ricecooked: { n: 'Riz cuit (sachet micro-ondes)', u: 'g', m: [130, 2.7, 28, 0.3],    cat: 'Féculents',            pack: [250, 'sachet de 250 g'] },
  chicken:    { n: 'Blanc de poulet (cru)',        u: 'g',  m: [110, 23, 0, 1.5],      cat: 'Viandes, poissons, œufs', pack: [1000, 'barquette de 1 kg'] },
  beef5:      { n: 'Bœuf haché 5 % MG (cru)',      u: 'g',  m: [125, 21, 0, 5],        cat: 'Viandes, poissons, œufs', pack: [350, 'barquette de 350 g'] },
  tuna:       { n: 'Thon au naturel (égoutté)',    u: 'g',  m: [110, 25, 0, 1],        cat: 'Viandes, poissons, œufs', pack: [112, 'boîte (112 g égoutté)'] },
  egg:        { n: 'Œufs',                         u: 'g',  m: [143, 12.5, 0.7, 9.5],  cat: 'Viandes, poissons, œufs', piece: [55, 'œuf'], pack: [660, 'boîte de 12 œufs'] },
  milk:       { n: 'Lait entier',                  u: 'ml', m: [64, 3.3, 4.7, 3.6],    cat: 'Produits laitiers',    pack: [1000, 'brique de 1 L'] },
  skyr:       { n: 'Skyr nature',                  u: 'g',  m: [63, 11, 4, 0.2],       cat: 'Produits laitiers',    pack: [450, 'pot de 450 g'] },
  cheese:     { n: 'Emmental râpé',                u: 'g',  m: [380, 28, 1, 29],       cat: 'Produits laitiers',    pack: [200, 'sachet de 200 g'] },
  banana:     { n: 'Bananes',                      u: 'g',  m: [90, 1.1, 20, 0.3],     cat: 'Fruits & légumes',     piece: [120, 'banane'], pack: [120, 'banane'] },
  apple:      { n: 'Pommes',                       u: 'g',  m: [52, 0.3, 12, 0.2],     cat: 'Fruits & légumes',     piece: [150, 'pomme'], pack: [150, 'pomme'] },
  avocado:    { n: 'Avocat',                       u: 'g',  m: [160, 2, 2, 15],        cat: 'Fruits & légumes',     piece: [120, 'avocat'], pack: [120, 'avocat'] },
  veg:        { n: 'Légumes (poêlée surgelée)',    u: 'g',  m: [32, 2.5, 4, 0.3],      cat: 'Fruits & légumes',     pack: [1000, 'sachet de 1 kg'] },
  dates:      { n: 'Dattes (dénoyautées)',         u: 'g',  m: [280, 2.5, 65, 0.4],    cat: 'Épicerie',             piece: [22, 'datte'], pack: [250, 'boîte de 250 g'] },
  pb:         { n: 'Beurre de cacahuète (100 %)',  u: 'g',  m: [610, 25, 12, 50],      cat: 'Épicerie',             pack: [350, 'pot de 350 g'] },
  nuts:       { n: 'Noix de cajou / amandes',      u: 'g',  m: [620, 20, 8, 55],       cat: 'Épicerie',             pack: [200, 'sachet de 200 g'] },
  honey:      { n: 'Miel',                         u: 'g',  m: [300, 0.3, 80, 0],      cat: 'Épicerie',             pack: [375, 'pot de 375 g'] },
  oil:        { n: 'Huile d’olive',                u: 'g',  m: [900, 0, 0, 100],       cat: 'Épicerie',             pack: [690, 'bouteille de 75 cl'] },
  tomato:     { n: 'Coulis de tomate',             u: 'g',  m: [35, 1.5, 6, 0.5],      cat: 'Épicerie',             pack: [500, 'brique de 500 g'] },
  oj:         { n: 'Jus d’orange (pur jus)',       u: 'ml', m: [45, 0.7, 10, 0.2],     cat: 'Boissons',             pack: [1000, 'brique de 1 L'] },
  whey:       { n: 'Whey (poudre)',                u: 'g',  m: [380, 78, 6, 6],        cat: 'Compléments',          pack: [2000, 'sac de 2 kg'] },
};

export const CAT_ORDER = ['Féculents', 'Viandes, poissons, œufs', 'Produits laitiers', 'Fruits & légumes', 'Épicerie', 'Boissons', 'Compléments'];

const r1 = (x) => Math.round(x * 10) / 10;

/** Macros d'une liste [[id, quantité], …] → {k, p, c, f} */
export function macrosOf(items) {
  let k = 0, p = 0, c = 0, f = 0;
  for (const [id, q] of items) {
    const m = FOODS[id].m, x = q / 100;
    k += m[0] * x; p += m[1] * x; c += m[2] * x; f += m[3] * x;
  }
  return { k: Math.round(k), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}

export function sumMacros(list) {
  return list.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });
}

/** « 120 g (1 banane) » */
export function fmtQty(id, q) {
  const F = FOODS[id];
  let s = `${Math.round(q)} ${F.u}`;
  if (F.piece) {
    const n = q / F.piece[0];
    const nn = Math.round(n * 2) / 2;
    if (nn >= 0.5) s += ` (${nn % 1 ? nn.toString().replace('.', ',') : nn} ${F.piece[1]}${nn > 1 ? 's' : ''})`;
  } else if (id === 'oil' || id === 'honey' || id === 'pb') {
    const spoon = { oil: 13, honey: 20, pb: 16 }[id]; // g par cuillère à soupe (≈ 15 ml)
    const n = Math.round((q / spoon) * 2) / 2;
    const txt = n < 1 ? '½' : Number.isInteger(n) ? String(n) : `${Math.floor(n)} ½`;
    s += ` (≈ ${txt} c. à soupe)`;
  }
  return s;
}
