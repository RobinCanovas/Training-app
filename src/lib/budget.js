import { EQUIPMENT } from '../data/health.js';
import { FOODS } from '../data/foods.js';
import { weeklyShopping, MEALS, dayPlan, mealFor, variantsFor } from '../data/nutrition.js';
import { WEEKS } from '../data/program.js';
import { weekIndex, todayISO } from './dates.js';
import { num, latestWeight } from './calc.js';

export const CATS = ['Alimentation', 'Compléments', 'Matériel', 'Salle', 'Santé', 'Autre'];

// Semaine type de référence : la même que le générateur de courses (5 jours standard, 2 jours de course, marge de 10 %)
export const FOOD_PLAN = { stdDays: 5, runDays: 2, margin: true };
const DAYS_PER_MONTH = 365.25 / 12;
export const WEEKS_PER_MONTH = DAYS_PER_MONTH / 7;
export const PROGRAM_MONTHS = (WEEKS * 7) / DAYS_PER_MONTH;
// La whey est comptée avec les compléments : un seul prix pour tout le programme (≈ 3,2 kg), ramené au gramme pour le coût des repas
export const WHEY_GRAMS = 3200;

// Les alarmes du téléphone ne coûtent rien : pas de prix à saisir
export const PRICED = EQUIPMENT.filter((e) => e.id !== 'alarms');
const EQUIP_CAT = { gym: 'Salle' };
const EQUIP_LABEL = { gym: 'Sac de sport et accessoires (l’abonnement se règle plus bas)' };
export const equipCat = (e) => EQUIP_CAT[e.id] || (e.group === 'Compléments' ? 'Compléments' : 'Matériel');
export const equipLabel = (e) => EQUIP_LABEL[e.id] || e.name;

const wheyOn = (state) => state.settings.wheyOn !== false;
const optsFor = (state, week) => ({ week, whey: wheyOn(state), variants: variantsFor(state.settings, week) });
/** Aliments d'une semaine type (shake dosé selon la semaine, menus choisis), sans la whey (comptée avec les compléments). */
export const foodLines = (state, week = WEEKS) => weeklyShopping({ ...FOOD_PLAN, ...optsFor(state, week) }).filter((l) => l.cat !== 'Compléments');

/** Un prix saisi → nombre (NaN si vide ou invalide). */
export const price = (v) => { const x = num(v); return Number.isFinite(x) && x >= 0 ? x : NaN; };

// Espaces insécables : « 1 234,50 € » ne se coupe jamais en fin de ligne
export const fmtEur = (x, dec) => {
  if (x == null || !Number.isFinite(x)) return '–';
  const v = Math.abs(x) < 0.005 ? 0 : x;
  const d = dec ?? (Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2);
  const [i, f] = Math.abs(v).toFixed(d).split('.');
  return `${v < 0 ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${f ? `,${f}` : ''} €`;
};

/** Prix d'un gramme (ou d'un ml) d'un aliment, NaN si le prix n'est pas saisi. */
function perUnit(id, prices) {
  if (id === 'whey') { const p = price(prices.whey); return Number.isFinite(p) ? p / WHEY_GRAMS : NaN; }
  const p = price(prices[`food:${id}`]);
  return Number.isFinite(p) ? p / FOODS[id].pack[0] : NaN;
}

/** Coût d'une liste d'aliments [[id, quantité]] au prorata du paquet : { cost, missing } */
export function costOfItems(items, prices) {
  let cost = 0, missing = 0;
  for (const [id, q] of items) {
    const u = perUnit(id, prices);
    if (Number.isFinite(u)) cost += u * q; else missing++;
  }
  return { cost, missing };
}

/** Budget prévu : achats (matériel, compléments), alimentation (coût à l'usage) et lignes libres. */
export function planned(state) {
  const B = state.budget;
  const byCat = Object.fromEntries(CATS.map((c) => [c, 0]));
  let equipSet = 0, linesSet = 0;
  for (const e of PRICED) {
    if (e.id === 'whey' && !wheyOn(state)) continue; // pas de whey, pas d'achat
    const x = price(B.prices[e.id]);
    if (Number.isFinite(x)) { byCat[equipCat(e)] += x; equipSet++; }
  }
  const lines = foodLines(state);
  let foodWeek = 0, foodFull = 0, foodSet = 0;
  for (const l of lines) {
    const u = price(B.prices[`food:${l.id}`]);
    if (Number.isFinite(u)) { foodWeek += u * (l.total / FOODS[l.id].pack[0]); foodFull += u * l.packs; foodSet++; }
  }
  // sur tout le programme : chaque semaine avec sa dose de shake et ses menus (la montée en charge coûte un peu moins au début)
  for (let w = 1; w <= WEEKS; w++) {
    for (const l of foodLines(state, w)) {
      const u = price(B.prices[`food:${l.id}`]);
      if (Number.isFinite(u)) byCat.Alimentation += u * (l.total / FOODS[l.id].pack[0]);
    }
  }
  // compléments suivis hors liste « matériel » : prix du pot et durée d'un pot en semaines
  let suppSet = 0;
  const equipIds = new Set(PRICED.map((e) => e.id));
  for (const sp of state.supps) {
    if (equipIds.has(sp.id)) continue;
    const x = price(sp.price);
    if (!Number.isFinite(x)) continue;
    const wk = Number(String(sp.weeks).replace(',', '.'));
    byCat.Compléments += x * (wk > 0 ? Math.ceil(WEEKS / wk) : 1);
    suppSet++;
  }
  let monthly = 0;
  for (const l of B.lines) {
    const x = price(l.amount);
    if (!Number.isFinite(x)) continue;
    linesSet++;
    const c = CATS.includes(l.cat) ? l.cat : 'Autre';
    if (l.every === 'month') { byCat[c] += x * PROGRAM_MONTHS; monthly += x; } else byCat[c] += x;
  }
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  // Régime de croisière : ce qui revient chaque mois (nourriture + abonnements)
  const perMonth = foodWeek * WEEKS_PER_MONTH + monthly;
  return {
    byCat, total, foodWeek, foodFull, foodSet, foodCount: lines.length, equipSet: equipSet + suppSet, equipCount: PRICED.length + state.supps.filter((sp) => !equipIds.has(sp.id)).length, linesSet,
    perMonth, any: equipSet + foodSet + linesSet > 0,
  };
}

/** Dépenses enregistrées : par catégorie, par semaine de programme (0 = avant le départ), par mois. */
export function spent(state) {
  const byCat = Object.fromEntries(CATS.map((c) => [c, 0]));
  const byWeek = {}, byMonth = {};
  let total = 0, count = 0;
  for (const e of state.budget.expenses) {
    const a = price(e.amount);
    if (!Number.isFinite(a)) continue;
    count++;
    const c = CATS.includes(e.cat) ? e.cat : 'Autre';
    byCat[c] += a; total += a;
    const w = weekIndex(e.date);
    const k = w < 1 ? 0 : Math.min(w, WEEKS);
    byWeek[k] = (byWeek[k] || 0) + a;
    const m = String(e.date).slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + a;
  }
  return { byCat, byWeek, byMonth, total, count };
}

/** Dépenses totales ÷ kilos pris (achats uniques compris). Seulement à partir de 1 kg pris : en dessous, le chiffre n'a pas de sens. */
export function costPerKg(state) {
  const start = num(state.settings.startWeight);
  if (!Number.isFinite(start)) return null;
  const gained = latestWeight(state).kg - start;
  const { total } = spent(state);
  return gained >= 1 && total > 0 ? { value: total / gained, gained } : null;
}

/** Coût d'une liste de courses au ticket de caisse (paquets entiers, sans les compléments) : { cost, set, count } */
export function shoppingCost(lines, prices) {
  let cost = 0, set = 0, count = 0;
  for (const l of lines) {
    if (l.cat === 'Compléments') continue;
    count++;
    const p = price(prices[`food:${l.id}`]);
    if (Number.isFinite(p)) { cost += p * l.packs; set++; }
  }
  return { cost, set, count };
}

export function dayCosts(state, week = WEEKS) {
  const o = optsFor(state, week);
  const prices = state.budget.prices;
  return {
    std: costOfItems(dayPlan('std', o).items, prices),
    run: costOfItems(dayPlan('run', o).items, prices),
    shake: costOfItems(mealFor('shake', o).items, prices),
  };
}

export const currentMonth = () => todayISO().slice(0, 7);

/** CSV des dépenses (séparateur « ; », virgule décimale : s'ouvre directement dans un tableur français). */
export function expensesCsv(state) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = state.budget.expenses.map((e, i) => ({ ...e, i })).sort((a, b) => (a.date === b.date ? a.i - b.i : a.date < b.date ? -1 : 1));
  const euros = (v) => String(Number.isFinite(price(v)) ? price(v) : 0).replace('.', ',');
  return ['Date;Libellé;Catégorie;Montant (€)', ...rows.map((e) => [e.date, esc(e.label), esc(e.cat), euros(e.amount)].join(';'))].join('\r\n');
}
