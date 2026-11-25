import { BODY_MEASURES, BODY_EVERY_DAYS } from '../data/health.js';
import { diffDays, addDays } from './dates.js';
import { num } from './calc.js';

/** Dates (triées) où au moins une mensuration est renseignée */
export const measureDates = (body) => Object.keys(body || {}).filter((d) => BODY_MEASURES.some((m) => Number.isFinite(num(body[d]?.[m.id])))).sort();

/** Où en est-on du rythme des mesures : { last, since, due, next } (last = null si aucune mesure) */
export function measureStatus(body, today) {
  const dates = measureDates(body);
  if (!dates.length) return { last: null, since: null, due: true, next: null };
  const last = dates[dates.length - 1];
  const since = diffDays(today, last);
  return { last, since, due: since >= BODY_EVERY_DAYS, next: addDays(last, BODY_EVERY_DAYS) };
}
