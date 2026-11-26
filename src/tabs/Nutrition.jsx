import { useState, useMemo } from 'react';
import { Card, Btn, Chip, Icon, Segmented, Meter, toast, cx, fmtK } from '../ui.jsx';
import { A, useAppState, copyText, saveFile } from '../store.js';
import { DAY_TYPES, RECIPES, RESCUE, buildAlarms, weeklyShopping, EXTRA_STOCK, VARIANTS, VARIED, mealFor, dayPlan, variantsFor, rampFactor, rampDeficit, RAMP } from '../data/nutrition.js';
import { FOODS, CAT_ORDER, fmtQty } from '../data/foods.js';
import { todayISO, weekIndex, clampWeek, toMin, dow } from '../lib/dates.js';
import { dayTypeFor, targetsFor } from '../lib/calc.js';
import { shoppingCost, fmtEur, costOfItems } from '../lib/budget.js';
import { WEEKS } from '../data/program.js';
import { buildIcs } from '../lib/ics.js';

// Composition du jour pour la semaine en cours (avant le départ : semaine 1)
const planWeek = (date = todayISO()) => Math.max(1, clampWeek(weekIndex(date)));
const optsOf = (state, week) => ({ week, whey: state.settings.wheyOn !== false, variants: variantsFor(state.settings, week) });
const ingr = (id, q) => `${FOODS[id].n} · ${fmtQty(id, q)}`;

// Répartition des calories : barre segmentée fine (la légende nomme et chiffre chaque part)
function MacroSplit({ m }) {
  const parts = [
    { id: 'p', name: 'Protéines', kcal: m.p * 4, g: m.p, cls: 'bg-blue' },
    { id: 'c', name: 'Glucides', kcal: m.c * 4, g: m.c, cls: 'bg-accent' },
    { id: 'f', name: 'Lipides', kcal: m.f * 9, g: m.f, cls: 'bg-aqua' },
  ];
  const tot = parts.reduce((a, p) => a + p.kcal, 0) || 1;
  return (
    <div>
      <div className="flex gap-[2px] h-2 rounded-full overflow-hidden" role="img" aria-label={parts.map((p) => `${p.name} ${Math.round((p.kcal / tot) * 100)} %`).join(', ')}>
        {parts.map((p) => <div key={p.id} className={p.cls} style={{ width: `${(p.kcal / tot) * 100}%` }} />)}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {parts.map((p) => (
          <div key={p.id}>
            <div className="flex items-center gap-1.5 text-[12px] text-muted"><span className={cx('w-2.5 h-2.5 rounded-[3px]', p.cls)} />{p.name}</div>
            <div className="text-[17px] font-bold num leading-tight">{p.g} g</div>
            <div className="text-[12px] text-muted num">{Math.round((p.kcal / tot) * 100)} %</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayTypes({ state }) {
  const today = todayISO();
  const week = planWeek(today);
  const [type, setType] = useState(dayTypeFor(state, today));
  const [open, setOpen] = useState(null);
  const D = useMemo(() => dayPlan(type, optsOf(state, week)), [type, week, state.settings]);
  const times = state.settings.times[type];
  const ramp = rampDeficit(week);
  const base = state.settings.baseKcal - ramp;
  const tStd = base, tRun = base + state.settings.runBonus;
  const target = type === 'run' ? tRun : tStd;
  const list = D.meals.slice().sort((a, b) => toMin(times[a.id]) - toMin(times[b.id]));
  return (
    <div>
      <Segmented className="mb-3" options={[{ id: 'std', label: `Standard · ${fmtK(tStd)} kcal` }, { id: 'run', label: `Course · ${fmtK(tRun)} kcal` }]} value={type} onChange={setType} />
      {ramp > 0 && (
        <div className="mb-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-[13.5px] leading-snug">
          <b>Semaine {week} : montée progressive.</b> Le shake est dosé à {Math.round(rampFactor(week) * 100)} % ; il passe à la dose pleine à la semaine {RAMP.length + 1}. Tes repas solides restent identiques, seul le shake monte : pas de choc pour l’estomac, et un seul levier à retenir.
        </div>
      )}
      <Card title="Total de la journée" icon="Flame" right={<Chip className="num">cible {fmtK(target)} kcal</Chip>}>
        <div className="flex items-end justify-between mb-3">
          <div className="text-[40px] leading-none font-bold num">{fmtK(D.macros.k)}<span className="text-[16px] text-muted font-semibold ml-1">kcal</span></div>
          <div className="text-[13px] text-muted num pb-1">{D.macros.k >= target ? '+' : '−'}{Math.abs(D.macros.k - target)} vs cible</div>
        </div>
        <MacroSplit m={D.macros} />
        <div className="text-[12.5px] text-muted mt-3 leading-snug">Protéines et glucides sont des minimums (≥ {state.settings.protein} g et ≥ {state.settings.carbMin} g) : dépasser ne pose pas de problème. Les quantités sont en poids cru ; pèse-les les deux premières semaines, puis tu les reconnaîtras à l’œil.</div>
      </Card>
      {list.map((m) => {
        const id = m.id;
        const isOpen = open === id;
        return (
          <section key={id} className="card mb-3">
            <button type="button" className="w-full px-4 py-3 flex items-center gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
              <div className="w-10 h-10 rounded-xl bg-raised inline-flex items-center justify-center text-accent flex-none"><Icon name={m.icon} size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted num font-semibold">{times[id]} · {m.name}</div>
                <div className="text-[16.5px] font-bold leading-tight">{m.title}</div>
                <div className="text-[13px] text-muted num mt-0.5">{m.macros.k} kcal · {m.macros.p} g P · {m.macros.c} g G · {m.macros.f} g L</div>
              </div>
              <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-muted flex-none" />
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <ul className="grid gap-1.5 mb-2.5">{m.items.map(([fid, q]) => <li key={fid} className="flex items-center gap-2.5 text-[14.5px]"><span className="w-1.5 h-1.5 rounded-full bg-accent flex-none" />{ingr(fid, q)}</li>)}</ul>
                <div className="text-[13.5px] text-muted leading-snug hair pt-2.5">{m.how}</div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ───────────── Varier : changer de menu sans changer d'objectif ─────────────
function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('w-12 h-7 rounded-full border relative transition flex-none', on ? 'bg-accent border-accent' : 'bg-raised border-line')}>
      <span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-text transition-all', on ? 'left-[22px] !bg-accent-ink' : 'left-0.5')} />
    </button>
  );
}

function Vary({ state, setUi }) {
  const S = state.settings;
  const week = planWeek();
  const cur = variantsFor(S, week);
  const [open, setOpen] = useState(null);
  const eur = (items) => { const c = costOfItems(items, state.budget.prices); return c.missing === 0 && c.cost > 0 ? fmtEur(c.cost, 2) : null; };
  const shake = mealFor('shake', optsOf(state, week));
  return (
    <div>
      <div className="text-[13.5px] text-muted mb-3 leading-snug">Choisis ce que tu manges au petit-déjeuner, à midi et le soir. Chaque variante vise les mêmes calories et les mêmes protéines que le menu de base : les restants du jour, les recettes, la liste de courses et le budget suivent automatiquement. Les repas déjà cochés gardent le menu qui était choisi ce jour-là.</div>
      <Card title="Rotation automatique" icon="Shuffle" right={<Switch on={!!S.rotate} onChange={(v) => A.setSettings({ rotate: v })} label="Rotation automatique des menus" />}>
        <div className="text-[13.5px] text-muted leading-snug">{S.rotate ? 'Les menus changent chaque semaine, dans un ordre décalé d’un repas à l’autre : tu ne manges jamais le même trio deux semaines de suite. Ton choix manuel est mis de côté.' : 'Désactivée : le menu que tu choisis ci-dessous reste le même jusqu’à ce que tu le changes.'}</div>
      </Card>
      {VARIED.map((mid) => {
        const meal = mealFor(mid, { variant: cur[mid] });
        return (
          <Card key={mid} title={`${meal.name}`} icon={meal.icon}>
            <div className="grid gap-2">
              {VARIANTS[mid].map((v) => {
                const on = cur[mid] === v.id;
                const isOpen = open === v.id;
                const cost = eur(v.items);
                return (
                  <div key={v.id} className={cx('rounded-xl border', on ? 'border-accent bg-accent/10' : 'border-line bg-raised/60')}>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button type="button" role="radio" aria-checked={on} disabled={!!S.rotate} aria-label={`${meal.name} : ${v.title}`} onClick={() => { A.setVariant(mid, v.id); toast(`${meal.name} : ${v.title}`, 'good'); }}
                        className="min-w-0 flex-1 text-left flex items-center gap-2.5 disabled:opacity-100">
                        <span className={cx('w-5 h-5 rounded-full border-2 flex-none inline-flex items-center justify-center', on ? 'border-accent' : 'border-line')}>{on && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}</span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold leading-tight">{v.title}</span>
                          <span className="block text-[12.5px] text-muted num leading-tight mt-0.5">{v.tag} · {v.macros.k} kcal · {v.macros.p} g P{cost ? ` · ${cost}` : ''}</span>
                        </span>
                      </button>
                      <button type="button" aria-label={`Recette ${v.title}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.id)} className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-muted flex-none">
                        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="px-3.5 pb-3 text-[13.5px]">
                        <ul className="text-muted leading-snug">{v.items.map(([fid, q]) => <li key={fid}>{ingr(fid, q)}</li>)}</ul>
                        <div className="mt-1.5 text-muted leading-snug">{v.how}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <Card title="Shake et whey" icon="GlassWater" right={<Switch on={S.wheyOn !== false} onChange={(v) => A.setSettings({ wheyOn: v })} label="Whey dans le shake" />}>
        <div className="text-[13.5px] text-muted leading-snug">{S.wheyOn !== false
          ? 'Le shake contient 25 g de whey (≈ 20 g de protéines). Pas encore de whey ? Décoche : le shake se fait sans, il perd ≈ 100 kcal et 20 g de protéines, et la whey sort de la liste de courses et du budget.'
          : 'Shake sans whey pour l’instant : il fait ' + shake.macros.k + ' kcal et ' + shake.macros.p + ' g de protéines. Compense avec un skyr ou un œuf en plus. Active la whey dès que tu en as : tout se recalcule.'}</div>
        <div className="text-[13px] mt-2 num"><b>Cette semaine :</b> {shake.macros.k} kcal · {shake.macros.p} g P (dose {Math.round(rampFactor(week) * 100)} %)</div>
        <Btn size="sm" className="mt-3" icon="Wallet" onClick={() => setUi({ tab: 'budget', budgetSub: 'prices' })}>Voir le prix de la whey dans Compta</Btn>
      </Card>
    </div>
  );
}

function Recipes({ state }) {
  const date = todayISO();
  const shake = mealFor('shake', optsOf(state, planWeek(date)));
  const [open, setOpen] = useState('liquid');
  return (
    <div>
      <div className="text-[13.5px] text-muted mb-3 leading-snug">Sept repas qui demandent moins de 5 minutes. « Ajouter » les compte dans tes restants du jour.</div>
      {RECIPES.map((r0) => {
        const r = r0.id === 'liquid' ? { ...r0, items: shake.items, macros: shake.macros } : r0;
        const isOpen = open === r.id;
        return (
          <section key={r.id} className={cx('card mb-3', r.id === 'liquid' && 'border-accent/50')}>
            <button type="button" className="w-full px-4 py-3 flex items-start gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1"><Chip icon="Timer">{r.time}</Chip><Chip>{r.tag}</Chip></div>
                <div className="text-[17px] font-bold leading-tight">{r.name}</div>
                <div className="text-[13px] text-muted num mt-1">{r.macros.k} kcal · {r.macros.p} g P · {r.macros.c} g G · {r.macros.f} g L</div>
              </div>
              <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-muted flex-none mt-1" />
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <div className="text-[14px] text-muted leading-snug mb-3">{r.lead}</div>
                <div className="lbl mb-1.5">Ingrédients</div>
                <ul className="grid gap-1.5 mb-3">{r.items.map(([fid, q]) => <li key={fid} className="flex items-center gap-2.5 text-[14.5px]"><span className="w-1.5 h-1.5 rounded-full bg-accent flex-none" />{ingr(fid, q)}</li>)}</ul>
                <div className="lbl mb-1.5">Étapes</div>
                <ol className="grid gap-2 mb-3">{r.steps.map((s, i) => <li key={i} className="flex gap-2.5 text-[14.5px] leading-snug"><span className="w-5 h-5 flex-none rounded-full bg-raised text-[12px] font-bold inline-flex items-center justify-center mt-0.5 num">{i + 1}</span><span>{s}</span></li>)}</ol>
                <div className="text-[13px] text-muted leading-snug rounded-xl bg-raised px-3 py-2.5 mb-3"><b className="text-text">Variante : </b>{r.swap}</div>
                <Btn variant="primary" className="w-full" icon="Plus" onClick={() => { A.addExtra(date, { label: r.name, ...r.macros }); toast(`Ajouté à aujourd’hui : ${r.name}`, 'good'); }}>Ajouter à aujourd’hui</Btn>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Stepper({ label, value, onChange, min = 0, max = 7 }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[14.5px] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Moins de ${label}`} className="w-10 h-10 rounded-xl bg-raised border border-line inline-flex items-center justify-center" onClick={() => onChange(Math.max(min, value - 1))}><Icon name="Minus" size={17} /></button>
        <span className="w-6 text-center text-[18px] font-bold num">{value}</span>
        <button type="button" aria-label={`Plus de ${label}`} className="w-10 h-10 rounded-xl bg-raised border border-line inline-flex items-center justify-center" onClick={() => onChange(Math.min(max, value + 1))}><Icon name="Plus" size={17} /></button>
      </div>
    </div>
  );
}

function Shopping({ state, setUi }) {
  const today = todayISO();
  const [ahead, setAhead] = useState(dow(today) === 0 ? 1 : 0);
  const week = Math.min(WEEKS, planWeek(today) + ahead);
  const wkKey = `S${week}`;
  const [stdDays, setStd] = useState(5);
  const [runDays, setRun] = useState(2);
  const [margin, setMargin] = useState(true);
  const checked = state.shop[wkKey] || {};
  const lines = useMemo(() => weeklyShopping({ stdDays, runDays, margin, ...optsOf(state, week) }), [stdDays, runDays, margin, week, state.settings]);
  const byCat = CAT_ORDER.map((c) => ({ cat: c, rows: lines.filter((l) => l.cat === c).sort((a, b) => a.name.localeCompare(b.name, 'fr')) })).filter((g) => g.rows.length);
  const done = lines.filter((l) => checked[l.id]).length;
  const cost = useMemo(() => shoppingCost(lines, state.budget.prices), [lines, state.budget.prices]);

  const hint = (l) => {
    const pcs = l.piece ? Math.ceil(l.total / l.piece[0]) : null;
    if (pcs && (l.id === 'banana' || l.id === 'egg' || l.id === 'apple' || l.id === 'avocado')) return `≈ ${pcs} ${l.piece[1]}${pcs > 1 ? 's' : ''}`;
    return `${l.packs} × ${l.packLabel}`;
  };
  const toText = () => {
    const out = [`Courses — semaine ${week} (${stdDays} jours standard + ${runDays} jours de course${margin ? ', +10 %' : ''})`, ''];
    for (const g of byCat) { out.push(g.cat.toUpperCase()); g.rows.forEach((l) => out.push(`- ${l.name} : ${fmtK(l.total)} ${l.unit} (${hint(l)})`)); out.push(''); }
    out.push('COMPLÉMENTS (stock)'); EXTRA_STOCK.forEach((e) => out.push(`- ${e.name}`));
    return out.join('\n');
  };
  const copy = async () => { (await copyText(toText())) ? toast('Liste copiée', 'good') : toast('Copie impossible : sélectionne le texte à la main', 'warn'); };

  return (
    <div>
      <Segmented className="mb-3" options={[{ id: 0, label: `Semaine ${planWeek(today)}` }, { id: 1, label: `Semaine ${Math.min(WEEKS, planWeek(today) + 1)}` }]} value={ahead} onChange={setAhead} />
      <Card title="Générateur de la semaine" icon="ShoppingBasket" right={<Chip tone={done === lines.length ? 'good' : undefined} className="num">{done}/{lines.length}</Chip>}>
        <Stepper label="Jours standard" value={stdDays} onChange={(v) => { setStd(v); }} />
        <Stepper label="Jours de course" value={runDays} onChange={(v) => setRun(v)} />
        <label className="flex items-center justify-between gap-3 py-1.5 mt-1 hair pt-3">
          <span className="text-[14.5px] font-medium">Marge de 10 % <span className="text-muted font-normal">(pertes, restes)</span></span>
          <button type="button" role="switch" aria-checked={margin} onClick={() => setMargin(!margin)} className={cx('w-12 h-7 rounded-full border relative transition', margin ? 'bg-accent border-accent' : 'bg-raised border-line')}>
            <span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-text transition-all', margin ? 'left-[22px] !bg-accent-ink' : 'left-0.5')} />
          </button>
        </label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Btn icon="Copy" onClick={copy}>Copier la liste</Btn>
          <Btn icon="RotateCcw" onClick={() => { A.clearShop(wkKey); toast('Cases décochées'); }}>Tout décocher</Btn>
        </div>
      </Card>
      {cost.set > 0 && (
        <Card title="Budget de cette liste" icon="Wallet" right={<Chip className="num">{fmtEur(cost.cost, 2)}</Chip>}>
          <div className="text-[13.5px] text-muted leading-snug">Au ticket de caisse, avec des paquets entiers et sans les compléments{cost.set < cost.count ? ` (il manque ${cost.count - cost.set} prix)` : ''}. Le surplus d’un paquet sert la semaine suivante.</div>
          {cost.set < cost.count && <Btn size="sm" className="mt-2.5" icon="Tag" onClick={() => setUi({ tab: 'budget', budgetSub: 'prices' })}>Compléter les prix</Btn>}
        </Card>
      )}
      {byCat.map((g) => (
        <Card key={g.cat} title={g.cat} pad={false}>
          <div className="py-1">
            {g.rows.map((l) => {
              const on = !!checked[l.id];
              return (
                <button key={l.id} type="button" className="w-full flex items-center gap-3 px-4 py-2.5 text-left hair first:border-0" aria-pressed={on} onClick={() => A.setShop(wkKey, l.id, !on)}>
                  <span className="check" data-on={on ? '1' : '0'}>{on && <Icon name="Check" size={18} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-[15px] font-semibold leading-tight', on && 'text-muted line-through decoration-1')}>{l.name}</span>
                    <span className="block text-[13px] text-muted num">{fmtK(l.total)} {l.unit} · {hint(l)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <Card title="Compléments (stock)" icon="Pill">
        <ul className="grid gap-2.5">{EXTRA_STOCK.map((e) => <li key={e.id} className="text-[14.5px] leading-snug"><b>{e.name}</b><span className="block text-[13px] text-muted">{e.note}</span></li>)}</ul>
      </Card>
    </div>
  );
}

function Alarms({ state }) {
  const list = buildAlarms(state.settings.times);
  const [note, setNote] = useState('');
  const exportIcs = async () => {
    const r = await saveFile('cap72-alarmes.ics', buildIcs(state.settings.times));
    if (r.ok) { setNote(''); toast('Fichier proposé au téléchargement', 'good'); } else if (r.code === 'declined') toast('Téléchargement annulé');
    else setNote('Le téléchargement n’est pas disponible ici : utilise la liste ci-dessus pour créer les alarmes dans Horloge.');
  };
  const copy = async () => {
    const txt = ['Alarmes anti-oubli — Cap 72 kg', '', ...list.map((a) => `${a.t} — ${a.label} (${a.days})`)].join('\n');
    (await copyText(txt)) ? toast('Alarmes copiées', 'good') : toast('Copie impossible : note-les à la main', 'warn');
  };
  return (
    <div>
      <Card title="À programmer dans l’appli Horloge" icon="AlarmClock" right={<Btn size="sm" icon="Copy" onClick={copy}>Copier</Btn>}>
        <div className="text-[13.5px] text-muted leading-snug mb-3">Une page web ne peut pas sonner en arrière-plan : c’est ton réveil téléphone qui joue ce rôle. Crée chaque alarme avec l’étiquette et les jours indiqués. Les horaires se règlent dans les réglages.</div>
        <div className="grid">
          {list.map((a, i) => (
            <div key={i} className="flex gap-3 py-2.5 hair first:border-0">
              <div className="w-[58px] flex-none text-[19px] font-bold num text-accent leading-tight">{a.t}</div>
              <div className="min-w-0"><div className="text-[15px] font-semibold leading-tight">{a.label}</div><div className="text-[12px] font-semibold text-blue leading-tight mt-0.5">{a.days}</div><div className="text-[13px] text-muted leading-snug mt-0.5">{a.note}</div></div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Dans Calendrier (notifications)" icon="CalendarPlus">
        <div className="text-[13.5px] text-muted leading-snug">Alternative rapide : un fichier .ics qui crée tous ces rendez-vous répétés dans Calendrier, avec une notification à l’heure dite, jusqu’au 4 avril 2027. Une notification n’est pas un réveil : elle respecte le mode silencieux et les Focus. Pour un vrai réveil, garde Horloge.</div>
        <Btn className="w-full mt-3" icon="Download" onClick={exportIcs}>Exporter pour Calendrier (.ics)</Btn>
        {note && <div className="mt-2.5 text-[13.5px] text-warn leading-snug" role="status">{note}</div>}
      </Card>
      <Card title="Si un repas saute" icon="LifeBuoy">
        <ol className="grid gap-2.5">{RESCUE.map((t, i) => <li key={i} className="flex gap-3 items-start text-[14.5px] leading-snug"><span className="w-6 h-6 flex-none rounded-full bg-accent text-accent-ink text-[13px] font-bold inline-flex items-center justify-center mt-0.5">{i + 1}</span><span>{t}</span></li>)}</ol>
      </Card>
    </div>
  );
}

export default function Nutrition({ ui, setUi }) {
  const state = useAppState();
  const sub = ui.nutriSub || 'days';
  return (
    <div>
      <Segmented compact className="mb-3" options={[{ id: 'days', label: 'Jours' }, { id: 'vary', label: 'Varier' }, { id: 'recipes', label: 'Recettes' }, { id: 'shop', label: 'Courses' }, { id: 'alarms', label: 'Alarmes' }]} value={sub} onChange={(v) => setUi({ nutriSub: v })} />
      {sub === 'days' && <DayTypes state={state} />}
      {sub === 'vary' && <Vary state={state} setUi={setUi} />}
      {sub === 'recipes' && <Recipes state={state} />}
      {sub === 'shop' && <Shopping state={state} setUi={setUi} />}
      {sub === 'alarms' && <Alarms state={state} />}
    </div>
  );
}
