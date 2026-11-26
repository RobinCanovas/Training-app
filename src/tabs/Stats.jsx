import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Bar, ReferenceLine } from 'recharts';
import { Card, Btn, Chip, Icon, Empty, Meter, cx, fmtK } from '../ui.jsx';
import { C, ChartTip, Key, ChartCard, DataTable, axis } from '../charts.jsx';
import { useAppState } from '../store.js';
import { KEY_LIFTS, RUN_PLAN, WEEKS, SESSIONS } from '../data/program.js';
import { todayISO, weekIndex, clampWeek, fmtNum, fmtDM, addDays } from '../lib/dates.js';
import { weeklyAverages, targetAtWeek, keyLiftSeries, runKmByWeek, coach, latestWeight, num, weekSummary, gymPlanned, scheduleFor, isSkipped } from '../lib/calc.js';

const LIFT_COLORS = [C.orange, C.blue, C.aqua];

function WeightChart({ state }) {
  const S = state.settings;
  const cur = clampWeek(weekIndex(todayISO()));
  const avg = Object.fromEntries(weeklyAverages(state).map((w) => [w.n, w]));
  const rows = Array.from({ length: WEEKS + 1 }, (_, n) => ({
    x: n,
    real: n >= 1 && n <= cur && avg[n] ? Math.round(avg[n].avg * 100) / 100 : null,
    plan: Math.round((n === 0 ? S.startWeight : targetAtWeek(S, n - 0.5)) * 100) / 100,
    count: avg[n]?.count || 0,
  }));
  const vals = rows.flatMap((r) => [r.real, r.plan]).filter((v) => v != null).concat([S.targetWeight, S.startWeight]);
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const hasData = rows.some((r) => r.real != null);
  const lbl = (x) => (x === 0 ? 'Départ' : `Semaine ${x}`);
  return (
    <ChartCard title="Poids moyen par semaine" sub={hasData ? 'Moyenne des pesées à jeun de chaque semaine (lundi → dimanche), comparée à la trajectoire vers l’objectif.' : 'Pèse-toi à jeun chaque matin : la courbe orange apparaît dès la première semaine. La trajectoire bleue est ton objectif.'}
      legend={[{ name: 'Poids moyen (kg)', color: C.orange }, { name: 'Trajectoire vers l’objectif', color: C.blue }]}
      table={<DataTable head={['Semaine', 'Moyenne', 'Objectif', 'Pesées']} rows={rows.map((r) => [r.x === 0 ? 'Départ' : `S${r.x}`, r.real != null ? fmtNum(r.real, 1) : '–', fmtNum(r.plan, 1), r.count || '–'])} />}>
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="x" type="number" domain={[0, WEEKS]} ticks={[0, 3, 6, 9, 12, 15, 18]} tickFormatter={(v) => (v === 0 ? 'Dép.' : `S${v}`)} {...axis} />
            <YAxis domain={[lo, hi]} tickCount={Math.min(7, hi - lo + 1)} tickFormatter={(v) => fmtNum(v, 0)} width={38} {...axis} />
            <ReferenceLine y={S.targetWeight} stroke={C.tick} strokeDasharray="4 4" strokeWidth={1} label={{ value: `${S.targetWeight} kg`, position: 'insideTopLeft', fill: C.tick, fontSize: 11 }} />
            <Tooltip cursor={{ stroke: C.grid, strokeWidth: 1 }} content={<ChartTip title={lbl} fmt={(v) => `${fmtNum(v, 1)} kg`} />} />
            <Line type="monotone" dataKey="plan" name="Trajectoire" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: C.blue, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="real" name="Poids moyen" stroke={C.orange} strokeWidth={2} connectNulls dot={{ r: 4, fill: C.orange, stroke: C.surface, strokeWidth: 2 }} activeDot={{ r: 6, fill: C.orange, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function LiftsChart({ state }) {
  const best = keyLiftSeries(state);
  const cur = clampWeek(weekIndex(todayISO()));
  const rows = Array.from({ length: cur }, (_, i) => {
    const n = i + 1;
    const r = { x: n };
    KEY_LIFTS.forEach((l) => { r[l.id] = best[`${l.id}:${n}`] ?? null; });
    return r;
  });
  const anyData = rows.some((r) => KEY_LIFTS.some((l) => r[l.id] != null));
  const vals = rows.flatMap((r) => KEY_LIFTS.map((l) => r[l.id])).filter((v) => v != null);
  const lo = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 5) / 5) * 5) : 0;
  const hi = vals.length ? Math.ceil((Math.max(...vals) + 5) / 5) * 5 : 100;
  const full = Array.from({ length: WEEKS }, (_, i) => ({ x: i + 1, ...(rows[i] || {}) }));
  return (
    <ChartCard title="Charges clés" sub="Charge la plus lourde validée chaque semaine (kg), sur les trois mouvements de base."
      legend={KEY_LIFTS.map((l, i) => ({ name: l.name, color: LIFT_COLORS[i] }))}
      empty={!anyData ? <Empty icon="Dumbbell" title="Pas encore de charge enregistrée">Valide tes séries dans le carnet : le squat, le développé couché et le soulevé de terre roumain se tracent ici.</Empty> : null}
      table={<DataTable head={['Semaine', ...KEY_LIFTS.map((l) => l.name.split(' ')[0])]} rows={rows.map((r) => [`S${r.x}`, ...KEY_LIFTS.map((l) => (r[l.id] != null ? `${fmtNum(r[l.id], r[l.id] % 1 ? 1 : 0)} kg` : '–'))])} />}>
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={full} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="x" type="number" domain={[1, WEEKS]} ticks={[1, 3, 6, 9, 12, 15, 18]} tickFormatter={(v) => `S${v}`} {...axis} />
            <YAxis domain={[lo, hi]} tickFormatter={(v) => fmtNum(v, 0)} width={38} {...axis} />
            <Tooltip cursor={{ stroke: C.grid, strokeWidth: 1 }} content={<ChartTip title={(x) => `Semaine ${x}`} fmt={(v) => `${fmtNum(v, v % 1 ? 1 : 0)} kg`} />} />
            {KEY_LIFTS.map((l, i) => (
              <Line key={l.id} type="monotone" dataKey={l.id} name={l.name} stroke={LIFT_COLORS[i]} strokeWidth={2} connectNulls dot={{ r: 4, fill: LIFT_COLORS[i], stroke: C.surface, strokeWidth: 2 }} activeDot={{ r: 6, fill: LIFT_COLORS[i], stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function KmChart({ state }) {
  const cur = clampWeek(weekIndex(todayISO()));
  const km = runKmByWeek(state);
  const rows = RUN_PLAN.map((w) => ({ x: w.n, done: w.n <= cur ? Math.round((km[w.n] || 0) * 10) / 10 : null, plan: w.km }));
  const anyData = Object.keys(km).length > 0;
  return (
    <ChartCard title="Kilomètres par semaine" sub="Barres : kilomètres courus. Ligne : kilomètres prévus par le plan jusqu’aux 10 km."
      legend={[{ name: 'Courus (km)', color: C.aqua, bar: true }, { name: 'Prévus par le plan', color: C.blue }]}
      table={<DataTable head={['Semaine', 'Courus', 'Prévus']} rows={rows.map((r) => [`S${r.x}`, r.done != null ? `${fmtNum(r.done, 1)} km` : '–', `${fmtNum(r.plan, 1)} km`])} />}>
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="x" interval={2} tickFormatter={(v) => `S${v}`} {...axis} />
            <YAxis domain={[0, 18]} ticks={[0, 6, 12, 18]} width={38} {...axis} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTip title={(x) => `Semaine ${x}`} fmt={(v) => `${fmtNum(v, 1)} km`} />} />
            <Bar dataKey="done" name="Courus" fill={C.aqua} barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line type="monotone" dataKey="plan" name="Prévus" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: C.blue, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!anyData && <div className="text-[12.5px] text-muted mt-1">Aucune course enregistrée pour l’instant.</div>}
    </ChartCard>
  );
}

// ───────────── Allure par sortie ─────────────
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function PaceChart({ state }) {
  const runs = Object.entries(state.runs).filter(([, r]) => num(r.km) > 0 && num(r.sec) > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const rows = runs.map(([d, r], i) => ({ x: i + 1, date: d, pace: Math.round(r.sec / num(r.km)), km: num(r.km), elev: num(r.elev) || 0, hr: num(r.hr) || null, kcal: num(r.kcal) || null }));
  const vals = rows.map((r) => r.pace);
  const lo = vals.length ? Math.floor((Math.min(...vals) - 15) / 15) * 15 : 300;
  const hi = vals.length ? Math.ceil((Math.max(...vals) + 15) / 15) * 15 : 480;
  const dateOf = (x) => (rows[x - 1] ? fmtDM(rows[x - 1].date) : '');
  return (
    <ChartCard title="Allure par sortie" sub="Allure moyenne de chaque course, en minutes par kilomètre. Plus haut = plus rapide. Dénivelé, fréquence cardiaque et calories sont dans le tableau."
      legend={[{ name: 'Allure (min/km)', color: C.aqua }]}
      empty={!rows.length ? <Empty icon="Footprints" title="Pas encore de course">Enregistre une sortie (distance, durée, D+ si tu l’as) : l’allure de chaque course se trace ici.</Empty> : null}
      table={<DataTable head={['Date', 'Distance', 'Allure', 'D+', 'FC moy.']} rows={rows.map((r) => [fmtDM(r.date), `${fmtNum(r.km, 1)} km`, `${mmss(r.pace)} /km`, r.elev ? `${Math.round(r.elev)} m` : '–', r.hr ? `${r.hr}` : '–'])} />}>
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 14, bottom: 0, left: -2 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="x" tickFormatter={dateOf} interval="preserveStartEnd" {...axis} />
            <YAxis reversed domain={[lo, hi]} tickFormatter={mmss} width={44} {...axis} />
            <Tooltip cursor={{ stroke: C.grid, strokeWidth: 1 }} content={<ChartTip title={(x) => `Sortie du ${dateOf(x)}`} fmt={(v) => `${mmss(v)} /km`} />} />
            <Line type="monotone" dataKey="pace" name="Allure" stroke={C.aqua} strokeWidth={2} dot={{ r: 4, fill: C.aqua, stroke: C.surface, strokeWidth: 2 }} activeDot={{ r: 6, fill: C.aqua, stroke: C.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ───────────── Bilan de la semaine ─────────────
function ReviewRow({ label, value, sub, meter }) {
  return (
    <div className="py-2.5 hair first:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[15px] font-bold num text-right">{value}</span>
      </div>
      {meter && <div className="mt-1.5"><Meter value={meter[0]} max={meter[1]} done={meter[1] > 0 && meter[0] >= meter[1]} height={6} /></div>}
      {sub && <div className="text-[12.5px] text-muted leading-snug mt-1 num">{sub}</div>}
    </div>
  );
}

function WeekReview({ state }) {
  const today = todayISO();
  const cur = clampWeek(weekIndex(today));
  const [n, setN] = useState(cur);
  const S = state.settings;
  const W = weekSummary(state, n, today);
  const start = W.start;
  let gymPlan = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(start, i); if (d <= today && scheduleFor(d)?.type === 'gym' && !isSkipped(state, d)) gymPlan++; }
  const skipped = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today && scheduleFor(d)?.type === 'gym' && isSkipped(state, d)).length;
  const kmPlan = RUN_PLAN[n - 1].km;
  const mealPct = W.mealsPlanned ? Math.round((W.mealsDone / W.mealsPlanned) * 100) : 0;
  const arrow = 'w-11 h-11 rounded-xl bg-raised border border-line inline-flex items-center justify-center disabled:opacity-35';
  return (
    <Card title="Bilan de la semaine" icon="ClipboardList">
      <div className="flex items-center gap-2 mb-1.5">
        <button type="button" aria-label="Semaine précédente" disabled={n <= 1} onClick={() => setN(n - 1)} className={arrow}><Icon name="ChevronLeft" size={20} /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[16px] font-bold leading-tight">Semaine {n}{n === cur ? ' · en cours' : ''}</div>
          <div className="text-[12.5px] text-muted num">{fmtDM(W.start)} → {fmtDM(W.end)}</div>
        </div>
        <button type="button" aria-label="Semaine suivante" disabled={n >= cur} onClick={() => setN(n + 1)} className={arrow}><Icon name="ChevronRight" size={20} /></button>
      </div>
      <div>
        <ReviewRow label="Poids moyen" value={W.avg != null ? `${fmtNum(W.avg, 1)} kg` : '–'}
          sub={W.avg == null ? 'Aucune pesée cette semaine.' : `${W.count} pesée${W.count > 1 ? 's' : ''}${W.delta != null ? ` · ${W.delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(W.delta), 2)} kg vs la semaine précédente` : ''}${W.count < 3 ? ' · il faut 3 pesées pour que la moyenne compte dans le coach' : ''}`} />
        <ReviewRow label="Calories par jour" value={W.avgK != null ? `${fmtK(W.avgK)} kcal` : '–'} meter={W.avgK != null ? [W.avgK, W.avgT] : null}
          sub={W.avgK != null ? `Cible moyenne ${fmtK(W.avgT)} kcal · ${W.logged} jour${W.logged > 1 ? 's' : ''} renseigné${W.logged > 1 ? 's' : ''} sur ${W.elapsed}` : 'Coche tes repas pour voir ta moyenne.'} />
        <ReviewRow label="Protéines par jour" value={W.avgP != null ? `${Math.round(W.avgP)} g` : '–'} meter={W.avgP != null ? [W.avgP, S.protein] : null} sub={W.avgP != null ? `Minimum visé : ${S.protein} g` : null} />
        <ReviewRow label="Repas cochés" value={`${W.mealsDone}/${W.mealsPlanned}`} meter={[W.mealsDone, W.mealsPlanned]} sub={`${mealPct} % des repas prévus jusqu’ici`} />
        <ReviewRow label="Séances de salle" value={`${W.gym}/${gymPlan}`} meter={[W.gym, gymPlan]} sub={skipped ? `${skipped} séance${skipped > 1 ? 's' : ''} retirée${skipped > 1 ? 's' : ''} du programme cette semaine` : null} />
        <ReviewRow label="Course" value={`${fmtNum(W.km, 1)} / ${fmtNum(kmPlan, 1)} km`} meter={[W.km, kmPlan]}
          sub={W.runN ? `${W.runN} sortie${W.runN > 1 ? 's' : ''}${W.pace ? ` · allure moyenne ${mmss(W.pace)} /km` : ''}${W.up ? ` · D+ ${Math.round(W.up)} m` : ''}` : 'Aucune sortie enregistrée.'} />
        <ReviewRow label="Hydratation" value={`${W.water}/${W.elapsed} j`} meter={[W.water, W.elapsed]} sub={`Jours à ${fmtNum(S.water / 1000, 1)} L ou plus`} />
        {state.supps.some((x) => x.id === 'creatine') && <ReviewRow label="Créatine" value={`${W.creat}/${W.elapsed} j`} meter={[W.creat, W.elapsed]} />}
        {(W.sleep != null || W.energy != null) && <ReviewRow label="Forme" value={`${W.sleep != null ? `${fmtNum(W.sleep, 1)} h` : '–'} · ${W.energy != null ? `${fmtNum(W.energy, 1)}/5` : '–'}`} sub="Sommeil moyen · énergie moyenne" />}
      </div>
    </Card>
  );
}

const LEVEL = {
  good: { icon: 'CircleCheck', cls: 'text-good', label: 'Bon rythme' },
  info: { icon: 'Info', cls: 'text-blue', label: 'À savoir' },
  warning: { icon: 'TriangleAlert', cls: 'text-warn', label: 'À surveiller' },
  serious: { icon: 'TriangleAlert', cls: 'text-serious', label: 'À corriger' },
  critical: { icon: 'OctagonAlert', cls: 'text-crit', label: 'Urgent' },
};

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3.5 py-3">
      <div className="lbl">{label}</div>
      <div className="text-[28px] leading-tight font-bold mt-0.5">{value}</div>
      <div className="text-[12.5px] text-muted leading-snug mt-0.5">{sub}</div>
    </div>
  );
}

export default function Stats() {
  const state = useAppState();
  const S = state.settings;
  const cur = clampWeek(weekIndex(todayISO()));
  const co = coach(state);
  const lv = LEVEL[co.level] || LEVEL.info;
  const { kg } = latestWeight(state);
  const gymDone = Object.values(state.gym).filter((g) => Object.values(g.ex || {}).some((l) => l.some((s) => s.done))).length;
  const gp = gymPlanned(state, todayISO());
  const kmDone = Object.values(state.runs).reduce((a, r) => a + (num(r.km) || 0), 0);
  const kmPlan = RUN_PLAN.slice(0, cur).reduce((a, w) => a + w.km, 0);
  const wCount = Object.keys(state.weights).length;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Tile label="Poids actuel" value={`${fmtNum(kg)} kg`} sub={`${kg - S.startWeight >= 0 ? '+' : '−'}${fmtNum(Math.abs(kg - S.startWeight))} kg depuis le départ`} />
        <Tile label="Rythme" value={co.rate != null ? `${co.rate >= 0 ? '+' : '−'}${fmtNum(Math.abs(co.rate), 2)} kg` : '–'} sub={co.rate != null ? 'par semaine (zone 0,20 à 0,50)' : 'dès 2 semaines de pesées'} />
        <Tile label="Séances de salle" value={`${gymDone}`} sub={`sur ${gp.planned} prévues à ce jour${gp.skipped ? ` (${gp.skipped} retirée${gp.skipped > 1 ? 's' : ''})` : ''}`} />
        <Tile label="Course" value={`${fmtNum(kmDone, 1)} km`} sub={`sur ${fmtNum(kmPlan, 1)} km prévus`} />
      </div>

      <Card title="Coach calories" icon="Gauge" right={<Chip tone={co.level === 'good' ? 'good' : co.level === 'warning' ? 'warn' : co.level === 'serious' ? 'serious' : co.level === 'critical' ? 'crit' : 'blue'} icon={lv.icon}>{lv.label}</Chip>}>
        <div className="text-[16px] font-bold leading-tight">{co.title}</div>
        <div className="text-[14px] text-muted leading-snug mt-1">{co.text}</div>
        {co.projection != null && (
          <div className="mt-2.5 rounded-xl bg-raised border border-line px-3 py-2.5 text-[13.5px] leading-snug">
            Au rythme actuel : <b className="num">{fmtNum(co.projection)} kg</b> au 1ᵉʳ avril pour un objectif de {S.targetWeight} kg.
            {co.projection < S.targetWeight - 1 && <span className="text-muted"> Si l’écart se creuse, un résultat de 69 à 71 kg reste un très bon score pour 18 semaines naturelles.</span>}
          </div>
        )}
        <div className="text-[12px] text-muted mt-2.5 leading-snug">Repère : {wCount ? `${wCount} pesée${wCount > 1 ? 's' : ''} enregistrée${wCount > 1 ? 's' : ''}` : 'aucune pesée enregistrée'}. Le conseil s’appuie sur les moyennes hebdomadaires, pas sur un chiffre isolé.</div>
      </Card>

      <WeekReview state={state} />
      <WeightChart state={state} />
      <LiftsChart state={state} />
      <KmChart state={state} />
      <PaceChart state={state} />
    </div>
  );
}
