// ───────────── Calendrier du programme ─────────────
export const START_DATE = '2026-11-25';   // mercredi — semaine 1
export const TARGET_DATE = '2027-04-01';  // jour J
export const WEEKS = 18;

export const PHASES = [
  { name: 'Fondations', from: 1, to: 5, rpe: '7–8', goal: 'Apprendre les mouvements et fixer les charges de départ. Termine chaque série avec 2 reps en réserve.' },
  { name: 'Surcharge', from: 7, to: 11, rpe: '8', goal: 'Une série de plus sur les mouvements de base : on fait monter les charges et le volume.' },
  { name: 'Intensification', from: 13, to: 17, rpe: '8–9', goal: 'Charges plus lourdes sur les mouvements de base (5–6 reps) avec 1 rep en réserve.' },
];
export const DELOADS = [6, 12, 18];

export function weekInfo(n) {
  const w = Math.min(Math.max(n, 1), WEEKS);
  const phaseIdx = w < 6 ? 0 : w < 12 ? 1 : 2;
  if (DELOADS.includes(w)) {
    return {
      n: w, deload: true, phaseIdx, rpe: '6',
      name: w === WEEKS ? 'Décharge + test 10 km' : 'Décharge',
      goal: w === WEEKS
        ? 'Une série de moins, charges −10 %. Le test des 10 km est mardi : arrive frais.'
        : 'Une série de moins, charges −10 %, RPE 6 : on absorbe le travail des cinq semaines précédentes.',
    };
  }
  const p = PHASES[phaseIdx];
  return { n: w, deload: false, phaseIdx, rpe: p.rpe, name: p.name, goal: p.goal };
}

// Semaine de programme : mercredi → mardi. dow = Date.getDay()
export const WEEK_PLAN = [
  { dow: 3, type: 'gym', id: 'bas', where: 'après le travail' },
  { dow: 4, type: 'rest', label: 'Repos actif', hint: 'Marche, étirements, 3 repas + shake. Rien d’autre.' },
  { dow: 5, type: 'run', id: 'B', where: 'après le travail' },
  { dow: 6, type: 'gym', id: 'full', where: 'après la BU' },
  { dow: 0, type: 'rest', label: 'Repos + pesée + bilan', hint: 'Pesée à jeun, bilan de la semaine, courses et prépa des repas.' },
  { dow: 1, type: 'gym', id: 'haut', where: 'après l’IUT' },
  { dow: 2, type: 'run', id: 'A', where: 'après l’IUT' },
];
export const planForDow = (dow) => WEEK_PLAN.find((d) => d.dow === dow);

// ───────────── Exercices ─────────────
export const EXERCISES = {
  squat: { name: 'Squat barre (cage)', inc: 5, cue: 'Barre haute sur les trapèzes, pieds à la largeur des épaules. Descends cuisses sous la parallèle, dos neutre, talons plantés. Règle les sécurités de la cage.' },
  rdl: { name: 'Soulevé de terre roumain', inc: 5, cue: 'Barre collée aux jambes, genoux légèrement fléchis. Bascule le bassin vers l’arrière, dos plat, descends jusqu’à l’étirement des ischios (mi-tibia), remonte en poussant les hanches.' },
  presse: { name: 'Presse à cuisses', inc: 10, cue: 'Pieds à la largeur des épaules, descends vers 90° sans décoller le bassin du dossier. Ne verrouille pas les genoux en haut.' },
  legcurl: { name: 'Leg curl (assis ou couché)', inc: 2.5, cue: 'Descente contrôlée en 2–3 s, aucun élan. Garde le bassin plaqué.' },
  mollets: { name: 'Mollets debout (machine ou Smith)', inc: 5, cue: 'Amplitude complète : pause 1 s en bas (étirement) et 1 s en haut (contraction).' },
  planche: { name: 'Gainage planche', inc: 0, unit: 's', bw: true, cue: 'Corps aligné de la tête aux talons, abdos et fessiers serrés, respire. Le temps tenu remplace les reps.' },
  dc: { name: 'Développé couché (barre)', inc: 2.5, cue: 'Omoplates serrées, pieds ancrés. Barre au bas des pectoraux, coudes à 45–60°, pousse en diagonale légère. Demande un pareur sur les séries lourdes.' },
  rowing: { name: 'Rowing assis (machine ou T-bar)', inc: 2.5, cue: 'Poitrine appuyée, tire les coudes vers l’arrière, serre les omoplates 1 s, retour contrôlé.' },
  militaire: { name: 'Développé militaire haltères (assis)', inc: 2, cue: 'Abdos gainés, coudes légèrement devant la ligne des épaules, ne cambre pas le bas du dos. Charge = par haltère.' },
  tirage: { name: 'Tirage vertical (ou tractions)', inc: 2.5, cue: 'Tire la barre vers le haut de la poitrine, coudes vers les hanches, sans balancer le buste. Tractions si tu atteins la fourchette.' },
  lateral: { name: 'Élévations latérales haltères', inc: 1, cue: 'Coudes légèrement fléchis, monte jusqu’à l’horizontale, redescends en 2 s, sans élan. Charge = par haltère.' },
  curl: { name: 'Curl biceps haltères', inc: 1, cue: 'Coudes fixes le long du corps, amplitude complète, descente contrôlée. Charge = par haltère.' },
  triceps: { name: 'Extension triceps à la poulie haute', inc: 2.5, cue: 'Coudes collés au corps, extension complète, remontée contrôlée.' },
  squatav: { name: 'Squat avant (ou goblet squat lourd)', inc: 2.5, cue: 'Coudes hauts, buste droit. Si la position de la barre te gêne, fais un goblet squat avec un haltère tenu contre la poitrine.' },
  incline: { name: 'Développé incliné haltères', inc: 2, cue: 'Banc à 30°, trajectoire en arc, coudes à 45–60°, descends jusqu’à l’étirement. Charge = par haltère.' },
  tirhor: { name: 'Tirage horizontal à la poulie', inc: 2.5, cue: 'Dos droit, tire vers le nombril, serre les omoplates 1 s, revient sans arrondir le dos.' },
  hipthrust: { name: 'Hip thrust (barre)', inc: 5, cue: 'Haut du dos sur le banc, menton rentré. Pousse avec les talons, serre les fessiers 1 s en haut. Protège les hanches avec un coussin.' },
  facepull: { name: 'Face pull (poulie corde)', inc: 2.5, cue: 'Poulie à hauteur du visage, tire vers le visage en écartant les coudes, rotation externe en fin de mouvement.' },
  crunch: { name: 'Crunch à la poulie', inc: 2.5, cue: 'Arrondis le dos en rapprochant les côtes du bassin. Ne tire pas avec les bras.' },
};

// sets / reps : [Fondations, Surcharge, Intensification]
const it = (ex, sets, reps, rest) => ({ ex, sets, reps, rest });
export const SESSIONS = {
  bas: {
    id: 'bas', name: 'Bas du corps', short: 'Bas', day: 'Mercredi', duration: '70 min',
    focus: 'Quadriceps, ischios, fessiers, mollets',
    items: [
      it('squat', [3, 4, 4], ['8–10', '6–8', '5–6'], 180),
      it('rdl', [3, 3, 4], ['10–12', '8–10', '8–10'], 150),
      it('presse', [3, 3, 3], ['12–15', '10–12', '10–12'], 120),
      it('legcurl', [3, 3, 3], ['12–15', '10–12', '10–12'], 90),
      it('mollets', [3, 4, 4], ['12–15', '10–15', '10–15'], 60),
      it('planche', [3, 3, 3], ['30–45 s', '45–60 s', '60 s'], 60),
    ],
  },
  haut: {
    id: 'haut', name: 'Haut du corps', short: 'Haut', day: 'Lundi', duration: '75 min',
    focus: 'Pectoraux, dos, épaules, bras',
    items: [
      it('dc', [3, 4, 4], ['8–10', '6–8', '5–6'], 150),
      it('rowing', [3, 4, 4], ['10–12', '8–10', '8–10'], 120),
      it('militaire', [3, 3, 4], ['10–12', '8–10', '6–8'], 120),
      it('tirage', [3, 3, 3], ['10–12', '8–10', '8–10'], 120),
      it('lateral', [3, 3, 3], ['12–15', '12–15', '12–15'], 60),
      it('curl', [2, 3, 3], ['10–12', '10–12', '8–12'], 75),
      it('triceps', [2, 3, 3], ['10–12', '10–12', '8–12'], 75),
    ],
  },
  full: {
    id: 'full', name: 'Full Body', short: 'Full Body', day: 'Samedi', duration: '65 min',
    focus: 'Tout le corps, volume modéré (jambes plus légères que mercredi)',
    items: [
      it('squatav', [3, 3, 3], ['8–10', '8–10', '6–8'], 150),
      it('incline', [3, 3, 4], ['8–10', '8–10', '8–10'], 120),
      it('tirhor', [3, 3, 3], ['10–12', '10–12', '10–12'], 90),
      it('hipthrust', [3, 3, 4], ['8–10', '8–10', '8–10'], 120),
      it('facepull', [3, 3, 3], ['12–15', '12–15', '12–15'], 60),
      it('crunch', [3, 3, 3], ['12–15', '12–15', '12–15'], 60),
    ],
  },
};
export const SESSION_ORDER = ['bas', 'haut', 'full'];

// Charges clés suivies dans les courbes
export const KEY_LIFTS = [
  { id: 'squat', name: 'Squat' },
  { id: 'dc', name: 'Développé couché' },
  { id: 'rdl', name: 'Soulevé de terre roumain' },
];

export const parseRange = (str) => {
  const m = String(str).match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
  const a = Number(m[1]);
  return [a, m[2] ? Number(m[2]) : a];
};

/** Prescription d'un exercice pour la semaine n */
export function prescribe(item, n) {
  const wi = weekInfo(n);
  const base = item.sets[wi.phaseIdx];
  return {
    sets: wi.deload ? Math.max(2, base - 1) : base,
    reps: item.reps[wi.phaseIdx],
    rest: item.rest,
    rpe: wi.rpe,
    deload: wi.deload,
  };
}

export const PROGRESSION_RULES = [
  'Double progression : tu restes à la même charge jusqu’à atteindre le haut de la fourchette sur toutes les séries, puis tu ajoutes la plus petite charge possible (le carnet te la propose).',
  'Trop facile (plus de 3 reps en réserve) : monte la charge dès la série suivante. Impossible de finir la fourchette basse : redescends de 5–10 %.',
  'Repos : 2–3 min sur les mouvements lourds, 60–90 s sur l’isolation. Le chrono démarre quand tu valides une série.',
  'Décharges en semaines 6, 12 et 18 : une série de moins et −10 % de charge. Ne les saute pas, elles servent la progression.',
  'Douleur articulaire aiguë : stop, remplace le mouvement par une variante sans douleur et préviens ton médecin si ça dure.',
];

// ───────────── Plan de course (mardi = A, vendredi = B) ─────────────
const A_KM = [3, 3.5, 4, 4.5, 5, 4, 5.5, 6, 6.5, 7, 7.5, 6, 8, 8.5, 9, 9.5, 10, 10];
const B_KM = [2.5, 3, 3, 3.5, 3.5, 3, 4.5, 5.5, 6, 6.5, 6, 4, 5, 5, 5.5, 6, 5.5, 4];
const TEMPO_BLOCKS = { 7: [3, 4], 8: [3, 5], 9: [3, 6], 10: [3, 7], 11: [2, 10], 12: [2, 4] };
const TEMPO_CONT = { 13: 12, 14: 14, 15: 16, 16: 18, 17: 15 };
const fmtKm = (x) => String(x).replace('.', ',');

function runA(n) {
  const km = A_KM[n - 1];
  const base = { id: 'A', km, name: 'Endurance Zone 2', day: 'Mardi', rpe: '4–5' };
  if (n === 18) return { ...base, title: 'TEST · 10 km facile', detail: 'Pars lentement et garde une allure où tu peux parler. Le but est de finir 10 km sans être dans le rouge. Pas de chrono à battre.' };
  if (n === 17) return { ...base, title: `Zone 2 · ${fmtKm(km)} km`, detail: 'Premier 10 km : pars 30 s/km plus lent que ton allure facile, bois avant, finis en pouvant parler. Si c’est dur, refais 9,5 km la semaine suivante.' };
  if (n === 6 || n === 12) return { ...base, title: `Zone 2 · ${fmtKm(km)} km`, detail: 'Semaine de décharge : même allure facile, distance réduite.' };
  if (n <= 4) return { ...base, title: `Zone 2 · ${fmtKm(km)} km`, detail: 'Trot très lent. Marche 1 min toutes les 8–10 min si besoin. On construit la durée, pas la vitesse.' };
  return { ...base, title: `Zone 2 · ${fmtKm(km)} km`, detail: 'Allure conversation. Si tu ne peux plus parler, ralentis.' };
}

function runB(n) {
  const km = B_KM[n - 1];
  const base = { id: 'B', km, name: 'Progression / Tempo', day: 'Vendredi', rpe: '6–7' };
  if (n <= 5 || n === 6) {
    const fast = Math.max(1, Math.round(km * 0.4 * 2) / 2);
    return { ...base, title: `Progression · ${fmtKm(km)} km`, detail: `${fmtKm(km - fast)} km facile, puis ${fmtKm(fast)} km un cran plus vite (RPE 6–7). 3 min de marche pour finir.` };
  }
  if (TEMPO_BLOCKS[n]) {
    const [rep, min] = TEMPO_BLOCKS[n];
    return { ...base, title: `Tempo en blocs · ${rep} × ${min} min`, detail: `Échauffement 8–10 min facile, puis ${rep} × ${min} min à allure tempo (RPE 7 : tu peux dire des mots, pas des phrases), 2 min de trot lent entre les blocs, retour au calme 5 min. ≈ ${fmtKm(km)} km.` };
  }
  if (TEMPO_CONT[n]) {
    return { ...base, title: `Tempo continu · ${TEMPO_CONT[n]} min`, detail: `Échauffement 10 min facile, puis ${TEMPO_CONT[n]} min continues à allure tempo (RPE 7), retour au calme 8 min. ≈ ${fmtKm(km)} km.` };
  }
  return { ...base, title: `Rodage · ${fmtKm(km)} km`, detail: 'Très facile pour arriver frais au test de mardi. En option : 3 accélérations de 20 s à la fin.' };
}

export const RUN_PLAN = Array.from({ length: WEEKS }, (_, i) => {
  const n = i + 1;
  const A = runA(n), B = runB(n);
  return { n, A, B, km: A.km + B.km };
});

export const RUN_ZONES = [
  { name: 'Zone 2 (endurance)', rpe: '4–5 / 10', hr: '≈ 130–150 bpm', talk: 'Tu tiens une conversation en phrases complètes.' },
  { name: 'Tempo (confortablement dur)', rpe: '7 / 10', hr: '≈ 160–175 bpm', talk: 'Quelques mots à la fois, pas de phrases.' },
];

/** minutes estimées pour une distance à l'allure facile (secondes par km) */
export const estMinutes = (km, paceSec) => Math.round((km * paceSec) / 60);
export const parsePace = (s) => {
  const m = String(s).match(/^(\d{1,2})[:'](\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 390;
};
