import { useState, useRef, useEffect } from 'react';
import { Card, Btn, Chip, Icon, Meter, Modal, Field, NumInput, toast, useNow, cx, fmtK } from '../ui.jsx';
import { A, useAppState } from '../store.js';
import { MEALS, DAY_TYPES, QUICK, RESCUE } from '../data/nutrition.js';
import { FOODS, fmtQty } from '../data/foods.js';
import { weekInfo, SESSIONS, RUN_PLAN, START_DATE, WEEKS } from '../data/program.js';
import { todayISO, weekIndex, clampWeek, daysToTarget, fmtShort, fmtLong, dow, toMin, fmtNum, diffDays, addDays } from '../lib/dates.js';
import { measureStatus } from '../lib/body.js';
import { latestWeight, targetOnDate, targetsFor, consumedFor, dayTypeFor, scheduleOn, num, parseHealthText, referenceActive, activeFor, mealMacros, estimateMacros, scaleMacros, splitShares } from '../lib/calc.js';

const whenLabel = (date) => (date === todayISO() ? 'aujourd’hui' : `le ${fmtShort(date)}`);

// ───────────── Navigation entre les jours ─────────────
function DayNav({ date, back, setBack }) {
  const maxBack = Math.max(0, diffDays(todayISO(), START_DATE));
  const btn = 'w-11 h-11 rounded-xl bg-raised border border-line inline-flex items-center justify-center disabled:opacity-35';
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Jour précédent" disabled={back >= maxBack} onClick={() => setBack(back + 1)} className={btn}><Icon name="ChevronLeft" size={20} /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[16px] font-bold leading-tight truncate">{fmtLong(date)}</div>
          <div className="text-[12.5px] text-muted leading-tight mt-0.5">{back === 0 ? 'Aujourd’hui' : back === 1 ? 'Hier · tu peux compléter cette journée' : 'Journée passée · tu peux la compléter'}</div>
        </div>
        <button type="button" aria-label="Jour suivant" disabled={back <= 0} onClick={() => setBack(back - 1)} className={btn}><Icon name="ChevronRight" size={20} /></button>
      </div>
      {back > 0 && <Btn size="sm" className="w-full mt-2" icon="CalendarCheck" onClick={() => setBack(0)}>Revenir à aujourd’hui</Btn>}
    </div>
  );
}

// ───────────── Jauge de poids 65 → 72 ─────────────
function polar(cx0, cy0, r, deg) { const a = (deg * Math.PI) / 180; return [cx0 + r * Math.cos(a), cy0 - r * Math.sin(a)]; }

function WeightHero({ state, date }) {
  const S = state.settings;
  const { kg, date: lastDate } = latestWeight(state);
  const range = S.targetWeight - S.startWeight;
  const frac = Math.min(1, Math.max(0, (kg - S.startWeight) / range));
  const exp = Math.min(1, Math.max(0, (targetOnDate(S, date) - S.startWeight) / range));
  const W = 240, H = 138, cx0 = 120, cy0 = 120, r = 98;
  const [x0, y0] = polar(cx0, cy0, r, 180);
  const [x1, y1] = polar(cx0, cy0, r, 0);
  const [px, py] = polar(cx0, cy0, r, 180 - 180 * frac);
  const [ex0, ey0] = polar(cx0, cy0, r - 13, 180 - 180 * exp);
  const [ex1, ey1] = polar(cx0, cy0, r + 13, 180 - 180 * exp);
  const week = weekIndex(date);
  const wInfo = weekInfo(clampWeek(week));
  const left = daysToTarget(date);
  const delta = kg - S.startWeight;
  const todayKg = state.weights[date];
  const [draft, setDraft] = useState(todayKg ?? '');
  useEffect(() => { setDraft(todayKg ?? ''); }, [todayKg, date]);
  const save = () => {
    const x = num(draft);
    if (!Number.isFinite(x) || x < 40 || x > 150) { toast('Entre un poids valide, par exemple 65,4', 'warn'); return; }
    A.setWeight(date, Math.round(x * 10) / 10);
    toast(`Pesée enregistrée : ${fmtNum(x)} kg`, 'good');
  };
  return (
    <Card className="overflow-hidden" pad={false}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="lbl">Poids à jeun</div>
            <div className="text-[13px] text-muted mt-0.5">{lastDate ? `Dernière pesée : ${fmtShort(lastDate)}` : 'Poids de départ, pas encore de pesée'}</div>
          </div>
          <Chip tone="accent" icon="Flag">{left > 0 ? `J−${left}` : left === 0 ? 'Jour J' : `J+${-left}`}</Chip>
        </div>
        <div className="relative mx-auto" style={{ maxWidth: 300 }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" role="img" aria-label={`Poids ${fmtNum(kg)} kilos sur un objectif de ${S.targetWeight}`}>
            <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke="rgb(var(--line))" strokeWidth="14" strokeLinecap="round" />
            {frac > 0.004 && <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${px} ${py}`} fill="none" stroke="rgb(var(--accent))" strokeWidth="14" strokeLinecap="round" />}
            <line x1={ex0} y1={ey0} x2={ex1} y2={ey1} stroke="rgb(var(--blue))" strokeWidth="3" strokeLinecap="round" />
            <text x={x0} y={y0 + 16} textAnchor="middle" fontSize="12" fill="rgb(var(--muted))" fontWeight="600">{S.startWeight}</text>
            <text x={x1} y={y1 + 16} textAnchor="middle" fontSize="12" fill="rgb(var(--muted))" fontWeight="600">{S.targetWeight}</text>
          </svg>
          <div className="absolute left-0 right-0 text-center" style={{ top: '40%' }}>
            <div className="text-[52px] leading-none font-bold tracking-tight">{fmtNum(kg)}<span className="text-[18px] text-muted font-semibold ml-1">kg</span></div>
            <div className="text-[13px] text-muted mt-1.5 num">{delta >= 0 ? '+' : '−'}{fmtNum(Math.abs(delta))} kg depuis le départ</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-[12px] text-muted mt-1">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-[3px] rounded bg-accent" />Réel</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-[3px] h-3 rounded bg-blue" />Attendu {date === todayISO() ? 'aujourd’hui' : 'ce jour-là'} : {fmtNum(targetOnDate(S, date))} kg</span>
        </div>
      </div>
      <div className="hair px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted">{week < 1 ? 'Départ le 25 novembre' : `Semaine ${clampWeek(week)}/${WEEKS}`}</div>
          <div className="text-[15px] font-semibold truncate">{wInfo.name}</div>
        </div>
        <div className="w-[104px]"><NumInput value={draft} onChange={setDraft} placeholder={fmtNum(kg)} suffix="kg" ariaLabel="Poids du jour à jeun" /></div>
        <Btn variant="primary" onClick={save} aria-label="Enregistrer la pesée">{todayKg != null ? 'Modifier' : 'Peser'}</Btn>
      </div>
    </Card>
  );
}

// ───────────── Séance du jour ─────────────
function TodayPlan({ state, date, go }) {
  const isToday = date === todayISO();
  const sch = scheduleOn(state, date);
  const n = clampWeek(weekIndex(date));
  if (!sch) return null;
  const title = isToday ? 'Au programme aujourd’hui' : `Au programme · ${fmtShort(date)}`;
  if (sch.type === 'gym') {
    const s = SESSIONS[sch.id];
    const done = state.gym[date] && Object.values(state.gym[date].ex || {}).some((l) => l.some((x) => x.done));
    return (
      <Card title={title} icon="Dumbbell" right={done ? <Chip tone="good" icon="Check">Commencée</Chip> : <Chip>{s.duration}</Chip>}>
        <div className="text-[12.5px] font-semibold text-muted">Semaine {n} · {weekInfo(n).name} · {sch.where}</div>
        <div className="text-[20px] font-bold leading-tight">{s.name}</div>
        <div className="text-[14px] text-muted mt-0.5">{s.items.length} exercices · {s.focus}</div>
        {isToday
          ? <Btn variant="primary" className="w-full mt-3" icon="Play" onClick={() => go({ tab: 'train', trainSub: 'gym', session: s.id })}>{done ? 'Reprendre le carnet' : 'Ouvrir le carnet'}</Btn>
          : <div className="text-[12.5px] text-muted mt-2 leading-snug">Pour noter cette séance, ouvre l’onglet Sport et choisis la date.</div>}
        {!done && <Btn size="sm" className="w-full mt-2" icon="CalendarX" onClick={() => { A.skipGym(date, true); toast(`Séance retirée ${whenLabel(date)}`, 'good'); }}>Retirer cette séance {isToday ? 'aujourd’hui' : 'ce jour-là'}</Btn>}
      </Card>
    );
  }
  if (sch.type === 'run') {
    const r = RUN_PLAN[n - 1][sch.id];
    const done = state.runs[date];
    return (
      <Card title={title} icon="Footprints" right={done ? <Chip tone="good" icon="Check">Faite</Chip> : <Chip>{String(r.km).replace('.', ',')} km</Chip>}>
        <div className="text-[12.5px] font-semibold text-muted">{r.name} · {sch.where}</div>
        <div className="text-[20px] font-bold leading-tight">{r.title}</div>
        <div className="text-[14px] text-muted mt-1 leading-snug">{r.detail}</div>
        <Btn variant="primary" className="w-full mt-3" icon="Play" onClick={() => go({ tab: 'train', trainSub: 'run' })}>Voir et enregistrer la course</Btn>
      </Card>
    );
  }
  if (sch.skipped) {
    return (
      <Card title={title} icon="BedDouble" right={<Chip tone="warn" icon="CalendarX">Séance retirée</Chip>}>
        <div className="text-[20px] font-bold leading-tight">{SESSIONS[sch.skipped.id].name} : retirée</div>
        <div className="text-[14px] text-muted mt-1 leading-snug">Pas de salle {whenLabel(date)}. La séance n’est pas rattrapée toute seule : pour la faire un autre jour, ouvre l’onglet Sport et choisis la date. Repas, shake et eau comptent comme d’habitude.</div>
        <Btn className="w-full mt-3" icon="Undo2" onClick={() => { A.skipGym(date, false); toast('Séance remise au programme', 'good'); }}>Remettre la séance</Btn>
      </Card>
    );
  }
  return (
    <Card title={title} icon="BedDouble">
      <div className="text-[20px] font-bold leading-tight">{sch.label}</div>
      <div className="text-[14px] text-muted mt-1">{sch.hint}</div>
    </Card>
  );
}

function SundayCard({ go, state }) {
  const ms = measureStatus(state.body, todayISO());
  return (
    <Card title="Dimanche : bilan de la semaine" icon="ClipboardList">
      <div className="text-[14px] text-muted leading-snug">Pesée à jeun faite ? Ouvre le bilan : poids moyen, calories, séances, kilomètres, et le conseil du coach pour la semaine qui vient.</div>
      <Btn variant="primary" className="w-full mt-3" icon="ChartLine" onClick={() => go({ tab: 'stats' })}>Ouvrir le bilan de la semaine</Btn>
      {ms.due && (
        <div className="hair mt-3 pt-3">
          <div className="text-[14px] text-muted leading-snug">{ms.last ? `Mensurations : dernière prise il y a ${ms.since} jours. C’est le moment de refaire le tour de taille, de bras, de poitrine et de cuisse.` : 'Mensurations : pas encore de point de départ. Prends-les avant de trop avancer, elles servent de comparaison.'}</div>
          <Btn className="w-full mt-2.5" icon="Ruler" onClick={() => go({ tab: 'health', healthSub: 'body' })}>Prendre mes mesures</Btn>
        </div>
      )}
    </Card>
  );
}

// ───────────── Sync Pacerio ─────────────
function applyRows(rows, date) {
  let n = 0;
  const today = todayISO();
  for (const r of rows) {
    const d = r.date || date;
    if (d > today || diffDays(today, d) > 60) continue;
    A.setPacerio(d, { steps: r.steps ?? undefined, kcal: r.kcal ?? undefined, src: r.date ? 'import' : 'collé', at: Date.now() });
    n++;
  }
  return n;
}

function PacerioCard({ state, date }) {
  const p = state.days[date]?.pacerio;
  const [steps, setSteps] = useState(p?.steps ?? '');
  const [kcal, setKcal] = useState(p?.kcal ?? '');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const fileRef = useRef(null);
  useEffect(() => { setSteps(p?.steps ?? ''); setKcal(p?.kcal ?? ''); }, [p?.steps, p?.kcal, date]);
  const T = targetsFor(state, date);
  const ref = referenceActive(state, date);
  const sl = T.active?.slope;
  const base = fmtK(state.settings.baseKcal);

  // estimation en direct à partir des pas tapés (avant validation)
  const sNum = num(steps), kNum = num(kcal);
  const preview = (() => {
    if (!(sNum > 0) || kNum > 0) return null;
    const tmp = { ...state, days: { ...state.days, [date]: { ...(state.days[date] || {}), pacerio: { steps: Math.round(sNum) } } } };
    const act = activeFor(tmp, date);
    return act ? { act, T: targetsFor(tmp, date) } : null;
  })();

  const save = () => {
    const s = num(steps), k = num(kcal);
    if (!Number.isFinite(s) && !Number.isFinite(k)) { A.clearPacerio(date); toast(`Données Pacerio effacées pour ${whenLabel(date)}`); return; }
    A.setPacerio(date, { steps: Number.isFinite(s) ? Math.round(s) : undefined, kcal: Number.isFinite(k) && k > 0 ? Math.round(k) : undefined, src: 'saisie', at: Date.now() });
    toast(Number.isFinite(k) && k > 0 ? 'Pacerio enregistré' : 'Pas enregistrés : calories actives estimées', 'good');
  };
  const ingest = (txt) => {
    const rows = parseHealthText(txt);
    if (!rows.length) { toast('Rien de lisible. Exemple : « 8450 pas, 620 kcal »', 'warn'); return false; }
    const n = applyRows(rows, date);
    if (!n) { toast('Aucune date récente dans ces données', 'warn'); return false; }
    toast(n === 1 ? `Pacerio importé pour ${whenLabel(date)}` : `${n} jours importés`, 'good');
    return true;
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t && ingest(t)) return;
      if (t) return;
    } catch (e) { /* le presse-papiers est bloqué : zone de collage */ }
    setPasteOpen(true);
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { ingest(String(rd.result || '')); };
    rd.onerror = () => toast('Lecture du fichier impossible', 'crit');
    rd.readAsText(f);
    e.target.value = '';
  };

  return (
    <Card title="Sync Pacerio" icon="Footprints" right={p ? <Chip tone={p.kcal > 0 ? 'good' : 'blue'} icon="Check">{p.kcal > 0 ? (p.src || 'ok') : 'estimé'}</Chip> : <Chip>à saisir</Chip>}>
      <div className="text-[13.5px] text-muted leading-snug mb-3">Entre seulement tes pas : l’appli calcule toute seule tes calories actives et adapte ta cible du jour. Si tu as les vraies calories actives (Pacerio, montre), ajoute-les : elles remplacent l’estimation et la rendent plus juste les jours suivants.</div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Pas"><NumInput value={steps} onChange={setSteps} placeholder="8 450" ariaLabel="Nombre de pas" /></Field>
        <Field label="Calories actives"><NumInput value={kcal} onChange={setKcal} placeholder={preview ? `auto ≈ ${preview.act.kcal}` : '620'} suffix="kcal" ariaLabel="Calories actives" /></Field>
      </div>
      {preview && (
        <div className="mt-2.5 rounded-xl border border-blue/40 bg-blue/10 px-3 py-2 text-[13.5px] leading-snug" role="status">
          <b>Estimation :</b> ≈ <b className="num">{preview.act.kcal} kcal</b> actives{preview.act.run > 0 ? ` (dont ${preview.act.run} pour la course)` : ''} → cible <b className="num">{fmtK(preview.T.kcal)} kcal</b>. Valide pour l’enregistrer.
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <Btn variant="primary" onClick={save} icon="Save" size="sm">Valider</Btn>
        <Btn onClick={paste} icon="ClipboardPaste" size="sm">Coller</Btn>
        <Btn onClick={() => fileRef.current && fileRef.current.click()} icon="FileUp" size="sm">Fichier</Btn>
        <input ref={fileRef} type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" className="hidden" onChange={onFile} />
      </div>
      <div className="mt-3 rounded-xl bg-raised border border-line px-3 py-2.5 text-[13.5px] leading-snug">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Cible du jour</span>
          <span className="font-bold num text-[16px]">{fmtK(T.kcal)} kcal</span>
        </div>
        <div className="text-muted mt-0.5">
          {T.src === 'pacerio' && <>Base {base} + <b className="text-text">{T.bonus}</b> ({T.note}).</>}
          {T.src === 'steps' && <>Base {base} + <b className="text-text">{T.bonus}</b> ({T.note}).</>}
          {T.src === 'run' && <>Base {base} + <b className="text-text">{T.bonus}</b> (course du jour : {T.note}).</>}
          {T.src === 'plan' && <>Base {base} + <b className="text-text">{T.bonus}</b> ({T.note}). Remplacé par tes vraies calories dès que tu les saisis.</>}
          {T.src === 'none' && <>Base {base}. Entre tes pas : les calories actives au-dessus de ta journée type ({ref.value} kcal{ref.auto ? ', calculée sur tes derniers jours' : ''}) s’ajoutent automatiquement.</>}
        </div>
        {T.src === 'steps' && sl && (
          <div className="text-muted mt-1.5 text-[12.5px]">
            Calories par pas : <b className="text-text num">{fmtNum(sl.value, 3)}</b> {sl.calibrated ? `(calibrées sur tes ${sl.n} derniers jours avec pas + calories actives).` : '(valeur de départ calculée avec ta taille et ton poids ; elle se calibre dès 3 jours où tu entres pas ET calories actives).'}
          </div>
        )}
      </div>
      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Coller les données Pacerio">
        <p className="text-[14px] text-muted mb-2.5 leading-snug">Le presse-papiers n’est pas lisible automatiquement ici. Colle le texte copié depuis Pacerio ou ton Raccourci (« Pas : 8 450, Calories actives : 620 »), ou un CSV / JSON.</p>
        <textarea className="inp py-2.5 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="8450 pas, 620 kcal" aria-label="Données à importer" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Btn onClick={() => setPasteOpen(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={() => { if (ingest(text)) { setPasteOpen(false); setText(''); } }}>Importer</Btn>
        </div>
      </Modal>
    </Card>
  );
}

// ───────────── Restants du jour ─────────────
function Remaining({ label, unit, got, target, minimum, strong }) {
  const left = Math.round(target - got);
  const met = got >= target - 0.5;
  const over = !minimum && got > target + (unit === 'kcal' ? 150 : 12);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[13px] text-muted num">
          <b className="text-text text-[15px]">{fmtK(got)}</b> / {minimum ? '≥ ' : ''}{fmtK(target)} {unit}
        </span>
      </div>
      <div className="mt-1.5"><Meter value={got} max={target} done={met && !over} height={strong ? 10 : 8} /></div>
      <div className="mt-1 text-[12.5px] num flex items-center gap-1">
        {over ? <><Icon name="TriangleAlert" size={13} className="text-warn" /><span className="text-warn">{fmtK(got - target)} {unit} au-dessus de la cible</span></>
          : met ? <><Icon name="CircleCheck" size={13} className="text-good" /><span className="text-good">{minimum ? 'Minimum atteint' : 'Objectif atteint'}</span></>
            : <span className="text-muted">Reste {fmtK(left)} {unit}</span>}
      </div>
    </div>
  );
}

function RemainingCard({ state, date, onQuick }) {
  const T = targetsFor(state, date);
  const C = consumedFor(state, date);
  const extras = state.days[date]?.extras || [];
  return (
    <Card title="Restants du jour" icon="Target" right={<Btn size="sm" icon="Plus" onClick={onQuick}>Ajout</Btn>}>
      <div className="grid gap-3.5">
        <Remaining label="Calories" unit="kcal" got={C.k} target={T.kcal} strong />
        <Remaining label="Protéines" unit="g" got={C.p} target={T.p} minimum />
        <Remaining label="Glucides" unit="g" got={C.c} target={T.c} minimum />
        <Remaining label="Lipides" unit="g" got={C.f} target={T.f} />
      </div>
      {extras.length > 0 && (
        <div className="mt-3 hair pt-2.5">
          <div className="lbl mb-1.5">Ajouts du jour</div>
          {extras.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1 text-[14px]">
              <span className="min-w-0 truncate">{e.label}{e.est && <span className="text-muted text-[12px]"> · macros estimées</span>}</span>
              <span className="flex items-center gap-2 text-muted num flex-none">{e.k} kcal
                <button type="button" aria-label={`Retirer ${e.label}`} onClick={() => A.removeExtra(date, i)} className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-raised"><Icon name="X" size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function QuickAddModal({ open, onClose, date }) {
  const [label, setLabel] = useState('');
  const [k, setK] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const kk = num(k);
  const est = Number.isFinite(kk) && kk > 0 ? estimateMacros(kk) : null;
  const anyMacro = [p, c, f].some((x) => String(x).trim() !== '');
  const shares = splitShares();
  const add = (e) => { A.addExtra(date, e); toast(`Ajouté : ${e.label}`, 'good'); onClose(); };
  const custom = () => {
    if (!Number.isFinite(kk) || kk <= 0 || kk > 6000) { toast('Indique les calories (de 1 à 6 000)', 'warn'); return; }
    const m = anyMacro ? { p: Math.round(num(p) || 0), c: Math.round(num(c) || 0), f: Math.round(num(f) || 0) } : { p: est.p, c: est.c, f: est.f };
    add({ label: label.trim() || 'Repas libre', k: Math.round(kk), ...m, ...(anyMacro ? {} : { est: true }) });
    setLabel(''); setK(''); setP(''); setC(''); setF('');
  };
  return (
    <Modal open={open} onClose={onClose} title="Saisir des calories">
      <div>
        <div className="lbl mb-2">Saisie libre</div>
        <input className="inp mb-2" placeholder="Nom (ex. kebab, barre protéinée)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nom de l’ajout" />
        <div className="grid grid-cols-4 gap-2">
          <NumInput value={k} onChange={setK} placeholder="kcal" ariaLabel="Calories" />
          <NumInput value={p} onChange={setP} placeholder={est ? `${est.p} P` : 'P g'} ariaLabel="Protéines" />
          <NumInput value={c} onChange={setC} placeholder={est ? `${est.c} G` : 'G g'} ariaLabel="Glucides" />
          <NumInput value={f} onChange={setF} placeholder={est ? `${est.f} L` : 'L g'} ariaLabel="Lipides" />
        </div>
        <div className="text-[12.5px] text-muted mt-1.5 leading-snug">Seules les calories sont obligatoires. Sans protéines, glucides et lipides, l’appli les estime avec la répartition de ton plan ({shares.p} % P · {shares.c} % G · {shares.f} % L) et le marque « estimé ».</div>
        <Btn variant="primary" className="w-full mt-3" icon="Plus" onClick={custom}>Ajouter à ma journée</Btn>
      </div>
      <div className="hair mt-4 pt-4">
        <div className="lbl mb-2">Raccourcis</div>
        <div className="grid gap-2">
          {QUICK.map((q) => (
            <button key={q.id} type="button" onClick={() => add({ label: q.label, ...q.macros })} className="flex items-center justify-between gap-3 rounded-xl bg-raised border border-line px-3.5 min-h-[48px] text-left">
              <span className="font-semibold text-[14.5px]">{q.label}</span>
              <span className="text-[13px] text-muted num flex-none">{q.macros.k} kcal · {q.macros.p} g P</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ───────────── Calories réelles d'un repas du plan ─────────────
function MealEditModal({ state, date, id, onClose }) {
  const m = MEALS[id];
  const cur = state.days[date]?.mealEdits?.[id];
  const base = m.macros;
  const start = cur || base;
  const [k, setK] = useState(String(start.k));
  const [p, setP] = useState(String(start.p));
  const [c, setC] = useState(String(start.c));
  const [f, setF] = useState(String(start.f));
  const [touched, setTouched] = useState(cur && !cur.est ? { p: 1, c: 1, f: 1 } : {});
  const onK = (v) => {
    setK(v);
    const kk = num(v);
    if (Number.isFinite(kk) && kk > 0) {
      const s = scaleMacros(base, kk);
      if (!touched.p) setP(String(s.p));
      if (!touched.c) setC(String(s.c));
      if (!touched.f) setF(String(s.f));
    }
  };
  const save = () => {
    const kk = num(k);
    if (!Number.isFinite(kk) || kk <= 0 || kk > 6000) { toast('Indique les calories du repas (de 1 à 6 000)', 'warn'); return; }
    const out = { k: Math.round(kk), p: Math.round(num(p) || 0), c: Math.round(num(c) || 0), f: Math.round(num(f) || 0) };
    const same = out.k === base.k && out.p === base.p && out.c === base.c && out.f === base.f;
    if (same) { A.clearMealEdit(date, id); A.setMeal(date, id, true); }
    else A.setMealEdit(date, id, { ...out, ...(touched.p && touched.c && touched.f ? {} : { est: true }) });
    toast(`${m.name} : ${fmtK(out.k)} kcal enregistrées`, 'good');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Calories réelles · ${m.name}`}>
      <p className="text-[14px] text-muted mb-3 leading-snug">Plan : <b className="text-text num">{fmtK(base.k)} kcal</b> · {base.p} g P · {base.c} g G · {base.f} g L. Entre ce que tu as vraiment mangé : le repas est coché et compté avec ces valeurs. Le menu du plan reste intact dans l’onglet Nutrition.</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Calories"><NumInput value={k} onChange={onK} suffix="kcal" ariaLabel="Calories du repas" /></Field>
        <Field label="Protéines"><NumInput value={p} onChange={(v) => { setP(v); setTouched((t) => ({ ...t, p: 1 })); }} suffix="g" ariaLabel="Protéines du repas" /></Field>
        <Field label="Glucides"><NumInput value={c} onChange={(v) => { setC(v); setTouched((t) => ({ ...t, c: 1 })); }} suffix="g" ariaLabel="Glucides du repas" /></Field>
        <Field label="Lipides"><NumInput value={f} onChange={(v) => { setF(v); setTouched((t) => ({ ...t, f: 1 })); }} suffix="g" ariaLabel="Lipides du repas" /></Field>
      </div>
      <div className="text-[12.5px] text-muted mt-2 leading-snug">Si tu ne changes que les calories, les protéines, glucides et lipides suivent la proportion du plan (valeurs estimées). Tu peux les corriger à la main.</div>
      <div className={cx('grid gap-2 mt-4', cur ? 'grid-cols-2' : 'grid-cols-1')}>
        {cur && <Btn icon="Undo2" onClick={() => { A.clearMealEdit(date, id); toast('Valeurs du plan remises', 'good'); onClose(); }}>Remettre le plan</Btn>}
        <Btn variant="primary" icon="Save" onClick={save}>Enregistrer</Btn>
      </div>
    </Modal>
  );
}

// ───────────── Checklist anti-oubli ─────────────
function Hydration({ state, date }) {
  const goal = state.settings.water;
  const ml = state.days[date]?.water || 0;
  const segs = Math.round(goal / 250);
  const full = ml >= goal;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><Icon name="Droplets" size={18} className="text-blue" />Hydratation</div>
        <div className="text-[13px] text-muted num"><b className="text-text text-[15px]">{fmtNum(ml / 1000, 2)}</b> / {fmtNum(goal / 1000, 1)} L {full && <Icon name="CircleCheck" size={14} className="text-good inline -mt-0.5 ml-0.5" />}</div>
      </div>
      <div className="seg-water" style={{ gridTemplateColumns: `repeat(${segs}, 1fr)` }} role="group" aria-label="Jauge d’hydratation, 250 millilitres par segment">
        {Array.from({ length: segs }, (_, i) => (
          <button key={i} type="button" data-on={ml >= (i + 1) * 250 ? '1' : '0'} aria-label={`${(i + 1) * 250} millilitres`}
            onClick={() => A.setWater(date, ml >= (i + 1) * 250 && ml < (i + 2) * 250 ? i * 250 : (i + 1) * 250)} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <Btn size="sm" onClick={() => A.setWater(date, ml - 250)} icon="Minus">250</Btn>
        <Btn size="sm" onClick={() => A.setWater(date, ml + 250)} icon="Plus">250 ml</Btn>
        <Btn size="sm" variant="primary" onClick={() => A.setWater(date, ml + 500)} icon="Plus">500 ml</Btn>
      </div>
    </div>
  );
}

function Checklist({ state, date, onRescue, onQuick, onEdit }) {
  const now = useNow(30000);
  const type = dayTypeFor(state, date);
  const times = state.settings.times[type];
  const [open, setOpen] = useState(null);
  const d = state.days[date] || {};
  const isToday = date === todayISO();
  const minutes = (() => { const x = new Date(now); return x.getHours() * 60 + x.getMinutes(); })();
  const list = DAY_TYPES[type].meals.slice().sort((a, b) => toMin(times[a]) - toMin(times[b]));
  const done = list.filter((id) => d.meals?.[id]).length + (d.creatine ? 1 : 0);
  const total = list.length + 1;
  return (
    <Card title="Anti-oubli" icon="ListChecks" right={<Chip tone={done === total ? 'good' : undefined}>{done}/{total}</Chip>}>
      <div className="grid gap-1">
        {list.map((id) => {
          const m = MEALS[id];
          const eff = mealMacros(state, date, id);
          const edited = !!d.mealEdits?.[id];
          const on = !!d.meals?.[id];
          const late = isToday && !on ? minutes - toMin(times[id]) : -1;
          const lateTone = late >= 90 ? 'serious' : 'warn';
          return (
            <div key={id} className="rounded-xl border border-line bg-raised/60">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button type="button" className="check" data-on={on ? '1' : '0'} aria-pressed={on} aria-label={`${m.name} : ${on ? 'fait' : 'à faire'}`} onClick={() => A.toggleMeal(date, id)}>
                  {on && <Icon name="Check" size={18} strokeWidth={3} />}
                </button>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => A.toggleMeal(date, id)}>
                  <div className={cx('text-[15.5px] font-semibold leading-tight', on && 'text-muted line-through decoration-1')}>{m.name}</div>
                  <div className="text-[12.5px] text-muted num mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Icon name="Clock" size={12} />{times[id]}</span>
                    <span>·</span><span className={cx(edited && 'text-text font-semibold')}>{eff.k} kcal</span><span>·</span><span>{eff.p} g P</span>
                    {edited && <Chip tone="blue" className="ml-0.5">modifié</Chip>}
                    {late >= 30 && <Chip tone={lateTone} icon="TriangleAlert" className="ml-0.5">En retard {late >= 60 ? `${Math.floor(late / 60)} h ${String(late % 60).padStart(2, '0')}` : `${late} min`}</Chip>}
                  </div>
                </button>
                <button type="button" aria-label={`Modifier les calories ${m.name}`} onClick={() => onEdit(id)} className={cx('w-9 h-9 rounded-lg inline-flex items-center justify-center flex-none', edited ? 'text-blue' : 'text-muted')}>
                  <Icon name="Pencil" size={16} />
                </button>
                <button type="button" aria-label={`Détails ${m.name}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)} className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-muted flex-none">
                  <Icon name={open === id ? 'ChevronUp' : 'ChevronDown'} size={18} />
                </button>
              </div>
              {open === id && (
                <div className="px-3.5 pb-3 pt-0.5 text-[13.5px]">
                  <div className="font-semibold mb-1">{m.title}</div>
                  <ul className="text-muted leading-snug">{m.items.map(([fid, q]) => <li key={fid}>{fmtItem(fid, q)}</li>)}</ul>
                  <div className="mt-1.5 text-muted leading-snug">{m.how}</div>
                  <div className="mt-1.5 text-muted num">Plan : {m.macros.k} kcal · {m.macros.p} g P · {m.macros.c} g G · {m.macros.f} g L</div>
                </div>
              )}
            </div>
          );
        })}
        <div className="rounded-xl border border-line bg-raised/60 flex items-center gap-3 px-3 py-2.5">
          <button type="button" className="check" data-on={d.creatine ? '1' : '0'} aria-pressed={!!d.creatine} aria-label="Créatine 5 grammes" onClick={() => A.toggleCreatine(date)}>
            {d.creatine && <Icon name="Check" size={18} strokeWidth={3} />}
          </button>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => A.toggleCreatine(date)}>
            <div className={cx('text-[15.5px] font-semibold leading-tight', d.creatine && 'text-muted line-through decoration-1')}>Créatine monohydrate 5 g</div>
            <div className="text-[12.5px] text-muted mt-0.5">Dans un verre d’eau, avec le petit-déjeuner</div>
          </button>
          <Icon name="FlaskConical" size={18} className="text-muted mr-2" />
        </div>
        <div className="rounded-xl border border-line bg-raised/60 px-3.5 py-3"><Hydration state={state} date={date} /></div>
      </div>
      <div className="grid gap-2 mt-3">
        <Btn icon="PencilLine" onClick={onQuick}>Saisir des calories (repas libre)</Btn>
        <Btn icon="LifeBuoy" onClick={onRescue}>J’ai oublié un repas</Btn>
      </div>
    </Card>
  );
}

const fmtItem = (id, q) => `${FOODS[id].n} · ${fmtQty(id, q)}`;

function RescueModal({ open, onClose, date }) {
  const shake = QUICK.find((q) => q.id === 'q-shake');
  return (
    <Modal open={open} onClose={onClose} title="J’ai oublié un repas">
      <p className="text-[14px] text-muted mb-3 leading-snug">Pas de panique : une journée se rattrape. Voici l’ordre à suivre.</p>
      <ol className="grid gap-2.5 mb-4">
        {RESCUE.map((t, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 flex-none rounded-full bg-accent text-accent-ink text-[13px] font-bold inline-flex items-center justify-center mt-0.5">{i + 1}</span>
            <span className="text-[15px] leading-snug">{t}</span>
          </li>
        ))}
      </ol>
      <Btn variant="primary" className="w-full" icon="GlassWater" onClick={() => { A.addExtra(date, { label: shake.label, ...shake.macros }); toast('Shake ajouté à ta journée', 'good'); onClose(); }}>Ajouter un shake à ma journée</Btn>
    </Modal>
  );
}

// ───────────── Forme du jour ─────────────
function CheckinCard({ state, date }) {
  const c = state.days[date]?.checkin || {};
  const set = (patch) => A.setCheckin(date, patch);
  const energy = Number(c.energy) || 0;
  return (
    <Card title="Forme du jour" icon="HeartPulse">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Sommeil (nuit passée)"><NumInput value={c.sleep ?? ''} onChange={(v) => set({ sleep: v })} placeholder="7,5" suffix="h" ariaLabel="Heures de sommeil" /></Field>
        <Field label="Énergie" as="div">
          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" aria-pressed={energy === v} aria-label={`Énergie ${v} sur 5`} onClick={() => set({ energy: energy === v ? undefined : v })}
                className={cx('min-h-[44px] rounded-lg text-[15px] font-bold num border', energy === v ? 'bg-accent text-accent-ink border-accent' : 'bg-raised border-line text-muted')}>{v}</button>
            ))}
          </div>
        </Field>
      </div>
      <input className="inp mt-2.5" placeholder="Note : stress, courbatures, appétit…" value={c.note ?? ''} onChange={(e) => set({ note: e.target.value })} aria-label="Note du jour" />
      <div className="text-[12.5px] text-muted mt-2 leading-snug">1 = à plat, 5 = en pleine forme. Sert à repérer les jours où l’appétit ou la forme baissent ; la moyenne apparaît dans le bilan de la semaine.</div>
    </Card>
  );
}

// ───────────── Bandeau d'alerte « repas en retard » ─────────────
function LateBanner({ state, date }) {
  const now = useNow(30000);
  if (date !== todayISO()) return null;
  const type = dayTypeFor(state, date);
  const times = state.settings.times[type];
  const x = new Date(now);
  const minutes = x.getHours() * 60 + x.getMinutes();
  const late = DAY_TYPES[type].meals.filter((id) => !state.days[date]?.meals?.[id] && minutes - toMin(times[id]) >= 30)
    .sort((a, b) => toMin(times[a]) - toMin(times[b]));
  if (!late.length) return null;
  const first = late[0];
  return (
    <div className="mb-3 rounded-2xl border border-warn/50 bg-warn/10 px-4 py-3 flex items-start gap-3" role="status">
      <Icon name="BellRing" size={20} className="text-warn mt-0.5 flex-none" />
      <div className="text-[14.5px] leading-snug">
        <b>{late.length === 1 ? `${MEALS[first].name} pas coché` : `${late.length} repas pas cochés`}</b>
        <span className="text-muted"> — prévu à {times[first]}. {late.length > 1 ? 'Bois le shake maintenant, puis rattrape.' : 'Mange maintenant, même une version courte.'}</span>
      </div>
    </div>
  );
}

export default function Today({ go }) {
  const state = useAppState();
  const [back, setBack] = useState(0);
  useNow(60000); // repasse sur le bon jour après minuit
  const today = todayISO();
  const date = addDays(today, -Math.min(back, Math.max(0, diffDays(today, START_DATE))));
  const [quick, setQuick] = useState(false);
  const [rescue, setRescue] = useState(false);
  const [editId, setEditId] = useState(null);
  return (
    <div>
      <DayNav date={date} back={back} setBack={setBack} />
      <LateBanner state={state} date={date} />
      <WeightHero state={state} date={date} />
      <TodayPlan state={state} date={date} go={go} />
      {date === today && dow(date) === 0 && <SundayCard go={go} state={state} />}
      <Checklist state={state} date={date} onRescue={() => setRescue(true)} onQuick={() => setQuick(true)} onEdit={setEditId} />
      <RemainingCard state={state} date={date} onQuick={() => setQuick(true)} />
      <PacerioCard state={state} date={date} />
      <CheckinCard state={state} date={date} />
      <QuickAddModal open={quick} onClose={() => setQuick(false)} date={date} />
      <RescueModal open={rescue} onClose={() => setRescue(false)} date={date} />
      {editId && <MealEditModal key={`${date}-${editId}`} state={state} date={date} id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}
