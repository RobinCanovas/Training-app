import { START_DATE, TARGET_DATE, WEEKS } from '../data/program.js';

const DAY_MS = 86400000;
export const pad = (n) => String(n).padStart(2, '0');
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY_MS);

export const DOW_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export const DOW_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const dow = (s) => parse(s).getDay();
export const fmtDM = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtShort = (s) => { const d = parse(s); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtLong = (s) => { const d = parse(s); return `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`; };
export const monthKey = (s) => s.slice(0, 7).replace('-', '_');

/** Semaine de programme (mercredi → mardi), 1-based. ≤ 0 avant le départ, > 18 après la fin. */
export const weekIndex = (s) => Math.floor(diffDays(s, START_DATE) / 7) + 1;
export const clampWeek = (n) => Math.min(Math.max(n, 1), WEEKS);
export const weekStart = (n) => addDays(START_DATE, (n - 1) * 7);
export const weekEnd = (n) => addDays(weekStart(n), 6);
export const daysToTarget = (s) => diffDays(TARGET_DATE, s);
export const daysSinceStart = (s) => diffDays(s, START_DATE);

export const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export const fmtNum = (x, dec = 1) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(dec).replace('.', ','));
export const fmtInt = (x) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
