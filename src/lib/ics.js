import { ALARM_DAYS, buildAlarms } from '../data/nutrition.js';
import { START_DATE, TARGET_DATE } from '../data/program.js';
import { addDays, dow } from './dates.js';

// Jours de chaque série d'alarmes (RFC 5545) et numéro de jour JS (0 = dimanche)
const BYDAY = {
  [ALARM_DAYS.all]: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
  [ALARM_DAYS.std]: ['MO', 'WE', 'TH', 'SA', 'SU'],
  [ALARM_DAYS.run]: ['TU', 'FR'],
};
const DOW_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = (iso) => iso.replace(/-/g, '');
const hm = (t) => t.replace(':', '') + '00';

/** Découpe une ligne à 75 octets (RFC 5545 §3.1) sans couper un caractère multi-octets */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // la ligne de continuation commence par une espace
    if (size + n > limit) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * Calendrier iCalendar des alarmes anti-oubli : un événement hebdomadaire par alarme, avec une notification à l'heure dite.
 * Heures « flottantes » (celles de l'appareil), du départ jusqu'au jour J. `now` sert à l'horodatage (testable).
 */
export function buildIcs(times, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const until = `${d8(TARGET_DATE)}T235959`;
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cap 72 kg//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Cap 72 kg : alarmes'];
  buildAlarms(times).forEach((a, i) => {
    const days = BYDAY[a.days] || BYDAY[ALARM_DAYS.all];
    let first = START_DATE;
    while (!days.includes(DOW_CODE[dow(first)])) first = addDays(first, 1);
    const [h, m] = a.t.split(':').map(Number);
    const endMin = h * 60 + m + 10;
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
    out.push(
      'BEGIN:VEVENT',
      `UID:cap72-alarme-${i + 1}-${d8(START_DATE)}@cap72`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${d8(first)}T${hm(a.t)}`,
      `DTEND:${d8(first)}T${end}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')};UNTIL=${until}`,
      `SUMMARY:${esc(a.label)}`,
      `DESCRIPTION:${esc(a.note)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(a.label)}`, 'TRIGGER:PT0S', 'END:VALARM',
      'END:VEVENT',
    );
  });
  out.push('END:VCALENDAR');
  return out.map(fold).join('\r\n') + '\r\n';
}
