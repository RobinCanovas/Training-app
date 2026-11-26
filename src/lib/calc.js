import { MEALS, DAY_TYPES, RAMP, mealFor, variantsFor, rampFactor, rampDeficit } from '../data/nutrition.js';
import { START_DATE, WEEKS, planForDow, KEY_LIFTS, parseRange, RUN_PLAN } from '../data/program.js';
import { dow, toMin, weekIndex, weekStart, weekEnd, addDays, diffDays, fmtNum, todayISO } from './dates.js';

export const num = (v) => {
  if (v === '' || v == null) return NaN;
  const x = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(x) ? x : NaN;
};
export const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const sum = (a) => a.reduce((x, y) => x + y, 0);

// ───────────── Planning du jour ─────────────
export const scheduleFor = (date) => planForDow(dow(date));

/** Programme d’une journée en tenant compte d’une séance de salle retirée pour cette date. */
/** Séance retirée ce jour-là. Dès qu'un carnet est ouvert pour cette date, la séance compte de nouveau. */
export const isSkipped = (state, date) => !!state.days[date]?.skipGym && !state.gym[date];

export function scheduleOn(state, date) {
  const s = scheduleFor(date);
  if (s?.type === 'gym' && isSkipped(state, date)) return { dow: s.dow, type: 'rest', skipped: s, label: 'Séance retirée', hint: 'Repos : tes repas, le shake et l’eau comptent comme d’habitude.' };
  return s;
}

/** Séances de salle prévues depuis le départ jusqu’à `today` (séances retirées exclues) et nombre de séances retirées. */
export function gymPlanned(state, today = todayISO()) {
  let planned = 0, skipped = 0;
  const n = diffDays(today, START_DATE);
  for (let i = 0; i <= n && i < WEEKS * 7; i++) {
    const d = addDays(START_DATE, i);
    if (scheduleFor(d)?.type !== 'gym') continue;
    if (isSkipped(state, d)) skipped++; else planned++;
  }
  return { planned, skipped };
}

export function isRunDay(state, date) {
  return scheduleFor(date)?.type === 'run' || !!state.runs[date];
}
export const dayTypeFor = (state, date) => (isRunDay(state, date) ? 'run' : 'std');

// ───────────── Poids ─────────────
export function latestWeight(state) {
  const dates = Object.keys(state.weights).filter((d) => Number.isFinite(num(state.weights[d]))).sort();
  if (!dates.length) return { date: null, kg: state.settings.startWeight };
  const d = dates[dates.length - 1];
  return { date: d, kg: num(state.weights[d]) };
}

/** Tendance du poids : moyenne des pesées des 7 derniers jours jusqu'à `date`, et écart avec les 7 jours d'avant (le poids du matin varie de ±0,5 kg, la moyenne est plus fiable). */
export function weightTrend(state, date) {
  const avg = (from, to) => {
    const v = [];
    for (let i = from; i <= to; i++) { const k = num(state.weights[addDays(date, -i)]); if (Number.isFinite(k)) v.push(k); }
    return v.length ? { m: sum(v) / v.length, n: v.length } : null;
  };
  const cur = avg(0, 6), prev = avg(7, 13);
  if (!cur || cur.n < 3) return null;
  return { avg: cur.m, n: cur.n, perWeek: prev && prev.n >= 3 ? cur.m - prev.m : null };
}

/** Moyennes hebdomadaires (semaine de programme) */
export function weeklyAverages(state) {
  const acc = {};
  for (const [d, v] of Object.entries(state.weights)) {
    const kg = num(v);
    const n = weekIndex(d);
    if (!Number.isFinite(kg) || n < 1 || n > WEEKS) continue;
    (acc[n] = acc[n] || []).push(kg);
  }
  return Object.entries(acc).map(([n, a]) => ({ n: Number(n), avg: sum(a) / a.length, count: a.length })).sort((x, y) => x.n - y.n);
}

export const targetAtWeek = (settings, n) => settings.startWeight + ((settings.targetWeight - settings.startWeight) * n) / WEEKS;
/** trajectoire cible (poids attendu à une date) */
export const targetOnDate = (settings, date) => {
  const days = diffDays(date, START_DATE);
  const f = Math.min(Math.max(days / (WEEKS * 7), 0), 1);
  return settings.startWeight + (settings.targetWeight - settings.startWeight) * f;
};

export function coach(state, today = todayISO()) {
  const S = state.settings;
  // une semaine ne compte que si elle a au moins 3 pesées : une pesée isolée ne doit pas piloter les calories
  const wk = weeklyAverages(state).filter((w) => w.count >= 3);
  if (wk.length < 2) {
    return { level: 'info', title: 'Pèse-toi chaque matin à jeun', text: `Il faut deux semaines de pesées (au moins 3 par semaine) pour piloter les calories. D’ici là, suis le plan du jour sans rien changer : la dose du shake monte toute seule, de semaine en semaine.`, rate: null, projection: null };
  }
  const delta = (a, b) => (b.avg - a.avg) / (b.n - a.n);
  const last = wk[wk.length - 1];
  const r1 = delta(wk[wk.length - 2], last);
  const r2 = wk.length >= 3 ? delta(wk[wk.length - 3], wk[wk.length - 2]) : null;
  const rAvg = (last.avg - wk[0].avg) / (last.n - wk[0].n);
  const remaining = Math.max(0, WEEKS - last.n);
  const projection = last.avg + rAvg * remaining;
  const rate = fmtNum(r1, 2);
  let res;
  if (r1 < 0) res = { level: 'critical', title: 'Tu perds du poids', text: `${rate} kg cette semaine. Ajoute 250 kcal par jour dès demain (ex. 250 ml de lait entier + 1 banane, ≈ 270 kcal) et vérifie les repas oubliés dans ton historique.` };
  else if (r1 > 0.5) res = { level: 'warning', title: 'Prise trop rapide', text: `+${rate} kg cette semaine. Retire environ 150 kcal par jour (ex. 1 c. à soupe d’huile d’olive + 20 g de miel) : au-delà de 0,5 kg par semaine, la part de gras augmente.` };
  else if (r1 < 0.25 && r2 !== null && r2 < 0.25) res = { level: 'serious', title: 'Trop lent depuis 2 semaines', text: `+${rate} kg puis +${fmtNum(r2, 2)} kg : ajoute 150 à 200 kcal par jour (ex. 250 ml de lait entier en plus, ≈ 160 kcal). Réévalue dans 2 semaines.` };
  else if (r1 < 0.2) res = { level: 'warning', title: 'Un peu lent cette semaine', text: `+${rate} kg. Surveille une semaine de plus : si c’est encore sous 0,25 kg, on ajoute 150–200 kcal par jour.` };
  else res = { level: 'good', title: 'Zone verte', text: `+${rate} kg cette semaine (zone visée : 0,20 à 0,50 kg). Ne change rien.` };
  // pendant la montée en charge, un rythme encore lent est normal : on ne corrige pas les calories avant la dose pleine
  if (rampFactor(last.n) < 1 && r1 >= 0 && r1 <= 0.5 && res.level !== 'good') {
    res = { level: 'info', title: 'Montée en charge en cours', text: `+${rate} kg cette semaine. Le shake n’est pas encore à dose pleine (${Math.round(rampFactor(last.n) * 100)} %) : ce rythme est normal, on juge les calories à partir de la semaine ${RAMP.length + 1}.` };
  }
  return { ...res, rate: r1, projection };
}

// ───────────── Course : calories, allure ─────────────
/** Calories d’une sortie : la valeur de la montre / de Strava si elle est saisie, sinon ≈ 1 kcal par kg et par km, avec 100 m de D+ comptés comme 1 km. */
export function runKcal(run, weight) {
  if (!run) return 0;
  const given = num(run.kcal);
  if (given > 0) return Math.round(given);
  const km = num(run.km);
  if (!(km > 0)) return 0;
  const up = num(run.elev);
  return Math.round(weight * (km + (up > 0 ? up / 100 : 0)));
}
/** Pas faits pendant la course : cadence × durée si la cadence est connue, sinon ≈ 1 100 pas par km à allure facile. */
export function runSteps(run) {
  if (!run) return 0;
  const cad = num(run.cad), sec = num(run.sec), km = num(run.km);
  if (cad > 0 && sec > 0) return Math.round((cad * sec) / 60);
  return km > 0 ? Math.round(km * 1100) : 0;
}
export const paceSec = (run) => { const km = num(run?.km), sec = num(run?.sec); return km > 0 && sec > 0 ? sec / km : NaN; };

// ───────────── Pacerio / activité ─────────────
// Calories actives estimées à partir des pas : foulée = 0,414 × taille, marche à 4,8 km/h = 3,5 MET, dont 1 MET de repos retiré
// (les calories « actives » ne comptent pas le métabolisme de repos). Valeur de départ, remplacée par ta propre pente dès 3 jours avec pas ET calories.
export function defaultKcalPerStep(heightCm, weightKg) {
  const stride = 0.414 * (heightCm / 100);
  const minPerStep = stride / 1.34 / 60;
  return (minPerStep * 2.5 * 3.5 * weightKg) / 200;
}

export function kcalPerStep(state, date) {
  const weight = latestWeight(state).kg;
  const h = num(state.settings.heightCm);
  const def = defaultKcalPerStep(h > 100 && h < 230 ? h : 174, weight);
  const ratios = [];
  for (let i = 1; i <= 28; i++) {
    const d = addDays(date, -i);
    const p = state.days[d]?.pacerio;
    if (p && p.kcal > 0 && p.steps >= 2000 && !isRunDay(state, d)) ratios.push(p.kcal / p.steps);
  }
  if (ratios.length >= 3) return { value: median(ratios), calibrated: true, n: ratios.length };
  return { value: def, calibrated: false, n: ratios.length };
}

/** Calories actives du jour : mesurées (Pacerio) ou estimées à partir des pas (marche + course du jour). */
export function activeFor(state, date, slope) {
  const p = state.days[date]?.pacerio;
  if (p && p.kcal > 0) return { kcal: Math.round(p.kcal), src: 'mesure', steps: p.steps > 0 ? p.steps : undefined };
  if (p && p.steps > 0) {
    const s = slope || kcalPerStep(state, date);
    const run = state.runs[date];
    const hasRun = run && num(run.km) > 0;
    const rk = hasRun ? runKcal(run, latestWeight(state).kg) : 0;
    const walkSteps = Math.max(0, p.steps - (hasRun ? runSteps(run) : 0));
    const walk = Math.round(walkSteps * s.value);
    return { kcal: walk + rk, walk, run: rk, src: 'estimé', steps: p.steps, slope: s };
  }
  return null;
}

export function referenceActive(state, today = todayISO()) {
  const S = state.settings;
  if (S.refMode !== 'auto') return { value: S.refActive, auto: false, known: true };
  const slope = kcalPerStep(state, today);
  const vals = [];
  for (let i = 1; i <= 21; i++) {
    const d = addDays(today, -i);
    if (isRunDay(state, d)) continue;
    const a = activeFor(state, d, slope);
    if (a) vals.push(a.kcal);
  }
  if (vals.length >= 3) return { value: Math.round(median(vals)), auto: true, n: vals.length, known: true };
  return { value: S.refActive, auto: false, known: false };
}

export function targetsFor(state, date) {
  const S = state.settings;
  const ref = referenceActive(state, date);
  const run = state.runs[date];
  const weight = latestWeight(state).kg;
  const act = activeFor(state, date);
  let bonus = 0, src = 'none', note = '';
  if (act && act.src === 'mesure') {
    bonus = Math.max(0, Math.round(act.kcal - ref.value));
    src = 'pacerio';
    note = `${act.kcal} kcal actives − ${ref.value} de référence`;
  } else if (act) {
    // pas seuls : calories actives estimées, comparées à ta journée type (même échelle), la course comptant en entier tant que la journée type est inconnue
    bonus = ref.known ? Math.max(0, Math.round(act.kcal - ref.value)) : act.run;
    src = 'steps';
    note = ref.known
      ? `≈ ${act.kcal} kcal actives estimées − ${ref.value} de référence`
      : `≈ ${act.kcal} kcal actives estimées ; ta journée type n’est pas encore connue (il faut 3 jours avec des pas), seule la course compte pour l’instant`;
  } else if (run && num(run.km) > 0) {
    bonus = runKcal(run, weight);
    src = 'run';
    note = num(run.kcal) > 0 ? `${bonus} kcal notées pour la sortie`
      : `${fmtNum(num(run.km), 1)} km${num(run.elev) > 0 ? ` + ${Math.round(num(run.elev))} m de D+` : ''} × ${fmtNum(weight, 0)} kg ≈ ${bonus} kcal`;
  } else if (scheduleFor(date)?.type === 'run') {
    bonus = S.runBonus;
    src = 'plan';
    note = 'bonus prévu pour un jour de course';
  }
  const ramp = rampDeficit(weekIndex(date));
  const kcal = S.baseKcal - ramp + bonus;
  return { kcal, base: S.baseKcal - ramp, ramp, p: S.protein, f: S.fat, c: S.carbMin - Math.round((ramp * 0.8) / 4) + Math.round((bonus * 0.75) / 4), bonus, src, note, ref, active: act };
}

// ───────────── Repas : valeurs du plan ou valeurs saisies ─────────────
const stdMacros = () => DAY_TYPES.std.macros;
/** Macros estimées pour un nombre de calories libre, d’après la répartition moyenne de ton plan (P / G / L). */
export function estimateMacros(k) {
  const m = stdMacros();
  const tot = m.p * 4 + m.c * 4 + m.f * 9;
  return { k: Math.round(k), p: Math.round((k * ((m.p * 4) / tot)) / 4), c: Math.round((k * ((m.c * 4) / tot)) / 4), f: Math.round((k * ((m.f * 9) / tot)) / 9) };
}
export const splitShares = () => { const m = stdMacros(); const tot = m.p * 4 + m.c * 4 + m.f * 9; return { p: Math.round(((m.p * 4) / tot) * 100), c: Math.round(((m.c * 4) / tot) * 100), f: Math.round(((m.f * 9) / tot) * 100) }; };
/** Les macros d’un repas du plan, mises à l’échelle d’un autre nombre de calories. */
export function scaleMacros(plan, k) {
  const f = plan.k > 0 ? k / plan.k : 1;
  return { k: Math.round(k), p: Math.round(plan.p * f), c: Math.round(plan.c * f), f: Math.round(plan.f * f) };
}
/** Heure d'un repas : le petit-déjeuner suit le réveil noté (réveil + 30 min), les autres suivent les horaires réglés. */
export function mealTime(state, date, id) {
  const w = state.days[date]?.wake;
  if (id === 'bkf' && /^\d{1,2}:\d{2}$/.test(w || '')) {
    const m = (toMin(w) + 30) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  return state.settings.times[dayTypeFor(state, date)][id];
}
export const suppOn = (d, id) => (id === 'creatine' ? !!d.creatine : !!d.supp?.[id]);
/** Options de composition d’un jour : semaine du programme, whey dans le shake, variantes choisies. */
export const planOpts = (state, date) => ({ week: weekIndex(date), whey: state.settings.wheyOn !== false, variants: variantsFor(state.settings, weekIndex(date)) });
/** Le repas tel qu’il a été (ou sera) servi ce jour-là : la variante cochée ce jour-là prime sur le choix du moment. */
export function mealAt(state, date, id) {
  const o = planOpts(state, date);
  return mealFor(id, { ...o, variant: state.days[date]?.mealVar?.[id] || o.variants[id] });
}
export const mealMacros = (state, date, id) => state.days[date]?.mealEdits?.[id] || mealAt(state, date, id).macros;

export function consumedFor(state, date) {
  const d = state.days[date] || {};
  const type = dayTypeFor(state, date);
  let k = 0, p = 0, c = 0, f = 0;
  for (const id of DAY_TYPES[type].meals) {
    if (d.meals?.[id]) { const m = mealMacros(state, date, id); k += m.k; p += m.p; c += m.c; f += m.f; }
  }
  for (const e of d.extras || []) { k += e.k; p += e.p; c += e.c; f += e.f; }
  return { k, p, c, f };
}

// ───────────── Import Pacerio / Santé ─────────────
function parseNumber(s) {
  let t = String(s).replace(/[\s  ]/g, '');
  const hasDot = t.includes('.'), hasComma = t.includes(',');
  if (hasDot && hasComma) {
    t = t.lastIndexOf('.') > t.lastIndexOf(',') ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = t.split(sep);
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) t = parts.join('');
    else t = parts.join('.');
  }
  const x = parseFloat(t);
  return Number.isFinite(x) ? x : NaN;
}

const KEY_DATE = /^(date|day|jour|startdate|start|d[ée]but)/i;
const KEY_STEPS = /(step|pas\b|pas_|nombre.*pas)/i;
const KEY_KCAL = /(active|actif|kcal|calor|energy|[ée]nergie)/i;

function normDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  let m = s.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function fromRecords(records) {
  const byDate = {};
  records.forEach((rec, i) => {
    let date = null, steps, kcal;
    for (const [k, v] of Object.entries(rec)) {
      if (v == null || typeof v === 'object') continue;
      if (KEY_DATE.test(k) && !date) date = normDate(v);
      else if (KEY_STEPS.test(k) && steps == null) { const x = parseNumber(v); if (!Number.isNaN(x)) steps = x; }
      else if (KEY_KCAL.test(k) && kcal == null) { const x = parseNumber(v); if (!Number.isNaN(x)) kcal = x; }
    }
    if (steps == null && kcal == null) return;
    const key = date || '_';
    const row = byDate[key] || (byDate[key] = { date, steps: 0, kcal: 0, hasS: false, hasK: false, i });
    if (steps != null) { row.steps += steps; row.hasS = true; }
    if (kcal != null) { row.kcal += kcal; row.hasK = true; }
  });
  return Object.values(byDate).map((r) => ({ date: r.date, steps: r.hasS ? Math.round(r.steps) : undefined, kcal: r.hasK ? Math.round(r.kcal) : undefined }));
}

export function parseHealthText(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  // JSON
  if (t[0] === '{' || t[0] === '[') {
    try {
      const j = JSON.parse(t);
      const find = (o) => {
        if (Array.isArray(o)) return o.every((x) => x && typeof x === 'object' && !Array.isArray(x)) ? o : null;
        if (o && typeof o === 'object') {
          for (const v of Object.values(o)) { if (Array.isArray(v)) { const r = find(v); if (r && r.length) return r; } }
          return [o];
        }
        return null;
      };
      const recs = find(j);
      if (recs) { const rows = fromRecords(recs); if (rows.length) return rows; }
    } catch (e) { /* retombe sur le texte libre */ }
  }
  // CSV / TSV
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2) {
    const delim = [';', '\t', ','].find((d) => lines[0].split(d).length >= 2);
    if (delim) {
      const head = lines[0].split(delim).map((h) => h.replace(/^"|"$/g, '').trim());
      if (head.some((h) => KEY_STEPS.test(h) || KEY_KCAL.test(h))) {
        const recs = lines.slice(1).map((l) => {
          const cells = l.split(delim).map((c) => c.replace(/^"|"$/g, '').trim());
          return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
        });
        const rows = fromRecords(recs);
        if (rows.length) return rows;
      }
    }
  }
  // Texte libre : « Pas : 8 450 · Calories actives : 620 kcal »
  // La date éventuelle est lue à part, puis retirée du texte : « 26/11/2026 Pas : 8450 » ne doit pas prendre « 2026 » pour des pas.
  const date = normDate(t);
  const tt = t.replace(/\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/g, ' ').trim();
  let steps, kcal;
  const num1 = '(\\d[\\d\\s\\u00a0\\u202f.,]*\\d|\\d)';
  const mS = tt.match(new RegExp(`${num1}\\s*(?:pas|steps)\\b`, 'i')) || tt.match(new RegExp(`(?:pas|steps)\\s*[:=\\-]?\\s*${num1}`, 'i'));
  if (mS) steps = parseNumber(mS[1]);
  const mK = tt.match(new RegExp(`(?:kcal|calories?|cal|énergie|energie|energy|active)[^\\d]{0,24}?${num1}`, 'i')) || tt.match(new RegExp(`${num1}\\s*(?:kcal|cal)\\b`, 'i'));
  if (mK) kcal = parseNumber(mK[1]);
  if (steps == null || Number.isNaN(steps)) steps = undefined;
  if (kcal == null || Number.isNaN(kcal)) kcal = undefined;
  if (steps == null && kcal == null) {
    // Deux nombres seuls (« 8450 620 », « 8 450;620 ») : le plus grand = pas, le plus petit = kcal actives
    // un nombre : milliers séparés par un espace (simple, insécable ou fine), un point ou une virgule, ou nombre simple
    const NB = '(\\d{1,3}(?:[ \\u00a0\\u202f.,]\\d{3})+|\\d+(?:[.,]\\d+)?)';
    const m2 = tt.match(new RegExp(`^\\s*${NB}\\s*(?:[;/|\\t ]|,\\s)\\s*${NB}\\s*$`));
    if (!m2) return [];
    const nums = [parseNumber(m2[1]), parseNumber(m2[2])];
    if (nums.some(Number.isNaN)) return [];
    steps = Math.round(Math.max(...nums));
    kcal = Math.round(Math.min(...nums));
  }
  return [{ date, steps: steps != null ? Math.round(steps) : undefined, kcal: kcal != null ? Math.round(kcal) : undefined }];
}

// ───────────── Import de course (Strava, montre, CSV) ─────────────
const MONTH_NUM = { jan: 1, janv: 1, january: 1, janvier: 1, feb: 2, fev: 2, févr: 2, fevr: 2, february: 2, février: 2, fevrier: 2, mar: 3, mars: 3, march: 3, apr: 4, avr: 4, april: 4, avril: 4, may: 5, mai: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, july: 7, juillet: 7, aug: 8, aout: 8, août: 8, august: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, déc: 12, december: 12, décembre: 12, decembre: 12 };
const p2 = (n) => String(n).padStart(2, '0');
function looseDate(v) {
  const iso = normDate(v);
  if (iso) return iso;
  const s = String(v || '');
  let m = s.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]{3,10})\.?,?\s+(\d{4})/);
  if (m && MONTH_NUM[m[2].toLowerCase()]) return `${m[3]}-${p2(MONTH_NUM[m[2].toLowerCase()])}-${p2(m[1])}`;
  m = s.match(/([A-Za-zÀ-ÿ]{3,10})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTH_NUM[m[1].toLowerCase()]) return `${m[3]}-${p2(MONTH_NUM[m[1].toLowerCase()])}-${p2(m[2])}`;
  return null;
}
const toSec = (h, m, s) => (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);

/** Durée lue dans un texte : 1:02:10, 28:31, 1h02m10s, 1 h 02 min, 28m 31s, 45 min. Renvoie { sec, raw } ou null. */
function durationFrom(t) {
  let m = t.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return { sec: toSec(m[1], m[2], m[3]), raw: m[0] };
  m = t.match(/(\d{1,2})\s*h(?:eures?)?\s*(\d{1,2})\s*(?:min|mn|m)?\s*(?:(\d{1,2})\s*(?:s|sec)\b)?/i) || t.match(/(\d{1,2})\s*h(?:eures?)?\b/i);
  if (m) return { sec: toSec(m[1], m[2], m[3]), raw: m[0] };
  m = t.match(/(\d{1,3})\s*m\s*(\d{1,2})\s*s\b/i) || t.match(/(\d{1,3})\s*(?:min|mn)\b\s*(?:(\d{1,2})\s*(?:s|sec)\b)?/i);
  if (m) return { sec: toSec(0, m[1], m[2]), raw: m[0] };
  m = t.match(/(?<![\d:])(\d{1,3}):(\d{2})(?![\d:])/);
  if (m) return { sec: toSec(0, m[1], m[2]), raw: m[0] };
  return null;
}

function parseRunFree(src) {
  let t = ` ${String(src).replace(/[  ]/g, ' ')} `;
  const out = {};
  const date = looseDate(t);
  if (date) out.date = date;
  // dates et heures de la journée retirées : « 18:30 » ne doit pas passer pour une durée
  const clock = '(?:[ ,T]+(?:à|a|at)?\\s*\\d{1,2}[:h]\\d{2}(?::\\d{2})?(?:\\.\\d+)?Z?)?';
  t = t.replace(new RegExp(`\\d{4}[-/]\\d{2}[-/]\\d{2}${clock}`, 'g'), ' ')
    .replace(new RegExp(`\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}${clock}`, 'g'), ' ')
    .replace(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s+[A-Za-zÀ-ÿ]{3,10}\\.?,?\\s+\\d{4}\\b${clock}`, 'g'), ' ')
    .replace(new RegExp(`\\b[A-Za-zÀ-ÿ]{3,10}\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b${clock}`, 'g'), ' ');
  // allure
  let pace = NaN;
  const mP = t.match(/(\d{1,2})[:'’](\d{2})\s*(?:["”″])?\s*(?:\/|min\s*\/|par\s+|per\s+)\s*(km|mi)\b/i);
  if (mP) { pace = Number(mP[1]) * 60 + Number(mP[2]); if (/mi/i.test(mP[3])) pace /= 1.609344; t = t.replace(mP[0], ' '); }
  else {
    const mP2 = t.match(/(?:allure|pace)[^\d\n]{0,18}?(\d{1,2})[:'’](\d{2})/i);
    if (mP2) { pace = Number(mP2[1]) * 60 + Number(mP2[2]); t = t.replace(mP2[0], ' '); }
  }
  // distance
  let km = NaN;
  const mD = t.match(/(\d+(?:[.,]\d+)?)\s*(km|kilom[eè]tres?|mi|miles?)\b/i);
  if (mD) { km = parseNumber(mD[1]); if (/^mi/i.test(mD[2])) km *= 1.609344; t = t.replace(mD[0], ' '); }
  else {
    const mD2 = t.match(/distance[^\d\n]{0,10}(\d+(?:[.,]\d+)?)\s*(m)?\b/i);
    if (mD2) { const v = parseNumber(mD2[1]); km = (mD2[2] || v > 100) ? v / 1000 : v; t = t.replace(mD2[0], ' '); }
  }
  // dénivelé positif
  const eRe = [
    /(?:d\s*\+|d[ée]nivel[ée](?:\s+positif)?|elev(?:ation)?(?:\s+gain)?|gain\s+d['’]altitude|ascent|mont[ée]e)[^\d\n]{0,18}?(\d+(?:[.,]\d+)?)\s*(m|ft)?(?![a-z])/i,
    /(\d+(?:[.,]\d+)?)\s*(m|ft)\s*(?:d\s*\+|de\s+d[ée]nivel[ée]|\+)/i,
    /[↑▲⬆]\s*(\d+(?:[.,]\d+)?)\s*(m|ft)?(?![a-z])/i,
  ];
  let elev = NaN;
  for (const re of eRe) {
    const m = t.match(re);
    if (m) { let v = parseNumber(m[1]); if (/ft/i.test(m[2] || '')) v *= 0.3048; if (Number.isFinite(v)) { elev = v; t = t.replace(m[0], ' '); break; } }
  }
  // fréquence cardiaque (max d’abord, pour ne pas la prendre pour la moyenne)
  let hr = NaN, hrMax = NaN;
  const mMax = t.match(/(?:fc\s*max|hr\s*max|max(?:imum|imale)?\.?\s*(?:hr|fc|heart\s*rate|fr[ée]quence\s+cardiaque|bpm)?)[^\d\n]{0,14}?(\d{2,3})(?!\d)/i);
  if (mMax) { const v = Number(mMax[1]); if (v >= 80 && v <= 230) { hrMax = v; t = t.replace(mMax[0], ' '); } }
  const mHr = t.match(/(?:fc|hr|heart\s*rate|fr[ée]quence\s+cardiaque|fr[ée]q\.?\s*card\.?)(?:\s*(?:moy(?:enne)?\.?|avg|average))?[^\d\n]{0,14}?(\d{2,3})(?!\d)/i) || t.match(/(\d{2,3})\s*bpm/i);
  if (mHr) { const v = Number(mHr[1]); if (v >= 40 && v <= 230) { hr = v; t = t.replace(mHr[0], ' '); } }
  // calories, cadence, effort
  let kcal = NaN, cad = NaN, rpe = NaN;
  const mK = t.match(/(\d{2,4})\s*(?:kcal|cal)\b/i) || t.match(/(?:calories?|kcal|[ée]nergie|energy)[^\d\n]{0,14}?(\d{2,4})(?!\d)/i);
  if (mK) { kcal = Number(mK[1]); t = t.replace(mK[0], ' '); }
  const mC = t.match(/(\d{2,3})\s*(?:spm|ppm|pas\s*\/\s*min|steps\s*\/\s*min)\b/i) || t.match(/cadence[^\d\n]{0,14}?(\d{2,3})(?!\d)/i);
  if (mC) { const v = Number(mC[1]); if (v >= 100 && v <= 230) { cad = v; t = t.replace(mC[0], ' '); } }
  const mR = t.match(/\brpe\b[^\d\n]{0,10}?(\d{1,2})(?!\d)/i);
  if (mR) { const v = Number(mR[1]); if (v >= 1 && v <= 10) rpe = v; }
  // durée
  let sec = NaN;
  const du = durationFrom(t);
  if (du && du.sec > 0) sec = du.sec;
  if (!(sec > 0) && pace > 0 && km > 0) sec = Math.round(pace * km);
  if (Number.isFinite(km) && km > 0) out.km = Math.round(km * 100) / 100;
  if (Number.isFinite(sec) && sec > 0) out.sec = Math.round(sec);
  if (Number.isFinite(elev) && elev > 0) out.elev = Math.round(elev);
  if (Number.isFinite(hr)) out.hr = hr;
  if (Number.isFinite(hrMax)) out.hrMax = hrMax;
  if (Number.isFinite(kcal) && kcal > 0) out.kcal = Math.round(kcal);
  if (Number.isFinite(cad)) out.cad = cad;
  if (Number.isFinite(rpe)) out.rpe = rpe;
  return out.km || out.sec ? out : null;
}

/** Une ligne d’un CSV ou d’un JSON (export Strava, API, montre) → course. */
function runFromRecord(rec) {
  const entries = Object.entries(rec).map(([k, v]) => [String(k).toLowerCase().trim(), v]);
  const get = (re) => { for (const [k, v] of entries) if (re.test(k) && v != null && typeof v !== 'object' && String(v).trim() !== '') return v; return undefined; };
  const type = get(/^(activity[ _]?)?type$|^sport/);
  if (type != null && !/run|course|trail|jog|marche|walk/i.test(String(type))) return null;
  const out = {};
  const d = get(/date|start/);
  if (d != null) { const iso = looseDate(d); if (iso) out.date = iso; }
  const dist = get(/^distance/);
  if (dist != null) { const v = parseNumber(dist); if (Number.isFinite(v) && v > 0) out.km = Math.round((v > 100 ? v / 1000 : v) * 100) / 100; }
  const tm = get(/moving[ _]?time|temps[ _]en[ _]mouvement/) ?? get(/duration|dur[ée]e|^time$|elapsed[ _]?time|temps/);
  if (tm != null) {
    const s = String(tm).trim();
    if (/^\d+(\.\d+)?$/.test(s)) out.sec = Math.round(Number(s));
    else { const du = durationFrom(s); if (du) out.sec = du.sec; }
  }
  const el = get(/elev.*gain|total[ _]elevation[ _]gain|d[ée]nivel[ée]|d\+|ascent/);
  if (el != null) { const v = parseNumber(el); if (Number.isFinite(v) && v > 0) out.elev = Math.round(v); }
  const hr = get(/average[ _]?heart|avg[ _]?hr|fc[ _]?moy|average_heartrate|fr[ée]quence.*moy/);
  if (hr != null) { const v = parseNumber(hr); if (v >= 40 && v <= 230) out.hr = Math.round(v); }
  const hm = get(/max[ _]?heart|max[ _]?hr|fc[ _]?max|max_heartrate/);
  if (hm != null) { const v = parseNumber(hm); if (v >= 80 && v <= 230) out.hrMax = Math.round(v); }
  const kc = get(/calor|kcal/);
  if (kc != null) { const v = parseNumber(kc); if (v > 0) out.kcal = Math.round(v); }
  const cd = get(/cadence/);
  if (cd != null) { let v = parseNumber(cd); if (v > 0 && v < 120) v *= 2; if (v >= 100 && v <= 230) out.cad = Math.round(v); }
  return out.km || out.sec ? out : null;
}

/** Texte collé ou fichier → liste de courses { date?, km?, sec?, elev?, hr?, hrMax?, kcal?, cad?, rpe? }. */
export function parseRunText(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    try {
      const j = JSON.parse(t);
      const list = Array.isArray(j) ? j : Array.isArray(j?.activities) ? j.activities : [j];
      const rows = list.filter((x) => x && typeof x === 'object').map(runFromRecord).filter(Boolean);
      if (rows.length) return rows;
    } catch (e) { /* retombe sur le texte libre */ }
  }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2) {
    const delim = [';', '\t', ','].find((dl) => lines[0].split(dl).length >= 3);
    if (delim && /dist|km|date|time|temps|dur[ée]e|elev|d[ée]niv/i.test(lines[0])) {
      const cut = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === delim && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((c) => c.trim()); };
      const head = cut(lines[0]);
      const rows = lines.slice(1).map((l) => { const cells = cut(l); return runFromRecord(Object.fromEntries(head.map((h, i) => [h, cells[i]]))); }).filter(Boolean);
      if (rows.length) return rows;
    }
  }
  const one = parseRunFree(t);
  return one ? [one] : [];
}

// ───────────── Bilan de la semaine ─────────────
export function weekSummary(state, n, today = todayISO()) {
  const S = state.settings;
  const start = weekStart(n);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today);
  const wa = weeklyAverages(state);
  const cur = wa.find((w) => w.n === n);
  const prev = wa.find((w) => w.n === n - 1);
  let kSum = 0, pSum = 0, tSum = 0, logged = 0, mealsDone = 0, mealsPlanned = 0, water = 0, creat = 0, gym = 0, km = 0, up = 0, runSec = 0, runN = 0;
  const sleeps = [], energies = [];
  for (const d of days) {
    const day = state.days[d] || {};
    const planned = DAY_TYPES[dayTypeFor(state, d)].meals;
    const done = planned.filter((id) => day.meals?.[id]).length;
    mealsPlanned += planned.length;
    mealsDone += done;
    if (done > 0 || (day.extras || []).length > 0) {
      const C = consumedFor(state, d);
      kSum += C.k; pSum += C.p; tSum += targetsFor(state, d).kcal; logged++;
    }
    if ((day.water || 0) >= S.water) water++;
    if (day.creatine) creat++;
    const g = state.gym[d];
    if (g && Object.values(g.ex || {}).some((l) => l.some((s) => s.done))) gym++;
    const r = state.runs[d];
    if (r && num(r.km) > 0) { km += num(r.km); up += num(r.elev) || 0; runSec += num(r.sec) || 0; runN++; }
    const c = day.checkin;
    if (c) {
      const sl = num(c.sleep); if (sl > 0 && sl < 24) sleeps.push(sl);
      const en = Number(c.energy); if (en >= 1 && en <= 5) energies.push(en);
    }
  }
  return {
    n, start, end: addDays(start, 6), elapsed: days.length,
    avg: cur ? cur.avg : null, count: cur ? cur.count : 0, delta: cur && prev ? cur.avg - prev.avg : null,
    logged, avgK: logged ? kSum / logged : null, avgP: logged ? pSum / logged : null, avgT: logged ? tSum / logged : null,
    mealsDone, mealsPlanned, water, creat, gym, km, up, runN, pace: km > 0 && runSec > 0 ? runSec / km : null,
    sleep: sleeps.length ? sum(sleeps) / sleeps.length : null, energy: energies.length ? sum(energies) / energies.length : null,
  };
}

// ───────────── Carnet de salle ─────────────
export function lastLogFor(state, exId, beforeDate) {
  const dates = Object.keys(state.gym).filter((d) => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const sets = state.gym[d]?.ex?.[exId];
    if (sets && sets.some((s) => s.done)) return { date: d, sets: sets.filter((s) => s.done) };
  }
  return null;
}

/** Double progression : à partir de la dernière séance, charge à tenter aujourd'hui */
export function suggestLoad(prev, rep, inc, bw) {
  const [lo, hi] = parseRange(rep);
  if (!prev) return { kg: null, text: bw ? `Objectif : ${rep}.` : '1ʳᵉ fois : choisis une charge qui te laisse 2–3 reps en réserve sur la dernière série.' };
  if (bw) {
    const best = Math.max(...prev.sets.map((s) => num(s.reps) || 0));
    return { kg: null, text: best >= hi ? `Dernière fois : ${best} s. Vise ${Math.min(best + 5, 120)} s.` : `Dernière fois : ${best} s. Vise +5 s.` };
  }
  const loads = prev.sets.map((s) => num(s.kg)).filter((x) => !Number.isNaN(x));
  if (!loads.length) return { kg: null, text: 'Entre ta charge pour garder un repère.' };
  const top = Math.max(...loads);
  const atTop = prev.sets.filter((s) => num(s.kg) === top);
  const all = atTop.length >= Math.min(prev.sets.length, 3) && atTop.every((s) => num(s.reps) >= hi);
  if (all && inc > 0) return { kg: top + inc, text: `Tout validé à ${top} kg → essaie ${top + inc} kg, vise ${lo}+ reps.` };
  const minReps = Math.min(...atTop.map((s) => num(s.reps) || 0));
  return { kg: top, text: `Reste à ${top} kg et vise ${Math.min(minReps + 1, hi)}+ reps par série (haut de fourchette : ${hi}).` };
}

export function keyLiftSeries(state) {
  const best = {};
  for (const [d, g] of Object.entries(state.gym)) {
    const n = weekIndex(d);
    if (n < 1 || n > WEEKS) continue;
    for (const lift of KEY_LIFTS) {
      const sets = g.ex?.[lift.id];
      if (!sets) continue;
      for (const s of sets) {
        const kg = num(s.kg);
        if (s.done && Number.isFinite(kg) && kg > 0) {
          const k = `${lift.id}:${n}`;
          if (!best[k] || kg > best[k]) best[k] = kg;
        }
      }
    }
  }
  return best;
}

export function runKmByWeek(state) {
  const acc = {};
  for (const [d, r] of Object.entries(state.runs)) {
    const n = weekIndex(d);
    const km = num(r.km);
    if (n < 1 || n > WEEKS || !Number.isFinite(km)) continue;
    acc[n] = (acc[n] || 0) + km;
  }
  return acc;
}

export { RUN_PLAN, weekStart, weekEnd };
