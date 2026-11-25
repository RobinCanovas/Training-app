import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Btn, Chip, Icon, Meter, Segmented, NumInput, Field, Empty, Modal, toast, cx } from '../ui.jsx';
import { A, useAppState, getState } from '../store.js';
import { timer } from '../timer.jsx';
import { SESSIONS, SESSION_ORDER, EXERCISES, WEEK_PLAN, prescribe, parseRange, weekInfo, RUN_PLAN, RUN_ZONES, PHASES, PROGRESSION_RULES, WEEKS, START_DATE, estMinutes, parsePace } from '../data/program.js';
import { todayISO, weekIndex, clampWeek, weekStart, weekEnd, addDays, fmtDM, fmtShort, fmtNum, dow } from '../lib/dates.js';
import { scheduleFor, scheduleOn, lastLogFor, suggestLoad, num, sum, runKcal, parseRunText, latestWeight } from '../lib/calc.js';

const fmtRest = (s) => (s >= 90 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`);
const fmtKm = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

function nextGymSession(state, date) {
  for (let i = 0; i < 7; i++) {
    const s = scheduleOn(state, addDays(date, i));
    if (s?.type === 'gym') return s.id;
  }
  return 'bas';
}

function startSession(date, sid, n) {
  const ex = {};
  for (const it of SESSIONS[sid].items) {
    const pr = prescribe(it, n);
    const E = EXERCISES[it.ex];
    const sug = suggestLoad(lastLogFor(getState(), it.ex, date), pr.reps, E.inc, E.bw);
    const [lo, hi] = parseRange(pr.reps);
    ex[it.ex] = Array.from({ length: pr.sets }, () => ({ kg: E.bw ? '' : (sug.kg ?? ''), reps: String(E.bw ? lo : hi), done: false }));
  }
  A.setGym(date, { s: sid, ex, note: '' });
}

// ───────────── Carnet de salle ─────────────
function SetRow({ i, set, bw, unit, onChange, onToggle }) {
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: '24px minmax(0,1fr) minmax(0,1fr) 46px' }}>
      <div className="text-center text-[13px] font-semibold text-muted num">{i + 1}</div>
      {bw ? <div className="text-center text-[13px] text-muted">poids du corps</div>
        : <NumInput value={set.kg} onChange={(v) => onChange({ kg: v })} placeholder="kg" ariaLabel={`Charge série ${i + 1}`} />}
      <NumInput value={set.reps} onChange={(v) => onChange({ reps: v })} placeholder={unit === 's' ? 'sec' : 'reps'} ariaLabel={`${unit === 's' ? 'Secondes' : 'Répétitions'} série ${i + 1}`} />
      <button type="button" className="check !w-[46px] !h-[44px] !rounded-xl" data-on={set.done ? '1' : '0'} aria-pressed={set.done} aria-label={`Valider la série ${i + 1}`} onClick={onToggle}>
        <Icon name="Check" size={22} strokeWidth={3} />
      </button>
    </div>
  );
}

function ExerciseCard({ state, date, item, n, last }) {
  const E = EXERCISES[item.ex];
  const pr = prescribe(item, n);
  const sets = state.gym[date]?.ex?.[item.ex] || [];
  const prev = useMemo(() => lastLogFor(state, item.ex, date), [state.gym, item.ex, date]);
  const sug = suggestLoad(prev, pr.reps, E.inc, E.bw);
  const [info, setInfo] = useState(false);
  const done = sets.filter((s) => s.done).length;
  const unit = E.unit || 'reps';

  const toggle = (i) => {
    const s = sets[i];
    if (s.done) { A.setSet(date, item.ex, i, { done: false }); return; }
    if (!E.bw && !Number.isFinite(num(s.kg))) { toast('Entre la charge en kg (0 si sans charge)', 'warn'); return; }
    if (!Number.isFinite(num(s.reps))) { toast(unit === 's' ? 'Entre le temps tenu' : 'Entre les répétitions', 'warn'); return; }
    A.setSet(date, item.ex, i, { done: true });
    const nxt = sets[i + 1];
    if (nxt && !E.bw && (nxt.kg === '' || nxt.kg == null) && !nxt.done) A.setSet(date, item.ex, i + 1, { kg: s.kg });
    const allDone = sets.every((x, j) => j === i || x.done);
    if (!(last && allDone)) timer.start(pr.rest, `Repos · ${E.name}`);
  };
  const addSet = () => {
    const l = sets[sets.length - 1];
    A.setExSets(date, item.ex, [...sets, { kg: l?.kg ?? '', reps: l?.reps ?? '', done: false }]);
  };
  const removeSet = () => {
    const idx = [...sets].map((s) => s.done).lastIndexOf(false);
    if (idx < 0 || sets.length <= 1) return;
    A.setExSets(date, item.ex, sets.filter((_, j) => j !== idx));
  };

  return (
    <section className={cx('card mb-3', done === sets.length && sets.length > 0 && 'border-good/50')}>
      <div className="px-4 pt-3.5 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold leading-tight">{E.name}</h3>
            <div className="text-[13px] text-muted num mt-0.5">{pr.sets} × {pr.reps}{unit === 's' ? '' : ' reps'} · repos {fmtRest(pr.rest)} · RPE {pr.rpe}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-none">
            <Chip tone={done === sets.length && sets.length ? 'good' : undefined} className="num">{done}/{sets.length}</Chip>
            <button type="button" aria-label="Consignes d’exécution" aria-expanded={info} onClick={() => setInfo(!info)} className="w-9 h-9 rounded-lg bg-raised border border-line inline-flex items-center justify-center text-muted"><Icon name="Info" size={17} /></button>
          </div>
        </div>
        {info && <div className="mt-2 rounded-xl bg-raised px-3 py-2.5 text-[13.5px] leading-snug text-muted">{E.cue}</div>}
        <div className="mt-2 text-[13px] leading-snug">
          {prev && <div className="text-muted num">Dernière fois ({fmtDM(prev.date)}) : {prev.sets.map((s) => (E.bw ? `${s.reps} s` : `${s.kg} × ${s.reps}`)).join(' · ')}</div>}
          <div className="flex items-start gap-1.5 mt-0.5 text-text"><Icon name="TrendingUp" size={14} className="text-accent mt-[3px] flex-none" /><span>{sug.text}</span></div>
        </div>
      </div>
      <div className="px-4 pb-3.5 pt-2 grid gap-2">
        <div className="grid text-[11px] lbl gap-2" style={{ gridTemplateColumns: '24px minmax(0,1fr) minmax(0,1fr) 46px' }}>
          <span className="text-center">N°</span><span>{E.bw ? '' : 'Charge (kg)'}</span><span>{unit === 's' ? 'Secondes' : 'Reps'}</span><span />
        </div>
        {sets.map((s, i) => <SetRow key={i} i={i} set={s} bw={E.bw} unit={unit} onChange={(p) => A.setSet(date, item.ex, i, p)} onToggle={() => toggle(i)} />)}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <Btn size="sm" icon="Plus" onClick={addSet}>Série</Btn>
          <Btn size="sm" icon="Minus" onClick={removeSet}>Série</Btn>
        </div>
      </div>
    </section>
  );
}

function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return undefined;
    let lock = null, stopped = false;
    const req = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch (e) { /* refusé : sans effet */ } };
    const vis = () => { if (document.visibilityState === 'visible' && !stopped) req(); };
    req();
    document.addEventListener('visibilitychange', vis);
    return () => { stopped = true; document.removeEventListener('visibilitychange', vis); try { lock && lock.release(); } catch (e) { /* ok */ } };
  }, [on]);
}

function Gym({ ui, setUi }) {
  const state = useAppState();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [confirm, setConfirm] = useState(false);
  const log = state.gym[date];
  const sch = scheduleOn(state, date);
  const sid = log?.s || ui.session || (sch?.type === 'gym' ? sch.id : nextGymSession(state, date));
  const S = SESSIONS[sid];
  const n = clampWeek(weekIndex(date));
  const wi = weekInfo(n);
  useWakeLock(!!log && date === today);
  useEffect(() => { if (!confirm) return undefined; const t = setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t); }, [confirm]);

  const allSets = log ? Object.values(log.ex || {}).flat() : [];
  const doneSets = allSets.filter((s) => s.done).length;

  return (
    <div>
      <Card pad={false}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] text-muted font-semibold">Semaine {n} · {wi.name} · RPE {wi.rpe}</div>
            <div className="text-[13.5px] text-muted leading-snug mt-0.5">{wi.goal}</div>
          </div>
        </div>
        <div className="hair px-4 py-2.5 flex items-center gap-2.5">
          <Icon name="CalendarDays" size={17} className="text-muted flex-none" />
          <input type="date" className="inp !min-h-[40px] !py-1" value={date} min={START_DATE} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date de la séance" />
          {date !== today && <Chip tone="warn">Saisie rétroactive</Chip>}
        </div>
      </Card>

      {!log && (
        <>
          <Segmented className="mb-3" options={SESSION_ORDER.map((id) => ({ id, label: SESSIONS[id].short }))} value={sid} onChange={(id) => setUi({ session: id })} />
          <Card title={`${S.name} · ${S.day}`} icon="Dumbbell" right={<Chip>{S.duration}</Chip>}>
            <div className="text-[14px] text-muted mb-2.5">{S.focus}</div>
            <div className="grid gap-1.5">
              {S.items.map((it) => {
                const pr = prescribe(it, n);
                const E = EXERCISES[it.ex];
                return (
                  <div key={it.ex} className="flex items-center justify-between gap-3 py-1.5 hair first:border-0">
                    <span className="text-[15px] font-medium min-w-0">{E.name}</span>
                    <span className="text-[13px] text-muted num flex-none">{pr.sets} × {pr.reps}</span>
                  </div>
                );
              })}
            </div>
            <Btn variant="primary" className="w-full mt-3.5" icon="Play" onClick={() => startSession(date, sid, n)}>Démarrer la séance</Btn>
            <div className="text-[12.5px] text-muted mt-2 leading-snug">Les charges proposées viennent de ta dernière séance (double progression). Le minuteur de repos se lance quand tu valides une série.</div>
          </Card>
        </>
      )}

      {log && (
        <>
          <Card pad={false}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[16px] font-bold">{S.name}</div>
                <div className="text-[13px] text-muted num"><b className="text-text text-[15px]">{doneSets}</b> / {allSets.length} séries</div>
              </div>
              <Meter value={doneSets} max={allSets.length} done={doneSets === allSets.length && allSets.length > 0} height={10} />
            </div>
          </Card>
          {S.items.map((it, i) => <ExerciseCard key={it.ex} state={state} date={date} item={it} n={n} last={i === S.items.length - 1} />)}
          <Card title="Note de séance" icon="NotebookPen">
            <textarea className="inp py-2.5 min-h-[84px]" placeholder="Sensations, douleur, énergie, sommeil…" value={log.note || ''} onChange={(e) => A.patchGym(date, { note: e.target.value })} aria-label="Note de séance" />
          </Card>
          <Btn variant="danger" className="w-full mb-3" icon="Trash2" onClick={() => { if (confirm) { A.deleteGym(date); setConfirm(false); toast('Séance supprimée'); } else setConfirm(true); }}>
            {confirm ? 'Confirmer la suppression de la séance' : 'Supprimer cette séance'}
          </Btn>
        </>
      )}
    </div>
  );
}

// ───────────── Course ─────────────
const fmtDur = (sec) => `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)} h ` : ''}${String(Math.floor((sec % 3600) / 60)).padStart(Math.floor(sec / 3600) ? 2 : 1, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const fmtPace = (sec, km) => { if (!km) return '–'; const p = sec / km; return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`; };

function PlannedRun({ r, date, done, onUse, pace }) {
  const min = estMinutes(r.km, pace);
  return (
    <Card className="!mb-2.5" pad={false}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-muted">{r.day} {fmtDM(date)} · {r.name}</div>
            <div className="text-[18px] font-bold leading-tight mt-0.5">{r.title}</div>
          </div>
          {done ? <Chip tone="good" icon="Check">Faite</Chip> : <Chip className="num">≈ {fmtKm(r.km)} km · {min} min</Chip>}
        </div>
        <div className="text-[13.5px] text-muted leading-snug mt-1.5">{r.detail}</div>
        <div className="text-[12.5px] text-muted mt-1.5">Effort : RPE {r.rpe} sur 10</div>
        {!done && <Btn size="sm" className="mt-2.5" icon="PenLine" onClick={onUse}>Enregistrer cette course</Btn>}
      </div>
    </Card>
  );
}

const emptyRun = (date, id) => ({ date, id, km: '', min: '', sec: '', pace: '', elev: '', hr: '', hrMax: '', kcal: '', cad: '', rpe: '', note: '' });
const parsePaceInput = (v) => { const m = String(v || '').trim().match(/^(\d{1,2})[:'’.,](\d{1,2})$/); return m ? Number(m[1]) * 60 + Number(m[2].length === 1 ? m[2] + '0' : m[2]) : NaN; };
const runToForm = (date, r) => {
  const sec = Number(r.sec) || 0;
  return { date, id: r.id || 'A', km: String(r.km ?? '').replace('.', ','), min: sec ? String(Math.floor(sec / 60)) : '', sec: sec ? String(Math.round(sec % 60)) : '', pace: '', elev: r.elev ?? '', hr: r.hr ?? '', hrMax: r.hrMax ?? '', kcal: r.kcal ?? '', cad: r.cad ?? '', rpe: r.rpe ?? '', note: r.note ?? '' };
};
const runLabel = (d) => (dow(d) === 5 ? 'B' : 'A');
const fmtSpeed = (sec, km) => (km > 0 && sec > 0 ? `${String(Math.round((km / (sec / 3600)) * 10) / 10).replace('.', ',')} km/h` : '–');

function Run() {
  const state = useAppState();
  const today = todayISO();
  const n = clampWeek(weekIndex(today));
  const plan = RUN_PLAN[n - 1];
  const pace = parsePace(state.settings.pace);
  const dateB = addDays(weekStart(n), 2), dateA = addDays(weekStart(n), 6);
  const sch = scheduleFor(today);
  const [form, setForm] = useState(() => emptyRun(today, sch?.type === 'run' ? sch.id : 'A'));
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const [delArm, setDelArm] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const [read, setRead] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { if (delArm == null) return undefined; const t = setTimeout(() => setDelArm(null), 3000); return () => clearTimeout(t); }, [delArm]);

  const weight = latestWeight(state).kg;
  // durée : minutes + secondes, ou allure × distance quand la durée est vide
  const kmN = num(form.km);
  const secTyped = (num(form.min) || 0) * 60 + (num(form.sec) || 0);
  const paceTyped = parsePaceInput(form.pace);
  const secN = secTyped > 0 ? secTyped : (paceTyped > 0 && kmN > 0 ? Math.round(paceTyped * kmN) : 0);
  const kcalGiven = num(form.kcal);
  const kcalEst = kmN > 0 ? runKcal({ km: kmN, elev: num(form.elev), kcal: form.kcal }, weight) : 0;

  const fill = (r) => {
    const sec = r.sec || 0;
    setForm((f) => ({
      ...f,
      date: r.date && r.date >= START_DATE && r.date <= today ? r.date : f.date,
      km: r.km ? String(r.km).replace('.', ',') : f.km,
      min: sec ? String(Math.floor(sec / 60)) : f.min,
      sec: sec ? String(Math.round(sec % 60)) : f.sec,
      pace: '',
      elev: r.elev ?? f.elev, hr: r.hr ?? f.hr, hrMax: r.hrMax ?? f.hrMax, kcal: r.kcal ?? f.kcal, cad: r.cad ?? f.cad, rpe: r.rpe ? String(r.rpe) : f.rpe,
    }));
  };
  const ingest = (txt) => {
    const rows = parseRunText(txt);
    if (!rows.length) { setRead({ ok: false }); toast('Rien de lisible : colle la distance et la durée (ex. « 5,02 km 28:31 D+ 45 m »)', 'warn'); return false; }
    if (rows.length === 1) {
      fill(rows[0]);
      setRead({ ok: true, r: rows[0] });
      toast('Données lues : vérifie puis enregistre', 'good');
      return true;
    }
    let ok = 0, skipped = 0;
    for (const r of rows) {
      if (!(r.km > 0) || !(r.sec > 0) || !r.date || r.date < START_DATE || r.date > today) { skipped++; continue; }
      const { date, ...rest } = r;
      A.setRun(date, { id: runLabel(date), ...rest });
      ok++;
    }
    toast(ok ? `${ok} course${ok > 1 ? 's' : ''} importée${ok > 1 ? 's' : ''}${skipped ? ` · ${skipped} ignorée${skipped > 1 ? 's' : ''} (hors programme ou incomplète${skipped > 1 ? 's' : ''})` : ''}` : 'Aucune course dans la période du programme', ok ? 'good' : 'warn');
    return ok > 0;
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

  const save = () => {
    if (!Number.isFinite(kmN) || kmN <= 0 || kmN > 60) { toast('Entre la distance en km, par exemple 5,2', 'warn'); return; }
    if (secN < 60) { toast('Entre la durée (minutes et secondes) ou l’allure', 'warn'); return; }
    const opt = (v, lo, hi) => { const x = num(v); return Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x) : undefined; };
    A.setRun(form.date, {
      id: form.id, km: Math.round(kmN * 100) / 100, sec: Math.round(secN), rpe: form.rpe || undefined,
      elev: opt(form.elev, 1, 5000), hr: opt(form.hr, 40, 230), hrMax: opt(form.hrMax, 80, 230), kcal: opt(form.kcal, 10, 5000), cad: opt(form.cad, 100, 230),
      note: form.note || undefined,
    });
    toast(`Course enregistrée : ${fmtKm(kmN)} km à ${fmtPace(secN, kmN)} /km`, 'good');
    setForm(emptyRun(form.date, form.id));
    setRead(null);
  };
  const useRun = (id, date) => { set({ id, date }); setTimeout(() => { const el = document.getElementById('run-form'); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
  const editRun = (d) => { setForm(runToForm(d, state.runs[d])); setRead(null); setTimeout(() => { const el = document.getElementById('run-form'); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
  const runs = Object.entries(state.runs).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10);
  const hasExisting = !!state.runs[form.date];

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13.5px] font-semibold">Semaine {n} · {fmtKm(plan.km)} km prévus</div>
        <Chip>{weekInfo(n).deload ? 'Décharge' : weekInfo(n).name}</Chip>
      </div>
      <PlannedRun r={plan.B} date={dateB} pace={pace} done={!!state.runs[dateB]} onUse={() => useRun('B', dateB)} />
      <PlannedRun r={plan.A} date={dateA} pace={pace} done={!!state.runs[dateA]} onUse={() => useRun('A', dateA)} />
      <div className="text-[12px] text-muted mb-3 leading-snug px-0.5">Durées estimées à {state.settings.pace} /km (réglable dans les réglages). L’ordre dans la semaine : vendredi, puis mardi, la semaine de programme commence le mercredi.</div>

      <div id="run-form" />
      <Card title="Enregistrer une course" icon="PenLine">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Btn size="sm" icon="ClipboardPaste" onClick={() => setPasteOpen(true)}>Coller depuis Strava</Btn>
          <Btn size="sm" icon="FileUp" onClick={() => fileRef.current && fileRef.current.click()}>Importer un fichier</Btn>
          <input ref={fileRef} type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" className="hidden" onChange={onFile} />
        </div>
        {read && read.ok && (
          <div className="mb-3 rounded-xl border border-blue/40 bg-blue/10 px-3 py-2 text-[13px] leading-snug num" role="status">
            <b>Lu :</b> {[read.r.km && `${fmtKm(read.r.km)} km`, read.r.sec && fmtDur(read.r.sec), read.r.km && read.r.sec && `${fmtPace(read.r.sec, read.r.km)} /km`, read.r.elev && `D+ ${read.r.elev} m`, read.r.hr && `${read.r.hr} bpm`, read.r.hrMax && `max ${read.r.hrMax}`, read.r.kcal && `${read.r.kcal} kcal`, read.r.cad && `${read.r.cad} spm`, read.r.date && fmtShort(read.r.date)].filter(Boolean).join(' · ')}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Date"><input type="date" className="inp" value={form.date} min={START_DATE} max={today} onChange={(e) => e.target.value && set({ date: e.target.value })} /></Field>
          <Field label="Séance" as="div"><Segmented options={[{ id: 'A', label: 'Z2' }, { id: 'B', label: 'Tempo' }]} value={form.id} onChange={(id) => set({ id })} /></Field>
          <Field label="Distance"><NumInput value={form.km} onChange={(v) => set({ km: v })} placeholder="5,2" suffix="km" ariaLabel="Distance en kilomètres" /></Field>
          <Field label="Durée">
            <div className="grid grid-cols-2 gap-1.5">
              <NumInput value={form.min} onChange={(v) => set({ min: v.replace(/[.,]/g, '') })} placeholder="32" suffix="min" ariaLabel="Minutes" />
              <NumInput value={form.sec} onChange={(v) => set({ sec: v.replace(/[.,]/g, '').slice(0, 2) })} placeholder="10" suffix="s" ariaLabel="Secondes" />
            </div>
          </Field>
          <Field label="Allure moyenne">
            <input className="inp num" inputMode="numeric" value={secN > 0 && kmN > 0 && secTyped > 0 ? fmtPace(secN, kmN) : form.pace} readOnly={secTyped > 0} placeholder="5:41" aria-label="Allure moyenne par kilomètre" onChange={(e) => set({ pace: e.target.value.replace(/[^\d:'’.,]/g, '').slice(0, 5) })} />
          </Field>
          <Field label="Dénivelé positif"><NumInput value={form.elev} onChange={(v) => set({ elev: v.replace(/[.,]/g, '') })} placeholder="45" suffix="m D+" ariaLabel="Dénivelé positif en mètres" /></Field>
          <Field label="FC moyenne"><NumInput value={form.hr} onChange={(v) => set({ hr: v.replace(/[.,]/g, '') })} placeholder="152" suffix="bpm" ariaLabel="Fréquence cardiaque moyenne" /></Field>
          <Field label="FC maximale"><NumInput value={form.hrMax} onChange={(v) => set({ hrMax: v.replace(/[.,]/g, '') })} placeholder="171" suffix="bpm" ariaLabel="Fréquence cardiaque maximale" /></Field>
          <Field label="Calories (Strava, montre)"><NumInput value={form.kcal} onChange={(v) => set({ kcal: v.replace(/[.,]/g, '') })} placeholder={kcalEst ? `≈ ${kcalEst}` : '412'} suffix="kcal" ariaLabel="Calories de la sortie" /></Field>
          <Field label="Cadence"><NumInput value={form.cad} onChange={(v) => set({ cad: v.replace(/[.,]/g, '') })} placeholder="168" suffix="spm" ariaLabel="Cadence en pas par minute" /></Field>
        </div>
        {kmN > 0 && secN > 0 && (
          <div className="mt-2.5 text-[13px] text-muted leading-snug num">
            Allure <b className="text-text">{fmtPace(secN, kmN)} /km</b> · {fmtSpeed(secN, kmN)}
            {' · '}{kcalGiven > 0 ? <>calories notées <b className="text-text">{Math.round(kcalGiven)} kcal</b></> : <>calories estimées <b className="text-text">≈ {kcalEst} kcal</b> ({fmtNum(weight, 0)} kg × {num(form.elev) > 0 ? `(${fmtKm(kmN)} km + D+ ÷ 100)` : `${fmtKm(kmN)} km`})</>}
            {' '}: elles s’ajoutent à ta cible du jour.
          </div>
        )}
        <div className="mt-3">
          <div className="lbl mb-1.5">Effort ressenti (RPE)</div>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button key={v} type="button" aria-pressed={String(form.rpe) === String(v)} onClick={() => set({ rpe: String(form.rpe) === String(v) ? '' : String(v) })}
                className={cx('min-h-[40px] rounded-lg text-[14px] font-bold num border', String(form.rpe) === String(v) ? 'bg-accent text-accent-ink border-accent' : 'bg-raised border-line text-muted')}>{v}</button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Field label="Note (option)"><input className="inp" value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Jambes lourdes, parcours vallonné…" /></Field>
        </div>
        <Btn variant="primary" className="w-full mt-3.5" icon="Save" onClick={save}>Enregistrer</Btn>
        {hasExisting && <div className="text-[12.5px] text-muted mt-2 leading-snug">Une course existe déjà le {fmtShort(form.date)} : elle sera remplacée.</div>}
      </Card>

      <Card title="Dernières courses" icon="History">
        {!runs.length ? <Empty icon="Footprints" title="Aucune course enregistrée">Ta première sortie apparaîtra ici, avec l’allure moyenne calculée.</Empty> : (
          <div className="grid">
            {runs.map(([d, r]) => (
              <div key={d} className="flex items-center gap-2 py-2.5 hair first:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold">{fmtShort(d)} · {r.id === 'B' ? 'Tempo' : 'Z2'}</div>
                  <div className="text-[13px] text-muted num">{fmtKm(num(r.km))} km · {fmtDur(r.sec)} · {fmtPace(r.sec, num(r.km))} /km{r.rpe ? ` · RPE ${r.rpe}` : ''}</div>
                  {(r.elev || r.hr || r.hrMax || r.kcal || r.cad) && (
                    <div className="text-[12.5px] text-muted num">{[r.elev && `D+ ${r.elev} m`, r.hr && `${r.hr} bpm moy.`, r.hrMax && `${r.hrMax} max`, r.kcal && `${r.kcal} kcal`, r.cad && `${r.cad} spm`].filter(Boolean).join(' · ')}</div>
                  )}
                  {r.note && <div className="text-[12.5px] text-muted truncate">{r.note}</div>}
                </div>
                <button type="button" aria-label={`Modifier la course du ${fmtShort(d)}`} onClick={() => editRun(d)} className="h-9 w-9 rounded-lg inline-flex items-center justify-center border bg-raised border-line text-muted flex-none"><Icon name="Pencil" size={15} /></button>
                <button type="button" aria-label={`Supprimer la course du ${fmtShort(d)}`} onClick={() => { if (delArm === d) { A.deleteRun(d); setDelArm(null); } else setDelArm(d); }}
                  className={cx('h-9 rounded-lg px-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold border flex-none', delArm === d ? 'bg-crit/20 border-crit/50' : 'bg-raised border-line text-muted')}>
                  <Icon name="Trash2" size={15} />{delArm === d ? 'Sûr ?' : ''}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Repères d’allure" icon="Gauge">
        <div className="grid gap-3">
          {RUN_ZONES.map((z) => (
            <div key={z.name}>
              <div className="flex items-baseline justify-between gap-2"><span className="text-[15px] font-semibold">{z.name}</span><span className="text-[13px] text-muted num">RPE {z.rpe}</span></div>
              <div className="text-[13.5px] text-muted leading-snug mt-0.5">{z.talk} Repère cardio indicatif : {z.hr}.</div>
            </div>
          ))}
          <div className="text-[12.5px] text-muted leading-snug hair pt-2.5">Les fréquences cardiaques sont des repères moyens pour ton âge, pas une mesure de ta zone. Le test de la parole prime : si tu ne peux pas tenir une conversation en zone 2, ralentis.</div>
        </div>
      </Card>

      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Coller depuis Strava">
        <p className="text-[14px] text-muted mb-2.5 leading-snug">Colle le texte de ta sortie (résumé Strava, montre, notes) : distance, durée ou allure, D+, fréquence cardiaque, calories. L’appli remplit le formulaire, tu vérifies puis tu enregistres. Un CSV ou un JSON d’export avec plusieurs sorties est importé d’un coup.</p>
        <textarea className="inp py-2.5 min-h-[130px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'5,02 km · 28:31 · 5:41 /km\nDénivelé 45 m · FC moy. 152 bpm · 412 kcal'} aria-label="Texte de la sortie à lire" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Btn onClick={() => setPasteOpen(false)}>Annuler</Btn>
          <Btn variant="primary" icon="ScanText" onClick={() => { if (ingest(text)) { setPasteOpen(false); setText(''); } }}>Lire</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ───────────── Plan 18 semaines ─────────────
function Plan() {
  const today = todayISO();
  const cur = weekIndex(today);
  const [open, setOpen] = useState('bas');
  return (
    <div>
      <Card title="Phases" icon="Layers">
        <div className="grid gap-2.5">
          {PHASES.map((p) => (
            <div key={p.name} className="flex gap-3">
              <div className="w-[72px] flex-none text-[12.5px] font-bold text-accent num pt-0.5">S{p.from}–{p.to}</div>
              <div className="min-w-0"><div className="text-[15px] font-semibold">{p.name} <span className="text-muted font-medium text-[13px]">· RPE {p.rpe}</span></div><div className="text-[13.5px] text-muted leading-snug">{p.goal}</div></div>
            </div>
          ))}
          <div className="flex gap-3">
            <div className="w-[72px] flex-none text-[12.5px] font-bold text-blue num pt-0.5">S6 · S12 · S18</div>
            <div className="text-[13.5px] text-muted leading-snug"><span className="text-text font-semibold text-[15px]">Décharges.</span> Une série de moins, charges −10 %. En S18, test des 10 km.</div>
          </div>
        </div>
      </Card>

      <Card title="Séances de salle" icon="Dumbbell" pad={false}>
        {SESSION_ORDER.map((id) => {
          const S = SESSIONS[id];
          const isOpen = open === id;
          return (
            <div key={id} className="hair first:border-0">
              <button type="button" className="w-full px-4 min-h-[56px] flex items-center justify-between gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                <div><div className="text-[16px] font-bold">{S.name}</div><div className="text-[12.5px] text-muted">{S.day} · {S.duration} · {S.items.length} exercices</div></div>
                <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-muted" />
              </button>
              {isOpen && (
                <div className="px-4 pb-3.5">
                  <div className="grid text-[11px] lbl pb-1 gap-1" style={{ gridTemplateColumns: 'minmax(0,1.6fr) repeat(3, minmax(0,1fr))' }}>
                    <span>Exercice</span><span className="text-center">Fond.</span><span className="text-center">Surch.</span><span className="text-center">Intens.</span>
                  </div>
                  {S.items.map((it) => (
                    <div key={it.ex} className="grid items-center gap-1 py-1.5 hair text-[13px]" style={{ gridTemplateColumns: 'minmax(0,1.6fr) repeat(3, minmax(0,1fr))' }}>
                      <span className="font-medium text-[13.5px] leading-tight pr-1">{EXERCISES[it.ex].name}</span>
                      {[0, 1, 2].map((p) => <span key={p} className="text-center num text-muted">{it.sets[p]}×{it.reps[p].replace(' s', '')}{EXERCISES[it.ex].unit === 's' ? ' s' : ''}</span>)}
                    </div>
                  ))}
                  <div className="text-[12.5px] text-muted mt-2">Repos : {S.items.map((it) => fmtRest(it.rest)).filter((v, i, a) => a.indexOf(v) === i).join(', ')} selon l’exercice.</div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Card title="Règles de progression" icon="TrendingUp">
        <ul className="grid gap-2.5">
          {PROGRESSION_RULES.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-snug"><span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent flex-none" /><span>{r}</span></li>
          ))}
        </ul>
      </Card>

      <Card title="Plan de course · 18 semaines" icon="Footprints" pad={false}>
        <div className="grid text-[11px] lbl px-4 pt-3 pb-1.5 gap-2" style={{ gridTemplateColumns: '38px minmax(0,1fr) 44px' }}><span>Sem.</span><span>Vendredi (B) · Mardi (A)</span><span className="text-right">km</span></div>
        {RUN_PLAN.map((w) => {
          const wi = weekInfo(w.n);
          const isCur = w.n === cur;
          return (
            <div key={w.n} className={cx('grid gap-2 px-4 py-2.5 hair items-start', isCur && 'bg-accent/10')} style={{ gridTemplateColumns: '38px minmax(0,1fr) 44px' }}>
              <div><div className={cx('text-[15px] font-bold num', isCur && 'text-accent')}>S{w.n}</div></div>
              <div className="min-w-0 text-[13px] leading-snug">
                <div className="text-[11.5px] text-muted num mb-0.5">{fmtDM(weekStart(w.n))} → {fmtDM(weekEnd(w.n))}{wi.deload ? ' · décharge' : ''}</div>
                <div><b className="font-semibold">B</b> <span className="text-muted">{w.B.title}</span></div>
                <div><b className="font-semibold">A</b> <span className="text-muted">{w.A.title}</span></div>
              </div>
              <div className="text-right text-[15px] font-bold num">{fmtKm(w.km)}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export default function Training({ ui, setUi }) {
  const sub = ui.trainSub || 'gym';
  return (
    <div>
      <Segmented className="mb-3" options={[{ id: 'gym', label: 'Salle' }, { id: 'run', label: 'Course' }, { id: 'plan', label: 'Plan 18 sem.' }]} value={sub} onChange={(v) => setUi({ trainSub: v })} />
      {sub === 'gym' && <Gym ui={ui} setUi={setUi} />}
      {sub === 'run' && <Run />}
      {sub === 'plan' && <Plan />}
    </div>
  );
}
