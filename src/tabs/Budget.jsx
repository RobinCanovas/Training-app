import { useState, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, Btn, Chip, Icon, Meter, Segmented, Modal, NumInput, Empty, toast, useArm, cx, fmtK } from '../ui.jsx';
import { C, ChartTip, ChartCard, DataTable, axis } from '../charts.jsx';
import { A, useAppState, saveFile, copyText } from '../store.js';
import { FOODS, CAT_ORDER } from '../data/foods.js';
import { WEEKS } from '../data/program.js';
import { todayISO, weekIndex, fmtShort, fmtNum, MONTHS_LONG } from '../lib/dates.js';
import { CATS, PRICED, foodLines, equipLabel, equipCat, price, fmtEur, planned, spent, costPerKg, dayCosts, expensesCsv } from '../lib/budget.js';

const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return `${MONTHS_LONG[mo - 1]} ${y}`; };

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3.5 py-3 min-w-0">
      <div className="lbl">{label}</div>
      <div className="text-[26px] leading-tight font-bold mt-0.5 num">{value}</div>
      <div className="text-[12.5px] text-muted leading-snug mt-0.5">{sub}</div>
    </div>
  );
}

// ───────────── Résumé ─────────────
function SpendChart({ S }) {
  const today = todayISO();
  const cur = Math.min(WEEKS, Math.max(1, weekIndex(today)));
  const last = Math.min(WEEKS, Math.max(cur, ...Object.keys(S.byWeek).map(Number)));
  const first = S.byWeek[0] ? 0 : 1;
  const rows = [];
  for (let w = first; w <= last; w++) rows.push({ x: w, v: Math.round((S.byWeek[w] || 0) * 100) / 100 });
  const name = (x) => (x === 0 ? 'Avant le départ' : `Semaine ${x}`);
  return (
    <ChartCard title="Dépenses par semaine" sub="Euros dépensés chaque semaine du programme (la semaine 1 commence le 25 novembre)."
      table={<DataTable head={['Semaine', 'Dépensé']} rows={rows.map((r) => [r.x === 0 ? 'Avant' : `S${r.x}`, fmtEur(r.v)])} />}>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="x" interval={rows.length > 9 ? 1 : 0} tickFormatter={(v) => (v === 0 ? 'Av.' : `S${v}`)} {...axis} />
            <YAxis width={44} allowDecimals={false} {...axis} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTip title={name} fmt={(v) => fmtEur(v)} />} />
            <Bar dataKey="v" name="Dépensé" fill={C.orange} barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function Summary({ state, setUi }) {
  const B = state.budget;
  const P = useMemo(() => planned(state), [state.budget]);
  const S = useMemo(() => spent(state), [state.budget.expenses]);
  const day = useMemo(() => dayCosts(B.prices), [B.prices]);
  const month = todayISO().slice(0, 7);
  const mSpent = S.byMonth[month] || 0;
  const cap = price(B.cap);
  const hasCap = Number.isFinite(cap) && cap > 0;
  const over = hasCap && mSpent > cap;
  const kg = costPerKg(state);
  const empty = !P.any && S.count === 0;
  const goPrices = () => { setUi({ budgetSub: 'prices' }); window.scrollTo({ top: 0 }); };
  const goSpend = () => { setUi({ budgetSub: 'spend' }); window.scrollTo({ top: 0 }); };
  const rows = CATS.filter((c) => P.byCat[c] > 0 || S.byCat[c] > 0);
  const missing = (P.equipCount - P.equipSet) + (P.foodCount - P.foodSet);
  const dayOk = day.std.missing === 0 && day.run.missing === 0;
  const facts = [
    dayOk && ['Un jour standard (4 repas)', fmtEur(day.std.cost, 2)],
    dayOk && ['Un jour de course (5 repas)', fmtEur(day.run.cost, 2)],
    day.shake.missing === 0 && ['Un shake Liquid Mass', fmtEur(day.shake.cost, 2)],
    P.foodSet > 0 && ['Une semaine de nourriture (au prorata)', fmtEur(P.foodWeek, 2)],
    P.foodSet > 0 && ['Au ticket de caisse (paquets entiers)', fmtEur(P.foodFull, 2)],
    kg && [`Dépensé par kilo pris (+${fmtNum(kg.gained, 1)} kg)`, fmtEur(kg.value)],
  ].filter(Boolean);

  return (
    <div>
      {empty && (
        <Card>
          <Empty icon="Wallet" title="Rien de saisi pour l’instant">
            Entre tes prix (matériel, aliments, abonnement) pour voir ce que coûte le projet, puis note tes achats au fil de l’eau. L’appli n’invente aucun prix : tout part de tes tickets.
          </Empty>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Btn variant="primary" icon="Tag" onClick={goPrices}>Saisir les prix</Btn>
            <Btn icon="Receipt" onClick={goSpend}>Noter une dépense</Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Tile label="Coût prévu" value={P.any ? fmtEur(P.total) : '–'} sub={`sur ${WEEKS} semaines`} />
        <Tile label="Dépensé" value={fmtEur(S.total)} sub={`${S.count} dépense${S.count > 1 ? 's' : ''} notée${S.count > 1 ? 's' : ''}`} />
        <Tile label="Par mois" value={P.any ? fmtEur(P.perMonth) : '–'} sub="nourriture et abonnements" />
        <Tile label="Ce mois-ci" value={fmtEur(mSpent)} sub={hasCap ? `plafond ${fmtEur(cap)}` : 'pas de plafond'} />
      </div>

      <Card title="Plafond mensuel" icon="PiggyBank" right={over ? <Chip tone="crit">Dépassé de {fmtEur(mSpent - cap)}</Chip> : hasCap ? <Chip tone="good">Reste {fmtEur(cap - mSpent)}</Chip> : null}>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div className="text-[13.5px] text-muted leading-snug">Facultatif : ce que tu veux dépenser au maximum chaque mois pour le projet.</div>
          <NumInput className="w-[112px]" value={B.cap} suffix="€" placeholder="–" ariaLabel="Plafond mensuel en euros" onChange={(v) => A.setBudget({ cap: v })} />
        </div>
        {hasCap && <div className="mt-3"><Meter value={mSpent} max={cap} height={10} /></div>}
        {hasCap && P.any && P.perMonth > cap && (
          <div className="mt-2.5 text-[13.5px] leading-snug text-warn">Ton régime prévu ({fmtEur(P.perMonth)} par mois) dépasse ce plafond : un des deux est à ajuster.</div>
        )}
      </Card>

      {!empty && (
        <Card title="Prévu et dépensé" icon="Coins">
          <div className="grid text-[11px] lbl gap-2 pb-1.5" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)' }}>
            <span>Catégorie</span><span className="text-right">Prévu</span><span className="text-right">Dépensé</span>
          </div>
          {rows.map((c) => (
            <div key={c} className="grid gap-2 py-2 hair items-baseline text-[14.5px]" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)' }}>
              <span className="font-semibold">{c}</span>
              <span className="text-right num">{P.byCat[c] > 0 ? fmtEur(P.byCat[c]) : '–'}</span>
              <span className="text-right num">{S.byCat[c] > 0 ? fmtEur(S.byCat[c]) : '–'}</span>
            </div>
          ))}
          <div className="grid gap-2 pt-2.5 pb-0.5 hair items-baseline text-[15px] font-bold" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)' }}>
            <span>Total</span>
            <span className="text-right num">{P.any ? fmtEur(P.total) : '–'}</span>
            <span className="text-right num">{fmtEur(S.total)}</span>
          </div>
          <div className="text-[12.5px] text-muted leading-snug mt-2.5">
            « Prévu » = achats uniques + nourriture sur {WEEKS} semaines + abonnements, d’après tes prix. « Dépensé » = ce que tu as noté. Les deux colonnes ne se rejoignent qu’à la fin du programme : en cours de route, compare plutôt le rythme.
          </div>
        </Card>
      )}

      {facts.length > 0 && (
        <Card title="Repères" icon="Calculator">
          <div className="grid gap-2.5 text-[14.5px] leading-snug">
            {facts.map(([k, v]) => <div key={k} className="flex items-start justify-between gap-3"><span>{k}</span><b className="num flex-none">{v}</b></div>)}
          </div>
          {P.foodSet === 0 && <div className="text-[13.5px] text-muted mt-3 hair pt-3">Saisis les prix des aliments pour voir le coût d’une journée et d’une semaine.</div>}
          {missing > 0 && (
            <div className="hair mt-3 pt-3 flex items-center justify-between gap-3">
              <span className="text-[13.5px] text-muted leading-snug">{missing} prix manquant{missing > 1 ? 's' : ''} : le « prévu » est donc sous-estimé.</span>
              <Btn size="sm" icon="Tag" onClick={goPrices}>Compléter</Btn>
            </div>
          )}
        </Card>
      )}

      {S.count > 0 && <SpendChart S={S} />}
    </div>
  );
}

// ───────────── Prix ─────────────
function PriceRow({ id, name, hint, value, label }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hair first:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold leading-tight">{name}</div>
        {hint && <div className="text-[12.5px] text-muted leading-snug mt-0.5 num">{hint}</div>}
      </div>
      <NumInput className="w-[112px] flex-none" value={value ?? ''} suffix="€" placeholder="–" ariaLabel={label} onChange={(v) => A.setPrice(id, v)} />
    </div>
  );
}

function LineEditor({ line }) {
  const [armed, setArmed] = useArm();
  const name = line.label || 'nouveau poste';
  return (
    <div className="rounded-xl bg-raised border border-line p-3">
      <input className="inp" value={line.label} placeholder="Libellé (ex. : abonnement salle)" aria-label="Libellé du poste" onChange={(e) => A.setLine(line.id, { label: e.target.value })} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <NumInput value={line.amount} suffix="€" placeholder="–" ariaLabel={`Montant : ${name}`} onChange={(v) => A.setLine(line.id, { amount: v })} />
        <select className="inp" value={CATS.includes(line.cat) ? line.cat : 'Autre'} aria-label={`Catégorie : ${name}`} onChange={(e) => A.setLine(line.id, { cat: e.target.value })}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-2 items-center">
        <Segmented options={[{ id: 'month', label: 'Par mois' }, { id: 'once', label: 'Une fois' }]} value={line.every === 'once' ? 'once' : 'month'} onChange={(v) => A.setLine(line.id, { every: v })} />
        <Btn size="sm" variant={armed ? 'danger' : 'ghost'} icon="Trash2" aria-label={armed ? `Confirmer la suppression de ${name}` : `Supprimer ${name}`} onClick={() => { if (armed) { A.removeLine(line.id); toast('Poste supprimé'); } else setArmed(true); }}>{armed ? 'Confirmer' : ''}</Btn>
      </div>
    </div>
  );
}

function Prices({ state }) {
  const B = state.budget;
  const P = useMemo(() => planned(state), [state.budget]);
  const day = useMemo(() => dayCosts(B.prices), [B.prices]);
  const groups = [...new Set(PRICED.map((e) => e.group))];
  const lines = useMemo(() => foodLines(), []);
  const byCat = CAT_ORDER.map((c) => ({ cat: c, rows: lines.filter((l) => l.cat === c).sort((a, b) => a.name.localeCompare(b.name, 'fr')) })).filter((g) => g.rows.length);
  const sum = (ids) => ids.reduce((a, id) => a + (price(B.prices[id]) || 0), 0);

  return (
    <div>
      <Card title="Comment ça marche" icon="Info">
        <div className="text-[13.5px] leading-snug text-muted">
          Entre ce que tu paies vraiment, au ticket de caisse. Rien n’est pré-rempli : l’appli ne connaît pas les prix de ton magasin. Les champs vides ne comptent pas. Pour le matériel : le prix total du poste. Pour les aliments : le prix d’<b className="text-text">un</b> paquet (celui indiqué sous le nom).
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip className="num">Matériel {P.equipSet}/{P.equipCount}</Chip>
          <Chip className="num">Aliments {P.foodSet}/{P.foodCount}</Chip>
          {P.any && <Chip tone="accent" className="num">Prévu : {fmtEur(P.total)}</Chip>}
        </div>
      </Card>

      {groups.map((g) => {
        const items = PRICED.filter((e) => e.group === g);
        const sub = sum(items.map((e) => e.id));
        return (
          <Card key={g} title={`Matériel · ${g}`} pad={false} icon="ShoppingBasket" right={sub > 0 ? <Chip className="num">{fmtEur(sub)}</Chip> : null}>
            <div className="py-1">
              {items.map((e) => (
                <PriceRow key={e.id} id={e.id} name={equipLabel(e)} hint={`Quantité prévue : ${e.qty} · ${equipCat(e).toLowerCase()}`} value={B.prices[e.id]} label={`Prix : ${equipLabel(e)}`} />
              ))}
            </div>
          </Card>
        );
      })}

      <Card title="Alimentation · prix d’un paquet" icon="Utensils" right={P.foodSet > 0 ? <Chip className="num">{fmtEur(P.foodWeek, 2)} / sem.</Chip> : null}>
        <div className="text-[13.5px] leading-snug text-muted">
          La liste de la semaine type : 5 jours standard, 2 jours de course, marge de 10 %. La whey est comptée avec les compléments ci-dessus.
        </div>
        {day.std.missing === 0 && day.run.missing === 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl bg-raised border border-line px-3 py-2"><div className="lbl">Jour standard</div><div className="text-[19px] font-bold num">{fmtEur(day.std.cost, 2)}</div></div>
            <div className="rounded-xl bg-raised border border-line px-3 py-2"><div className="lbl">Jour de course</div><div className="text-[19px] font-bold num">{fmtEur(day.run.cost, 2)}</div></div>
          </div>
        )}
      </Card>
      {byCat.map((g) => (
        <Card key={g.cat} title={g.cat} pad={false}>
          <div className="py-1">
            {g.rows.map((l) => {
              const u = price(B.prices[`food:${l.id}`]);
              const week = Number.isFinite(u) ? u * (l.total / FOODS[l.id].pack[0]) : null;
              return (
                <PriceRow key={l.id} id={`food:${l.id}`} name={l.name} value={B.prices[`food:${l.id}`]} label={`Prix : ${l.name} (${l.packLabel})`}
                  hint={`${l.packLabel} · ${fmtK(l.total)} ${l.unit} par semaine${week != null ? ` · ≈ ${fmtEur(week, 2)}` : ''}`} />
              );
            })}
          </div>
        </Card>
      ))}

      <Card title="Autres postes" icon="Receipt">
        <div className="text-[13.5px] leading-snug text-muted mb-3">Abonnement salle, prises de sang, transport… Un montant par mois (il court sur la durée du programme) ou payé une seule fois.</div>
        <div className="grid gap-3">
          {B.lines.map((l) => <LineEditor key={l.id} line={l} />)}
        </div>
        <Btn icon="Plus" className="w-full mt-3" onClick={() => A.addLine({ label: '', amount: '', every: 'month', cat: 'Autre' })}>Ajouter un poste</Btn>
      </Card>
    </div>
  );
}

// ───────────── Dépenses ─────────────
function Expenses({ state }) {
  const today = todayISO();
  const list = state.budget.expenses;
  const [f, setF] = useState({ date: today, label: '', cat: 'Alimentation', amount: '' });
  const [editId, setEditId] = useState(null);
  const [armed, setArmed] = useArm();
  const [csv, setCsv] = useState(null);
  const months = useMemo(() => { const s = new Set([today.slice(0, 7)]); list.forEach((e) => { if (e.date) s.add(String(e.date).slice(0, 7)); }); return [...s].sort(); }, [list, today]);
  const [month0, setMonth] = useState(today.slice(0, 7));
  const month = months.includes(month0) ? month0 : today.slice(0, 7);
  const mi = months.indexOf(month);
  const rows = useMemo(
    () => list.map((e, i) => ({ ...e, i })).filter((e) => String(e.date).slice(0, 7) === month).sort((a, b) => (a.date === b.date ? b.i - a.i : a.date < b.date ? 1 : -1)),
    [list, month],
  );
  const total = rows.reduce((a, e) => a + (price(e.amount) || 0), 0);
  const amount = price(f.amount);
  const valid = Number.isFinite(amount) && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.date);

  const submit = () => {
    if (!valid) return;
    const e = { date: f.date, label: f.label.trim() || f.cat, cat: f.cat, amount: f.amount };
    if (editId) { A.updateExpense(editId, e); toast('Dépense modifiée', 'good'); setEditId(null); } else { A.addExpense(e); toast('Dépense ajoutée', 'good'); }
    setF({ ...f, label: '', amount: '' });
    setMonth(f.date.slice(0, 7));
  };
  const startEdit = (e) => {
    setEditId(e.id); setArmed(false);
    setF({ date: e.date, label: e.label, cat: CATS.includes(e.cat) ? e.cat : 'Autre', amount: String(e.amount) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancel = () => { setEditId(null); setArmed(false); setF({ ...f, label: '', amount: '' }); };
  const remove = () => { A.removeExpense(editId); toast('Dépense supprimée'); cancel(); };
  const exportCsv = async () => {
    const text = expensesCsv(state);
    const r = await saveFile(`cap72-depenses-${today}.csv`, `﻿${text}`);
    if (r.ok) toast('Export proposé au téléchargement', 'good');
    else if (r.code === 'declined') toast('Téléchargement annulé');
    else setCsv(text);
  };

  return (
    <div>
      <Card title={editId ? 'Modifier la dépense' : 'Noter une dépense'} icon="Receipt" right={editId ? <Chip tone="accent">Modification</Chip> : null}>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block"><span className="lbl block mb-1.5">Montant</span><NumInput value={f.amount} suffix="€" placeholder="0" ariaLabel="Montant de la dépense" onChange={(v) => setF({ ...f, amount: v })} /></label>
          <label className="block"><span className="lbl block mb-1.5">Date</span><input type="date" className="inp" value={f.date} aria-label="Date de la dépense" onChange={(e) => e.target.value && setF({ ...f, date: e.target.value })} /></label>
        </div>
        <label className="block mt-2.5"><span className="lbl block mb-1.5">Libellé</span><input className="inp" value={f.label} placeholder="Courses, whey, abonnement…" aria-label="Libellé de la dépense" onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
        <div className="mt-2.5">
          <span className="lbl block mb-1.5">Catégorie</span>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button key={c} type="button" aria-pressed={f.cat === c} onClick={() => setF({ ...f, cat: c })}
                className={cx('min-h-[40px] rounded-xl border px-3 text-[14px] font-semibold', f.cat === c ? 'bg-accent text-accent-ink border-accent' : 'bg-raised border-line text-muted')}>{c}</button>
            ))}
          </div>
        </div>
        <div className={cx('grid gap-2 mt-3', editId ? 'grid-cols-2' : 'grid-cols-1')}>
          <Btn variant="primary" icon={editId ? 'Check' : 'Plus'} disabled={!valid} onClick={submit}>{editId ? 'Enregistrer' : 'Ajouter'}</Btn>
          {editId && <Btn onClick={cancel}>Annuler</Btn>}
        </div>
        {editId && (
          <Btn variant="danger" className="w-full mt-2" icon="Trash2" onClick={() => { if (armed) remove(); else setArmed(true); }}>
            {armed ? 'Confirmer la suppression' : 'Supprimer cette dépense'}
          </Btn>
        )}
      </Card>

      <Card title="Historique" icon="Wallet" pad={false}
        right={<Chip className="num mr-1">{fmtEur(total, 2)}</Chip>}>
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
          <button type="button" aria-label="Mois précédent" disabled={mi <= 0} onClick={() => setMonth(months[mi - 1])} className="w-10 h-10 rounded-xl bg-raised border border-line inline-flex items-center justify-center disabled:opacity-30"><Icon name="ChevronLeft" size={18} /></button>
          <div className="text-[15px] font-bold capitalize">{monthLabel(month)}</div>
          <button type="button" aria-label="Mois suivant" disabled={mi >= months.length - 1} onClick={() => setMonth(months[mi + 1])} className="w-10 h-10 rounded-xl bg-raised border border-line inline-flex items-center justify-center disabled:opacity-30"><Icon name="ChevronRight" size={18} /></button>
        </div>
        {rows.length === 0 ? (
          <Empty icon="Receipt" title="Aucune dépense ce mois-ci">Note un achat ci-dessus : il apparaît ici et dans le résumé.</Empty>
        ) : (
          <div className="py-1">
            {rows.map((e) => (
              <button key={e.id} type="button" onClick={() => startEdit(e)} aria-label={`Modifier la dépense ${e.label} du ${fmtShort(e.date)}`}
                className={cx('w-full flex items-center gap-3 px-4 py-2.5 text-left hair first:border-0', editId === e.id && 'bg-raised')}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{e.label}</span>
                  <span className="block text-[12.5px] text-muted num">{fmtShort(e.date)} · {e.cat}</span>
                </span>
                <b className="num text-[15.5px] flex-none">{fmtEur(price(e.amount), 2)}</b>
                <Icon name="Pencil" size={15} className="text-muted flex-none" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {list.length > 0 && <Btn className="w-full mb-3" icon="Download" onClick={exportCsv}>Exporter les dépenses (CSV)</Btn>}

      <Modal open={csv != null} onClose={() => setCsv(null)} title="Dépenses (CSV)">
        <div className="text-[13.5px] text-muted mb-2 leading-snug">Le téléchargement direct n’est pas disponible ici. Copie ce texte dans un fichier .csv ou colle-le dans ton tableur.</div>
        <textarea readOnly className="inp py-2.5 min-h-[160px] text-[12px] font-mono" value={csv || ''} onFocus={(e) => e.target.select()} aria-label="Dépenses au format CSV" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Btn onClick={() => setCsv(null)}>Fermer</Btn>
          <Btn variant="primary" icon="Copy" onClick={async () => { (await copyText(csv || '')) ? toast('Texte copié', 'good') : toast('Copie impossible : sélectionne le texte', 'warn'); }}>Copier</Btn>
        </div>
      </Modal>
    </div>
  );
}

export default function Budget({ ui, setUi }) {
  const state = useAppState();
  const sub = ui.budgetSub || 'sum';
  return (
    <div>
      <Segmented className="mb-3" options={[{ id: 'sum', label: 'Résumé' }, { id: 'prices', label: 'Prix' }, { id: 'spend', label: 'Dépenses' }]} value={sub} onChange={(v) => setUi({ budgetSub: v })} />
      {sub === 'sum' && <Summary state={state} setUi={setUi} />}
      {sub === 'prices' && <Prices state={state} />}
      {sub === 'spend' && <Expenses state={state} />}
    </div>
  );
}
