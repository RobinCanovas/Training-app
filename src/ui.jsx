import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { ICONS } from './icons.generated.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

const warned = new Set();
export function Icon({ name, size = 20, strokeWidth = 2, className = '' }) {
  const nodes = ICONS[name];
  if (!nodes) {
    if (!warned.has(name)) { warned.add(name); console.warn(`Icône manquante : ${name}`); }
    return null;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {nodes.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

export function Card({ title, icon, right, children, className = '', pad = true }) {
  return (
    <section className={cx('card mb-3', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <h2 className="flex items-center gap-2 lbl">{icon && <Icon name={icon} size={15} />}{title}</h2>
          {right}
        </header>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </section>
  );
}

export function Btn({ variant = 'ghost', size, icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export const Chip = ({ children, tone, icon, className = '' }) => {
  const tones = { good: 'text-good border-good/40', warn: 'text-warn border-warn/40', serious: 'text-serious border-serious/40', crit: 'text-crit border-crit/40', accent: 'text-accent border-accent/40', blue: 'text-blue border-blue/40' };
  return <span className={cx('chip', tone && tones[tone], className)}>{icon && <Icon name={icon} size={12} />}{children}</span>;
};

/** Jauge fine : le remplissage porte l'état (orange → vert quand l'objectif est atteint) */
export function Meter({ value, max, done, tone = 'accent', height = 8 }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = done ? 'bg-good' : tone === 'blue' ? 'bg-blue' : tone === 'aqua' ? 'bg-aqua' : 'bg-accent';
  return (
    <div className="w-full rounded-full bg-raised overflow-hidden" style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <div className={cx('h-full rounded-full transition-[width] duration-300', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Anneau de progression (SVG) : `children` s'affiche au centre. */
export function Ring({ value, max, size = 116, stroke = 11, done, over, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const col = over ? 'rgb(var(--warn))' : done ? 'rgb(var(--good))' : 'rgb(var(--accent))';
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '', compact = false }) {
  return (
    <div className={cx('grid gap-1 p-1 rounded-xl bg-raised border border-line', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cx('min-h-[38px] rounded-lg px-0.5 font-semibold transition', compact ? 'text-[12.5px]' : 'text-[13.5px]', value === o.id ? 'bg-surface text-text border border-line' : 'text-muted border border-transparent')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-10 h-10 rounded-xl bg-raised border border-line inline-flex items-center justify-center"><Icon name="X" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Champ numérique : clavier décimal, 16 px (pas de zoom iOS) */
export function NumInput({ value, onChange, placeholder, suffix, className = '', ariaLabel, step }) {
  return (
    <div className={cx('relative', className)}>
      <input className={cx('inp num', suffix && 'pr-10')} inputMode="decimal" autoComplete="off" value={value ?? ''} placeholder={placeholder} aria-label={ariaLabel}
        step={step} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">{suffix}</span>}
    </div>
  );
}

export const Field = ({ label, children, className = '', as: Tag = 'label' }) => (
  <Tag className={cx('block', className)}>
    <span className="lbl block mb-1.5">{label}</span>
    {children}
  </Tag>
);

// ───────────── Toasts ─────────────
let toasts = [];
const tl = new Set();
let tid = 0;
export function toast(text, tone = 'info') {
  const id = ++tid;
  // pas d'empilement : un message identique remplace l'ancien, et on garde 2 messages au plus
  toasts = [...toasts.filter((t) => t.text !== text), { id, text, tone }].slice(-2);
  tl.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tl.forEach((l) => l()); }, 3200);
}
export function ToastHost() {
  const list = useSyncExternalStore((fn) => { tl.add(fn); return () => tl.delete(fn); }, () => toasts);
  const icon = { good: 'CircleCheck', warn: 'TriangleAlert', crit: 'CircleAlert', info: 'Info' };
  const col = { good: 'text-good', warn: 'text-warn', crit: 'text-crit', info: 'text-blue' };
  return (
    <div className="toast-host" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-xl bg-raised border border-line px-3.5 py-2.5 text-[14px] font-medium shadow-lg max-w-full">
          <span className={col[t.tone]}><Icon name={icon[t.tone] || 'Info'} size={18} /></span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

/** Deuxième appui pour confirmer une suppression : se réarme seul après `ms` millisecondes */
export function useArm(ms = 4000) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), ms); return () => clearTimeout(t); }, [armed, ms]);
  return [armed, setArmed];
}

export function useOnce(fn) { const r = useRef(false); useEffect(() => { if (!r.current) { r.current = true; fn(); } }, []); }

export function Empty({ icon = 'Inbox', title, children }) {
  return (
    <div className="text-center py-6 px-4 text-muted">
      <div className="inline-flex w-11 h-11 rounded-full bg-raised items-center justify-center mb-2"><Icon name={icon} size={20} /></div>
      {title && <div className="font-semibold text-text mb-1">{title}</div>}
      <div className="text-[14px] leading-snug">{children}</div>
    </div>
  );
}

/** Texte « 1 234 » avec espace fine insécable */
export const fmtK = (x) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
