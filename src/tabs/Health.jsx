import { useState } from 'react';
import { Card, Btn, Chip, Icon, Meter, Segmented, NumInput, Field, Empty, toast, useArm, cx } from '../ui.jsx';
import { A, useAppState } from '../store.js';
import { EQUIPMENT, BLOOD_MARKERS, BLOOD_NOTES, BODY_MEASURES, BODY_EVERY_DAYS } from '../data/health.js';
import { todayISO, weekStart, weekEnd, fmtDM, fmtShort, fmtNum, diffDays } from '../lib/dates.js';
import { num } from '../lib/calc.js';
import { measureDates, measureStatus } from '../lib/body.js';

function Gear({ state }) {
  const groups = [...new Set(EQUIPMENT.map((e) => e.group))];
  const done = EQUIPMENT.filter((e) => state.equip[e.id]).length;
  return (
    <div>
      <Card title="Avant de commencer" icon="PackageCheck" right={<Chip tone={done === EQUIPMENT.length ? 'good' : undefined} className="num">{done}/{EQUIPMENT.length}</Chip>}>
        <Meter value={done} max={EQUIPMENT.length} done={done === EQUIPMENT.length} height={10} />
        <div className="text-[13.5px] text-muted mt-2.5 leading-snug">Coche au fur et à mesure. Pour démarrer il te faut seulement la balance de cuisine, le pèse-personne, le shaker, la whey et les chaussures : le reste peut arriver dans la première semaine.</div>
      </Card>
      {groups.map((g) => (
        <Card key={g} title={g} pad={false}>
          <div className="py-1">
            {EQUIPMENT.filter((e) => e.group === g).map((e) => {
              const on = !!state.equip[e.id];
              return (
                <button key={e.id} type="button" className="w-full flex items-start gap-3 px-4 py-3 text-left hair first:border-0" aria-pressed={on} onClick={() => A.setEquip(e.id, !on)}>
                  <span className="check mt-0.5" data-on={on ? '1' : '0'}>{on && <Icon name="Check" size={18} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cx('text-[15.5px] font-semibold leading-tight', on && 'text-muted line-through decoration-1')}>{e.name}</span>
                      <Chip className="flex-none num">{e.qty}</Chip>
                    </span>
                    <span className="block text-[13px] text-muted leading-snug mt-1">{e.why}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Blood({ state }) {
  const B = state.blood;
  const today = todayISO();
  const w12s = weekStart(12), w12e = weekEnd(12);
  const toS12 = diffDays(w12s, today);
  const groups = [...new Set(BLOOD_MARKERS.map((m) => m.group))];
  const filled = (t) => BLOOD_MARKERS.filter((m) => Number.isFinite(num(B.v[m.id]?.[t]))).length;
  return (
    <div>
      <Card title="Dates des prises de sang" icon="Droplet">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Bilan de départ (T0)"><input type="date" className="inp" value={B.t0Date} onChange={(e) => A.setBlood({ t0Date: e.target.value })} /></Field>
          <Field label="Contrôle semaine 12"><input type="date" className="inp" value={B.t12Date} onChange={(e) => A.setBlood({ t12Date: e.target.value })} /></Field>
        </div>
        <div className="mt-3 rounded-xl bg-raised border border-line px-3 py-2.5 text-[13.5px] leading-snug">
          <div className="flex items-center gap-2 font-semibold"><Icon name="CalendarClock" size={16} className="text-blue" />Fenêtre du contrôle : {fmtDM(w12s)} → {fmtDM(w12e)} 2027</div>
          <div className="text-muted mt-0.5">{toS12 > 0 ? `Dans ${toS12} jours.` : 'La fenêtre est ouverte ou passée.'} Bilan de départ : le plus tôt possible, idéalement dans les deux premières semaines.</div>
        </div>
        <div className="flex gap-2 mt-2.5"><Chip className="num">T0 : {filled('t0')}/{BLOOD_MARKERS.length}</Chip><Chip className="num">S12 : {filled('t12')}/{BLOOD_MARKERS.length}</Chip></div>
      </Card>

      {groups.map((g) => (
        <Card key={g} title={g} pad={false}>
          <div className="grid text-[11px] lbl gap-2 px-4 pt-3 pb-1.5" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)' }}>
            <span>Marqueur</span><span>T0</span><span>S12</span>
          </div>
          {BLOOD_MARKERS.filter((m) => m.group === g).map((m) => {
            const a = num(B.v[m.id]?.t0), b = num(B.v[m.id]?.t12);
            const d = Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
            return (
              <div key={m.id} className="grid gap-2 px-4 py-2 hair items-center" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)' }}>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold leading-tight">{m.name}</div>
                  <div className="text-[12px] text-muted num">{m.unit}{d != null && <span className="ml-1.5 text-text font-semibold">Δ {d > 0 ? '+' : d < 0 ? '−' : ''}{fmtNum(Math.abs(d), Math.abs(d) < 10 ? 2 : 1)}</span>}</div>
                </div>
                <NumInput value={B.v[m.id]?.t0 ?? ''} onChange={(v) => A.setBloodValue(m.id, 't0', v)} placeholder="–" ariaLabel={`${m.name} au bilan de départ`} />
                <NumInput value={B.v[m.id]?.t12 ?? ''} onChange={(v) => A.setBloodValue(m.id, 't12', v)} placeholder="–" ariaLabel={`${m.name} au contrôle de la semaine 12`} />
              </div>
            );
          })}
        </Card>
      ))}

      <Card title="Avant d’y aller" icon="Info">
        <ul className="grid gap-2.5">{BLOOD_NOTES.map((t, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-snug"><span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-blue flex-none" /><span>{t}</span></li>)}</ul>
      </Card>
      <Card title="Notes" icon="NotebookPen">
        <textarea className="inp py-2.5 min-h-[96px]" value={B.notes} onChange={(e) => A.setBlood({ notes: e.target.value })} placeholder="Laboratoire, remarques du médecin, ordonnance…" aria-label="Notes sur le bilan sanguin" />
      </Card>
    </div>
  );
}

// ───────────── Mensurations ─────────────
const sgn = (d) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtNum(Math.abs(d), 1)}`;

function Body({ state }) {
  const today = todayISO();
  const body = state.body;
  const dates = measureDates(body);
  const st = measureStatus(body, today);
  const blank = Object.fromEntries(BODY_MEASURES.map((m) => [m.id, '']));
  const load = (d) => ({ date: d, ...Object.fromEntries(BODY_MEASURES.map((m) => [m.id, body[d]?.[m.id] ?? ''])) });
  const [f, setF] = useState(() => ({ date: today, ...blank }));
  const [armed, setArmed] = useArm();
  const exists = dates.includes(f.date);
  const vals = BODY_MEASURES.map((m) => ({ ...m, x: num(f[m.id]) }));
  const filled = vals.filter((v) => Number.isFinite(v.x));
  const odd = filled.some((v) => v.x < 10 || v.x > 250);
  const valid = filled.length > 0 && !odd && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.date <= today;

  const save = () => {
    if (!valid) return;
    const m = {};
    for (const v of filled) m[v.id] = f[v.id];
    A.setBody(f.date, m);
    toast(exists ? 'Mesures mises à jour' : 'Mesures enregistrées', 'good');
  };
  const remove = () => { A.deleteBody(f.date); toast('Mesures supprimées'); setArmed(false); setF({ date: f.date, ...blank }); };
  const prevOf = (id, i) => { for (let j = i - 1; j >= 0; j--) { const v = num(body[dates[j]]?.[id]); if (Number.isFinite(v)) return v; } return null; };
  const first = (id) => { for (const d of dates) { const v = num(body[d]?.[id]); if (Number.isFinite(v)) return v; } return null; };
  const lastV = (id) => { for (let i = dates.length - 1; i >= 0; i--) { const v = num(body[dates[i]]?.[id]); if (Number.isFinite(v)) return v; } return null; };

  return (
    <div>
      <Card title="Mètre ruban" icon="Ruler" right={st.last ? <Chip tone={st.due ? 'warn' : 'good'} className="num">{st.due ? 'À refaire' : `Prochaine : ${fmtDM(st.next)}`}</Chip> : <Chip tone="warn">À faire</Chip>}>
        <div className="text-[13.5px] text-muted leading-snug">
          {st.last ? `Dernière mesure il y a ${st.since} jour${st.since > 1 ? 's' : ''} (${fmtShort(st.last)}).` : 'Aucune mesure pour l’instant.'} Refais-les toutes les {BODY_EVERY_DAYS / 7} semaines, le matin, détendu, au même endroit du corps : c’est l’évolution qui compte, pas le chiffre.
        </div>
      </Card>

      <Card title={exists ? 'Modifier une mesure' : 'Nouvelle mesure'} icon="Pencil" right={exists ? <Chip tone="accent">Existante</Chip> : null}>
        <Field label="Date"><input type="date" className="inp" max={today} value={f.date} aria-label="Date de la mesure" onChange={(e) => { const d = e.target.value; if (d) setF(dates.includes(d) ? load(d) : { ...f, date: d }); }} /></Field>
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          {BODY_MEASURES.map((m) => (
            <Field key={m.id} label={m.label}><NumInput value={f[m.id]} suffix="cm" placeholder="–" ariaLabel={`${m.label} en centimètres`} onChange={(v) => setF({ ...f, [m.id]: v })} /></Field>
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-[12.5px] text-muted leading-snug">
          {BODY_MEASURES.map((m) => <li key={m.id}><b className="text-text font-semibold">{m.label.replace('Tour de ', '')}</b> : {m.how.charAt(0).toLowerCase()}{m.how.slice(1)}</li>)}
        </ul>
        {odd && <div className="mt-2.5 text-[13.5px] text-warn leading-snug">Une valeur semble hors limites : saisis des centimètres (entre 10 et 250).</div>}
        <Btn variant="primary" className="w-full mt-3" icon="Check" disabled={!valid} onClick={save}>{exists ? 'Mettre à jour' : 'Enregistrer'}</Btn>
        {exists && (
          <Btn variant="danger" className="w-full mt-2" icon="Trash2" onClick={() => { if (armed) remove(); else setArmed(true); }}>
            {armed ? 'Confirmer la suppression' : 'Supprimer cette mesure'}
          </Btn>
        )}
      </Card>

      {dates.length >= 2 && (
        <Card title="Depuis la première mesure" icon="TrendingUp">
          <div className="grid grid-cols-2 gap-2">
            {BODY_MEASURES.map((m) => {
              const a = first(m.id), b = lastV(m.id);
              return (
                <div key={m.id} className="rounded-xl bg-raised border border-line px-3 py-2">
                  <div className="lbl">{m.label.replace('Tour de ', '')}</div>
                  <div className="text-[19px] font-bold num">{a != null && b != null && a !== b ? `${sgn(b - a)} cm` : a != null && b != null ? '± 0 cm' : '–'}</div>
                  <div className="text-[12px] text-muted num">{a != null && b != null ? `${fmtNum(a, 1)} → ${fmtNum(b, 1)}` : ''}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card title="Historique" icon="History" pad={false}>
        {dates.length === 0 ? (
          <Empty icon="Ruler" title="Aucune mesure">Prends tes mesures de départ cette semaine : elles servent de point de comparaison.</Empty>
        ) : (
          <div className="py-1">
            {[...dates].reverse().map((d) => {
              const i = dates.indexOf(d);
              return (
                <button key={d} type="button" className="w-full px-4 py-3 text-left hair first:border-0" aria-label={`Modifier les mesures du ${fmtShort(d)}`} onClick={() => { setF(load(d)); setArmed(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold">{fmtShort(d)}</span><Icon name="Pencil" size={15} className="text-muted" /></span>
                  <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[13.5px] num">
                    {BODY_MEASURES.map((m) => {
                      const v = num(body[d]?.[m.id]);
                      if (!Number.isFinite(v)) return <span key={m.id} className="text-muted">{m.label.replace('Tour de ', '')} : –</span>;
                      const p = prevOf(m.id, i);
                      return <span key={m.id}><span className="text-muted">{m.label.replace('Tour de ', '')}</span> <b>{fmtNum(v, 1)}</b>{p != null && <span className="text-muted"> ({sgn(v - p)})</span>}</span>;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Info() {
  return (
    <div>
      <Card title="Compléments : mode d’emploi" icon="Pill">
        <div className="grid gap-3 text-[14px] leading-snug">
          <div><b>Créatine monohydrate</b><div className="text-muted">3 à 5 g par jour, tous les jours, y compris les jours de repos. Pas de phase de charge nécessaire. Bois suffisamment : 3 L par jour.</div></div>
          <div><b>Whey</b><div className="text-muted">Un complément pour atteindre tes protéines, pas une obligation : 25 g dans le shake Liquid Mass.</div></div>
          <div><b>Oméga-3</b><div className="text-muted">Au repas, pour viser ≈ 1 g d’EPA + DHA par jour. Lis le dosage d’EPA + DHA sur l’étiquette.</div></div>
          <div><b>Magnésium bisglycinate</b><div className="text-muted">Le soir, selon l’étiquette. Évite de dépasser ≈ 250 mg de magnésium élémentaire par jour en complément.</div></div>
          <div className="text-[12.5px] text-muted hair pt-2.5">Ces repères sont généraux. Si tu prends un traitement ou as un antécédent médical, demande l’avis de ton médecin ou de ton pharmacien avant de commencer un complément.</div>
        </div>
      </Card>
    </div>
  );
}

export default function Health({ ui, setUi }) {
  const state = useAppState();
  const sub = ui.healthSub || 'gear';
  return (
    <div>
      <Segmented className="mb-3" options={[{ id: 'gear', label: 'Matériel' }, { id: 'blood', label: 'Sang' }, { id: 'body', label: 'Mesures' }, { id: 'info', label: 'Repères' }]} value={sub} onChange={(v) => setUi({ healthSub: v })} />
      {sub === 'gear' && <Gear state={state} />}
      {sub === 'blood' && <Blood state={state} />}
      {sub === 'body' && <Body state={state} />}
      {sub === 'info' && <Info />}
    </div>
  );
}
