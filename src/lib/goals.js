// Objectifs de la semaine, série de jours tenus, prochain jalon.
import { WEEKS, START_DATE, DELOADS } from '../data/program.js';
import { addDays, diffDays, weekIndex, weekStart, todayISO, fmtDM } from './dates.js';
import { scheduleFor, isRunDay, consumedFor, targetsFor, weekSummary, num } from './calc.js';

const SEUIL_KCAL = 0.9;  // un jour compte s'il atteint 90 % de la cible en calories
const SEUIL_PROT = 0.95; // et 95 % de la cible en protéines pour l'objectif protéines

const dayHit = (state, d, ratio, key) => {
  const T = targetsFor(state, d);
  const C = consumedFor(state, d);
  const t = key === 'k' ? T.kcal : T.p;
  const v = key === 'k' ? C.k : C.p;
  return t > 0 && v >= ratio * t;
};

/** Objectifs de la semaine qui contient `date` (semaine 1 avant le départ). */
export function weekGoals(state, date, today = todayISO()) {
  const n = Math.min(Math.max(weekIndex(date), 1), WEEKS);
  const start = weekStart(n);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const started = today >= START_DATE;
  const past = days.filter((d) => d <= today && d >= START_DATE);
  const sum = started ? weekSummary(state, n, today) : null;
  const gymPlanned = days.filter((d) => scheduleFor(d)?.type === 'gym' && !(state.days[d]?.skipGym && !state.gym[d])).length;
  const runPlanned = days.filter((d) => scheduleFor(d)?.type === 'run').length;
  const kcalDays = past.filter((d) => dayHit(state, d, SEUIL_KCAL, 'k')).length;
  const protDays = past.filter((d) => dayHit(state, d, SEUIL_PROT, 'p')).length;
  const weighs = days.filter((d) => Number.isFinite(num(state.weights[d]))).length;
  const todo = days.filter((d) => d >= today && d >= START_DATE).map((d) => scheduleFor(d)).filter((s) => s && (s.type === 'gym' || s.type === 'run'));
  return {
    n, start, started, elapsed: past.length,
    items: [
      { id: 'gym', label: 'Séances de muscu', done: sum?.gym || 0, goal: gymPlanned, unit: '' },
      { id: 'run', label: 'Sorties de course', done: sum?.runN || 0, goal: runPlanned, unit: '' },
      { id: 'kcal', label: 'Jours à 90 % des calories', done: kcalDays, goal: 7, unit: '', note: `sur ${past.length} jour${past.length > 1 ? 's' : ''} écoulé${past.length > 1 ? 's' : ''}` },
      { id: 'prot', label: 'Jours à 95 % des protéines', done: protDays, goal: 7, unit: '', note: `sur ${past.length} jour${past.length > 1 ? 's' : ''} écoulé${past.length > 1 ? 's' : ''}` },
      { id: 'weigh', label: 'Pesées à jeun', done: weighs, goal: 3, unit: '', note: 'minimum pour piloter les calories' },
    ],
    todo,
  };
}

/** Jours consécutifs à ≥ 90 % de la cible en calories, en s'arrêtant au départ. Aujourd'hui compte seulement s'il est déjà atteint. */
export function streak(state, today = todayISO()) {
  let n = 0;
  let d = today;
  if (d < START_DATE) return 0;
  if (dayHit(state, d, SEUIL_KCAL, 'k')) n++;
  d = addDays(d, -1);
  while (d >= START_DATE && dayHit(state, d, SEUIL_KCAL, 'k')) { n++; d = addDays(d, -1); }
  return n;
}

/** Prochain jalon du programme à partir de `today`. */
export function nextMilestone(today = todayISO()) {
  const list = [];
  for (const w of DELOADS) list.push({ date: weekStart(w), label: w === WEEKS ? 'Semaine de décharge et test 10 km' : w === 12 ? 'Décharge et contrôle sanguin (S12)' : `Semaine de décharge (S${w})` });
  list.push({ date: addDays(weekStart(WEEKS), 1), label: 'Test des 10 km' });
  const next = list.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (!next) return null;
  const days = diffDays(next.date, today);
  return { ...next, days, when: days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : `dans ${days} jours (${fmtDM(next.date)})` };
}
