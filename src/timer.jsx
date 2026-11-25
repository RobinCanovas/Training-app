import { useState, useEffect, useSyncExternalStore } from 'react';
import { Icon } from './ui.jsx';

// Minuteur de repos : basé sur des horodatages (exact même après un passage en arrière-plan)
let T = { endAt: 0, total: 0, label: '', doneAt: 0 };
const ls = new Set();
const emit = () => ls.forEach((l) => l());
const sub = (fn) => { ls.add(fn); return () => ls.delete(fn); };
const get = () => T;

let audio = null;
export function ensureAudio() {
  try {
    if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
    if (audio && audio.state === 'suspended') audio.resume();
  } catch (e) { /* sans son */ }
}
function beep(times = 3) {
  try {
    ensureAudio();
    if (!audio) return;
    const now = audio.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      const t0 = now + i * 0.3;
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.24);
    }
  } catch (e) { /* sans son */ }
}

export const timer = {
  start(sec, label) { ensureAudio(); T = { endAt: Date.now() + sec * 1000, total: sec, label: label || 'Repos', doneAt: 0 }; emit(); },
  add(sec) { if (!T.endAt || T.doneAt) return; T = { ...T, endAt: T.endAt + sec * 1000, total: Math.max(1, T.total + sec) }; emit(); },
  stop() { T = { endAt: 0, total: 0, label: '', doneAt: 0 }; emit(); },
  finish() {
    if (!T.endAt || T.doneAt) return;
    const mine = T.endAt;
    T = { ...T, doneAt: Date.now() };
    emit();
    beep();
    try { navigator.vibrate && navigator.vibrate([220, 120, 220]); } catch (e) { /* sans vibration */ }
    setTimeout(() => { if (T.endAt === mine) timer.stop(); }, 6000);
  },
};

const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function TimerBar() {
  const t = useSyncExternalStore(sub, get);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!t.endAt) return undefined;
    const i = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [t.endAt]);
  const rem = t.endAt ? t.endAt - Date.now() : 0;
  const over = t.endAt && rem <= 0;
  useEffect(() => { if (over && !t.doneAt) { if (Date.now() - t.endAt > 45000) timer.stop(); else timer.finish(); } }, [over, t.doneAt]);
  if (!t.endAt) return null;
  const pct = t.doneAt ? 100 : Math.min(100, Math.max(0, (1 - rem / (t.total * 1000)) * 100));
  return (
    <div className="timer-bar" role="timer" aria-live="off">
      <div className="max-w-[560px] mx-auto rounded-2xl border border-line bg-raised shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <div className={`w-9 h-9 rounded-full inline-flex items-center justify-center ${t.doneAt ? 'bg-good text-accent-ink' : 'bg-surface text-accent'}`}>
            <Icon name={t.doneAt ? 'Check' : 'Timer'} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">{t.doneAt ? 'Repos terminé' : t.label}</div>
            <div className="text-[26px] leading-none font-bold num">{t.doneAt ? 'Go !' : mmss(rem)}</div>
          </div>
          {!t.doneAt && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => timer.add(-15)} aria-label="Retirer 15 secondes">−15</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => timer.add(15)} aria-label="Ajouter 15 secondes">+15</button>
            </>
          )}
          <button type="button" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-muted" onClick={() => timer.stop()} aria-label="Fermer le minuteur"><Icon name="X" size={18} /></button>
        </div>
        <div className="h-[3px] bg-surface"><div className={`h-full ${t.doneAt ? 'bg-good' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}
