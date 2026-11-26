import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon, Modal, Btn, Field, NumInput, Chip, ToastHost, toast, cx } from './ui.jsx';
import { TimerBar } from './timer.jsx';
import { A, useAppState, useSync, startSync, loadUI, saveUI, exportText, importText, resetAll, saveFile, copyText, isLocalOk } from './store.js';
import { fmtShort, todayISO, weekIndex, clampWeek, daysSinceStart } from './lib/dates.js';
import { weekInfo, WEEKS } from './data/program.js';
import Today from './tabs/Today.jsx';
import Training from './tabs/Training.jsx';
import Nutrition from './tabs/Nutrition.jsx';
import Health from './tabs/Health.jsx';
import Stats from './tabs/Stats.jsx';
import Budget from './tabs/Budget.jsx';

// Six onglets : les libellés restent courts pour tenir sur 360 px (le titre de l’écran garde le nom complet)
const TABS = [
  { id: 'today', label: 'Aujourd’hui', icon: 'House', title: 'Aujourd’hui' },
  { id: 'train', label: 'Sport', icon: 'Dumbbell', title: 'Entraînement' },
  { id: 'nutri', label: 'Nutrition', icon: 'UtensilsCrossed', title: 'Nutrition & Anti-Oubli' },
  { id: 'health', label: 'Santé', icon: 'HeartPulse', title: 'Santé, Bilan & Matériel' },
  { id: 'stats', label: 'Stats', icon: 'ChartLine', title: 'Statistiques & Courbes' },
  { id: 'budget', label: 'Compta', icon: 'Wallet', title: 'Compta & budget' },
];

// ───────────── Réglages ─────────────
function SettingsModal({ open, onClose }) {
  const state = useAppState();
  const S = state.settings;
  const set = (k) => (v) => { const x = parseFloat(String(v).replace(',', '.')); A.setSettings({ [k]: Number.isFinite(x) ? x : '' }); };
  const text = (k, v) => A.setSettings({ [k]: v });
  const timeRow = (type, id, label) => (
    <Field key={`${type}${id}`} label={label}><input type="time" className="inp" value={S.times[type][id] || ''} onChange={(e) => e.target.value && A.setTime(type, id, e.target.value)} /></Field>
  );
  return (
    <Modal open={open} onClose={onClose} title="Réglages">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Poids de départ"><NumInput value={S.startWeight} onChange={set('startWeight')} suffix="kg" ariaLabel="Poids de départ" /></Field>
        <Field label="Poids objectif"><NumInput value={S.targetWeight} onChange={set('targetWeight')} suffix="kg" ariaLabel="Poids objectif" /></Field>
        <Field label="Calories de base (dose pleine)"><NumInput value={S.baseKcal} onChange={set('baseKcal')} suffix="kcal" ariaLabel="Calories de base" /></Field>
        <Field label="Bonus jour de course"><NumInput value={S.runBonus} onChange={set('runBonus')} suffix="kcal" ariaLabel="Bonus calories jour de course" /></Field>
        <Field label="Protéines (min)"><NumInput value={S.protein} onChange={set('protein')} suffix="g" ariaLabel="Protéines minimum" /></Field>
        <Field label="Glucides (min)"><NumInput value={S.carbMin} onChange={set('carbMin')} suffix="g" ariaLabel="Glucides minimum" /></Field>
        <Field label="Lipides"><NumInput value={S.fat} onChange={set('fat')} suffix="g" ariaLabel="Lipides" /></Field>
        <Field label="Eau par jour"><NumInput value={S.water} onChange={set('water')} suffix="ml" ariaLabel="Eau par jour" /></Field>
        <Field label="Taille"><NumInput value={S.heightCm} onChange={set('heightCm')} suffix="cm" ariaLabel="Taille en centimètres" /></Field>
      </div>

      <div className="hair mt-4 pt-4">
        <div className="lbl mb-2">Activité de référence (pas et Pacerio)</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button type="button" aria-pressed={S.refMode === 'auto'} onClick={() => text('refMode', 'auto')} className={cx('min-h-[44px] rounded-xl border text-[14px] font-semibold', S.refMode === 'auto' ? 'bg-accent text-accent-ink border-accent' : 'bg-raised border-line text-muted')}>Auto</button>
          <button type="button" aria-pressed={S.refMode !== 'auto'} onClick={() => text('refMode', 'manual')} className={cx('min-h-[44px] rounded-xl border text-[14px] font-semibold', S.refMode !== 'auto' ? 'bg-accent text-accent-ink border-accent' : 'bg-raised border-line text-muted')}>Manuel</button>
        </div>
        <NumInput value={S.refActive} onChange={set('refActive')} suffix="kcal" ariaLabel="Calories actives de référence" />
        <div className="text-[12.5px] text-muted mt-1.5 leading-snug">Les calories actives au-dessus de cette référence s’ajoutent à ta cible. Elles viennent de Pacerio si tu les saisis, sinon l’appli les estime à partir de tes pas (avec ta taille et ton poids). En mode auto, la référence est la médiane de tes jours sans course (à partir de 3 jours), sinon cette valeur. Elle évite de compter deux fois la marche que ta base de 3 100 kcal contient déjà.</div>
      </div>

      <div className="hair mt-4 pt-4">
        <div className="lbl mb-2">Allure facile</div>
        <input className="inp" value={S.pace} onChange={(e) => text('pace', e.target.value)} placeholder="6:30" aria-label="Allure facile en minutes par kilomètre" />
        <div className="text-[12.5px] text-muted mt-1.5">Minutes par km (format 6:30). Sert à estimer la durée des sorties.</div>
      </div>

      <div className="hair mt-4 pt-4">
        <div className="lbl mb-2">Horaires · jour standard</div>
        <div className="grid grid-cols-2 gap-2.5">{[['bkf', 'Petit-déjeuner'], ['lunch', 'Déjeuner'], ['shake', 'Shake'], ['dinner', 'Dîner']].map(([id, l]) => timeRow('std', id, l))}</div>
        <div className="lbl mb-2 mt-4">Horaires · jour de course</div>
        <div className="grid grid-cols-2 gap-2.5">{[['bkf', 'Petit-déjeuner'], ['lunch', 'Déjeuner'], ['shake', 'Shake'], ['snack', 'Collation'], ['dinner', 'Dîner']].map(([id, l]) => timeRow('run', id, l))}</div>
      </div>
      <Btn variant="primary" className="w-full mt-5" onClick={onClose}>Fermer</Btn>
    </Modal>
  );
}

// ───────────── Données : sauvegarde, import, synchronisation ─────────────
function DataModal({ open, onClose }) {
  const sync = useSync();
  const [text, setText] = useState('');
  const [view, setView] = useState('menu'); // menu | export | import
  const [armed, setArmed] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { if (open) { setView('menu'); setText(''); setArmed(false); } }, [open]);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);

  const doExport = async () => {
    const data = exportText();
    const name = `cap72-sauvegarde-${todayISO()}.json`;
    const r = await saveFile(name, data);
    if (r.ok) { toast('Sauvegarde proposée au téléchargement', 'good'); return; }
    if (r.code === 'declined') { toast('Téléchargement annulé'); return; }
    setText(data); setView('export');
  };
  const doImport = (t) => {
    const r = importText(t);
    if (!r.ok) { toast(r.error, 'crit'); return; }
    const plur = (n, one, many) => `${n} ${n > 1 ? many : one}`;
    toast(`Sauvegarde restaurée : ${plur(r.weights, 'pesée', 'pesées')}, ${plur(r.gym, 'séance', 'séances')}, ${plur(r.runs, 'course', 'courses')}`, 'good');
    onClose();
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => doImport(String(rd.result || ''));
    rd.onerror = () => toast('Lecture du fichier impossible', 'crit');
    rd.readAsText(f);
    e.target.value = '';
  };
  const statusLabel = { off: 'Locale uniquement', syncing: 'Synchronisation…', ok: 'À jour', error: 'Indisponible' }[sync.status];
  const statusTone = { off: undefined, syncing: 'blue', ok: 'good', error: 'warn' }[sync.status];

  return (
    <Modal open={open} onClose={onClose} title="Mes données">
      <div className="rounded-xl bg-raised border border-line px-3.5 py-3 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[14.5px] font-semibold">Copie en ligne</div>
          <Chip tone={statusTone} icon={sync.status === 'ok' ? 'CloudCheck' : sync.status === 'error' ? 'CloudOff' : 'Cloud'}>{statusLabel}</Chip>
        </div>
        <div className="text-[12.5px] text-muted leading-snug mt-1.5">
          Tes données restent sur cet appareil et, quand c’est disponible, sont copiées dans l’espace privé de cette page (accessible à toi seul) pour retrouver ton suivi sur un autre appareil. {!isLocalOk() && <b className="text-warn">Le stockage local est bloqué sur ce navigateur : exporte régulièrement une sauvegarde.</b>}
        </div>
      </div>

      {view === 'menu' && (
        <div className="grid gap-2.5">
          <Btn variant="primary" icon="Download" onClick={doExport}>Exporter (JSON)</Btn>
          <Btn icon="Upload" onClick={() => fileRef.current && fileRef.current.click()}>Importer un fichier JSON</Btn>
          <input ref={fileRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={onFile} />
          <Btn icon="ClipboardPaste" onClick={() => setView('import')}>Importer en collant le texte</Btn>
          <Btn variant="danger" icon="Trash2" onClick={() => { if (armed) { resetAll(); setArmed(false); toast('Toutes les données ont été effacées'); onClose(); } else setArmed(true); }}>
            {armed ? 'Confirmer : tout effacer' : 'Tout effacer'}
          </Btn>
          <div className="text-[12.5px] text-muted leading-snug">L’import remplace tout ce qui est enregistré actuellement. Exporte d’abord si tu as un doute.</div>
        </div>
      )}
      {view === 'export' && (
        <div>
          <div className="text-[13.5px] text-muted mb-2 leading-snug">Le téléchargement direct n’est pas disponible ici. Copie ce texte et garde-le dans tes notes ou un message à toi-même.</div>
          <textarea readOnly className="inp py-2.5 min-h-[160px] text-[12px] font-mono" value={text} onFocus={(e) => e.target.select()} aria-label="Sauvegarde JSON" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Btn onClick={() => setView('menu')}>Retour</Btn>
            <Btn variant="primary" icon="Copy" onClick={async () => { (await copyText(text)) ? toast('Sauvegarde copiée', 'good') : toast('Copie impossible : sélectionne le texte', 'warn'); }}>Copier</Btn>
          </div>
        </div>
      )}
      {view === 'import' && (
        <div>
          <textarea className="inp py-2.5 min-h-[160px] text-[12px] font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"app":"cap72", …}' aria-label="Texte JSON à importer" />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Btn onClick={() => setView('menu')}>Retour</Btn>
            <Btn variant="primary" icon="Upload" onClick={() => doImport(text)}>Restaurer</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function App() {
  const state = useAppState();
  const [ui, setUiState] = useState(() => {
    const u = loadUI();
    return { tab: TABS.some((t) => t.id === u.tab) ? u.tab : 'today', trainSub: u.trainSub, nutriSub: u.nutriSub, healthSub: u.healthSub, budgetSub: u.budgetSub, session: null };
  });
  const [settings, setSettings] = useState(false);
  const [data, setData] = useState(false);
  const setUi = useCallback((patch) => setUiState((u) => ({ ...u, ...patch })), []);
  const go = useCallback((patch) => { setUiState((u) => ({ ...u, ...patch })); window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const { tab, trainSub, nutriSub, healthSub, budgetSub } = ui; saveUI({ tab, trainSub, nutriSub, healthSub, budgetSub }); }, [ui.tab, ui.trainSub, ui.nutriSub, ui.healthSub, ui.budgetSub]);
  useEffect(() => { startSync(); }, []);

  const today = todayISO();
  const n = weekIndex(today);
  const wi = weekInfo(clampWeek(n));
  const tab = TABS.find((t) => t.id === ui.tab) || TABS[0];

  return (
    <div className="app">
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[19px] font-bold leading-tight truncate">{tab.title}</h1>
            </div>
            <div className="text-[12.5px] text-muted leading-tight mt-0.5 truncate">
              <span>{fmtShort(today)}</span> · {n < 1 ? 'départ le 30 nov.' : `S${clampWeek(n)}/${WEEKS} · ${wi.name}`}
            </div>
          </div>
          <button type="button" aria-label="Mes données : sauvegarde et synchronisation" onClick={() => setData(true)} className="w-11 h-11 rounded-xl bg-raised border border-line inline-flex items-center justify-center text-muted"><Icon name="Database" size={19} /></button>
          <button type="button" aria-label="Réglages" onClick={() => setSettings(true)} className="w-11 h-11 rounded-xl bg-raised border border-line inline-flex items-center justify-center text-muted"><Icon name="Settings" size={19} /></button>
        </div>
        <div className="mt-2 h-[3px] rounded-full bg-raised overflow-hidden" role="progressbar" aria-label="Avancement du programme" aria-valuenow={Math.round(Math.min(100, Math.max(0, (daysSinceStart(today) / (WEEKS * 7)) * 100)))} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, (daysSinceStart(today) / (WEEKS * 7)) * 100))}%` }} />
        </div>
      </header>

      <main className="app-main">
        {ui.tab === 'today' && <Today go={go} />}
        {ui.tab === 'train' && <Training ui={ui} setUi={setUi} />}
        {ui.tab === 'nutri' && <Nutrition ui={ui} setUi={setUi} />}
        {ui.tab === 'health' && <Health ui={ui} setUi={setUi} />}
        {ui.tab === 'stats' && <Stats />}
        {ui.tab === 'budget' && <Budget ui={ui} setUi={setUi} />}
      </main>

      <TimerBar />
      <nav className="tabbar" aria-label="Navigation principale">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab-btn" aria-current={ui.tab === t.id ? 'page' : undefined} onClick={() => { setUi({ tab: t.id }); window.scrollTo({ top: 0 }); }}>
              <Icon name={t.icon} size={22} strokeWidth={ui.tab === t.id ? 2.4 : 2} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <SettingsModal open={settings} onClose={() => setSettings(false)} />
      <DataModal open={data} onClose={() => setData(false)} />
      <ToastHost />
    </div>
  );
}
