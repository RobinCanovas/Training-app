import { useSyncExternalStore } from 'react';
import { DEFAULT_TIMES } from './data/nutrition.js';
import { monthKey } from './lib/dates.js';

const LS_KEY = 'cap72.v1';
const LS_UI = 'cap72.ui';
const COLLECTION = 'cap72';

export const defaultSettings = () => ({
  startWeight: 65, targetWeight: 72, heightCm: 175,
  baseKcal: 3100, runBonus: 500, protein: 135, fat: 85, carbMin: 420, water: 3000,
  refMode: 'auto', refActive: 600,
  pace: '6:30',
  times: JSON.parse(JSON.stringify(DEFAULT_TIMES)),
});

export const defaultBudget = () => ({
  prices: {},    // équipement : id → € (total du poste) ; aliments : 'food:<id>' → € par paquet
  lines: [       // lignes prévues en plus : par mois ou une seule fois
    { id: 'gym', label: 'Abonnement salle', amount: '', every: 'month', cat: 'Salle' },
    { id: 'blood', label: 'Prises de sang (reste à charge)', amount: '', every: 'once', cat: 'Santé' },
  ],
  expenses: [],  // { id, date, label, cat, amount }
  cap: '',       // budget mensuel visé (€)
});

export const defaultState = () => ({
  v: 1,
  settings: defaultSettings(),
  weights: {},   // 'YYYY-MM-DD' → kg à jeun
  days: {},      // 'YYYY-MM-DD' → { meals:{id:true}, mealEdits:{id:{k,p,c,f,est}}, creatine, water, extras:[], pacerio:{steps,kcal,src}, checkin:{sleep,energy,note}, skipGym }
  gym: {},       // 'YYYY-MM-DD' → { s:'bas', ex:{ exId:[{kg,reps,done}] }, note }
  runs: {},      // 'YYYY-MM-DD' → { id:'A'|'B', km, sec, rpe, hr, hrMax, elev, kcal, cad, note }
  equip: {},     // id → true
  shop: {},      // 'S<n>' → { id: true }
  blood: { t0Date: '', t12Date: '', v: {}, notes: '' },
  body: {},      // 'YYYY-MM-DD' → { waist, arm, chest, thigh }
  budget: defaultBudget(),
  flags: {},     // réglages ponctuels déjà appliqués
});

// ───────────── Persistance locale ─────────────
let lsOk = true;
let meta = { t: {} };

function mergeDefaults(raw) {
  const d = defaultState();
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(s.settings || {}), times: { std: { ...d.settings.times.std, ...(s.settings?.times?.std || {}) }, run: { ...d.settings.times.run, ...(s.settings?.times?.run || {}) } } },
    blood: { ...d.blood, ...(s.blood || {}), v: { ...(s.blood?.v || {}) } },
    body: { ...(s.body && typeof s.body === 'object' ? s.body : {}) },
    budget: {
      ...d.budget, ...(s.budget && typeof s.budget === 'object' ? s.budget : {}),
      prices: { ...(s.budget?.prices || {}) },
      lines: Array.isArray(s.budget?.lines) ? s.budget.lines : d.budget.lines,
      expenses: Array.isArray(s.budget?.expenses) ? s.budget.expenses : [],
    },
    flags: { ...(s.flags && typeof s.flags === 'object' ? s.flags : {}) },
  };
}

function loadLocal() {
  try {
    const txt = localStorage.getItem(LS_KEY);
    if (!txt) return defaultState();
    const j = JSON.parse(txt);
    meta = j.meta && typeof j.meta === 'object' ? { t: j.meta.t || {} } : { t: {} };
    return mergeDefaults(j.state);
  } catch (e) {
    lsOk = false;
    return defaultState();
  }
}

let state = loadLocal();
const listeners = new Set();
let saveTimer = null;
let quiet = false;       // true pendant l'adoption d'un bloc distant : pas de renvoi
const lastSeen = {};     // id → JSON du bloc à la dernière modification vue

function saveLocalNow() {
  clearTimeout(saveTimer); saveTimer = null;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state, meta })); lsOk = true; } catch (e) { lsOk = false; }
}
const saveSoon = () => { if (!saveTimer) saveTimer = setTimeout(saveLocalNow, 250); };

export const getState = () => state;
export const isLocalOk = () => lsOk;
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useAppState = () => useSyncExternalStore(subscribe, getState);

export function update(fn) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  saveSoon();
  if (!quiet) syncSoon();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  const flush = () => { if (saveTimer) saveLocalNow(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

// ───────────── Préférences d'affichage (confort par appareil) ─────────────
export function loadUI() { try { return JSON.parse(localStorage.getItem(LS_UI)) || {}; } catch (e) { return {}; } }
export function saveUI(ui) { try { localStorage.setItem(LS_UI, JSON.stringify(ui)); } catch (e) { /* sans effet */ } }

// ───────────── Mises à jour immuables ─────────────
const clone = (o) => (Array.isArray(o) ? [...o] : { ...(o || {}) });
export function setIn(obj, path, val) {
  if (!path.length) return val;
  const [k, ...rest] = path;
  const copy = clone(obj);
  if (rest.length === 0 && val === undefined) { delete copy[k]; return copy; }
  copy[k] = setIn(obj?.[k], rest, val);
  return copy;
}
const put = (path, val) => update((s) => setIn(s, path, val));
const patchAt = (path, patch) => update((s) => {
  let cur = s;
  for (const k of path) cur = cur?.[k];
  return setIn(s, path, { ...(cur || {}), ...patch });
});

// ───────────── Actions ─────────────
export const A = {
  setSettings: (patch) => patchAt(['settings'], patch),
  setTime: (type, id, value) => put(['settings', 'times', type, id], value),
  setWeight: (date, kg) => put(['weights', date], kg === '' || kg == null ? undefined : kg),
  patchDay: (date, patch) => patchAt(['days', date], patch),
  toggleMeal: (date, id) => update((s) => setIn(s, ['days', date, 'meals', id], s.days[date]?.meals?.[id] ? undefined : true)),
  setMeal: (date, id, on) => put(['days', date, 'meals', id], on ? true : undefined),
  setWater: (date, ml) => put(['days', date, 'water'], Math.max(0, ml)),
  toggleCreatine: (date) => update((s) => setIn(s, ['days', date, 'creatine'], s.days[date]?.creatine ? undefined : true)),
  addExtra: (date, extra) => update((s) => setIn(s, ['days', date, 'extras'], [...(s.days[date]?.extras || []), extra])),
  removeExtra: (date, i) => update((s) => setIn(s, ['days', date, 'extras'], (s.days[date]?.extras || []).filter((_, j) => j !== i))),
  setPacerio: (date, p) => put(['days', date, 'pacerio'], p),
  clearPacerio: (date) => put(['days', date, 'pacerio'], undefined),
  // calories saisies pour un repas du plan : compte le repas comme mangé
  setMealEdit: (date, id, edit) => update((s) => setIn(setIn(s, ['days', date, 'mealEdits', id], edit), ['days', date, 'meals', id], true)),
  clearMealEdit: (date, id) => put(['days', date, 'mealEdits', id], undefined),
  setCheckin: (date, patch) => patchAt(['days', date, 'checkin'], patch),
  // séance de salle retirée pour une journée (la séance vide éventuellement ouverte est supprimée)
  skipGym: (date, on) => update((s) => {
    let next = setIn(s, ['days', date, 'skipGym'], on ? true : undefined);
    const g = s.gym[date];
    if (on && g && !Object.values(g.ex || {}).some((l) => l.some((x) => x.done))) next = setIn(next, ['gym', date], undefined);
    return next;
  }),
  // Mensurations
  setBody: (date, m) => put(['body', date], m),
  deleteBody: (date) => put(['body', date], undefined),
  // Compta
  setPrice: (key, v) => put(['budget', 'prices', key], v === '' || v == null ? undefined : v),
  setBudget: (patch) => patchAt(['budget'], patch),
  addExpense: (e) => update((s) => setIn(s, ['budget', 'expenses'], [...s.budget.expenses, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...e }])),
  updateExpense: (id, patch) => update((s) => setIn(s, ['budget', 'expenses'], s.budget.expenses.map((x) => (x.id === id ? { ...x, ...patch } : x)))),
  removeExpense: (id) => update((s) => setIn(s, ['budget', 'expenses'], s.budget.expenses.filter((x) => x.id !== id))),
  setLine: (id, patch) => update((s) => setIn(s, ['budget', 'lines'], s.budget.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))),
  addLine: (line) => update((s) => setIn(s, ['budget', 'lines'], [...s.budget.lines, { id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ...line }])),
  removeLine: (id) => update((s) => setIn(s, ['budget', 'lines'], s.budget.lines.filter((l) => l.id !== id))),
  // Salle
  setGym: (date, g) => put(['gym', date], g),
  patchGym: (date, patch) => patchAt(['gym', date], patch),
  setSet: (date, exId, i, patch) => update((s) => {
    const list = [...(s.gym[date]?.ex?.[exId] || [])];
    list[i] = { ...list[i], ...patch };
    return setIn(s, ['gym', date, 'ex', exId], list);
  }),
  setExSets: (date, exId, list) => put(['gym', date, 'ex', exId], list),
  deleteGym: (date) => put(['gym', date], undefined),
  // Course
  setRun: (date, r) => put(['runs', date], r),
  deleteRun: (date) => put(['runs', date], undefined),
  // Santé
  setEquip: (id, v) => put(['equip', id], v ? true : undefined),
  setShop: (key, id, v) => put(['shop', key, id], v ? true : undefined),
  clearShop: (key) => put(['shop', key], undefined),
  setBlood: (patch) => patchAt(['blood'], patch),
  setBloodValue: (id, t, v) => update((s) => setIn(s, ['blood', 'v', id, t], v === '' ? undefined : v)),
};

// ───────────── Export / import ─────────────
export function exportPayload() {
  const { settings, weights, days, gym, runs, equip, shop, blood, body, budget, flags } = state;
  return { app: 'cap72', v: 1, exportedAt: new Date().toISOString(), data: { settings, weights, days, gym, runs, equip, shop, blood, body, budget, flags } };
}
export const exportText = () => JSON.stringify(exportPayload(), null, 1);

export function importText(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'Ce texte n’est pas un JSON valide.' }; }
  const data = j && j.app === 'cap72' && j.data ? j.data : null;
  if (!data || typeof data !== 'object') return { ok: false, error: 'Fichier non reconnu : ce n’est pas une sauvegarde Cap 72 kg.' };
  const next = mergeDefaults({ ...data, v: 1 });
  update(() => next);
  // tout marquer comme modifié localement pour que la copie en ligne suive
  const now = Date.now();
  for (const id of Object.keys(shardsOf(next))) meta.t[id] = now;
  pushed = {};
  wipe = true;
  saveLocalNow();
  syncSoon();
  return { ok: true, weights: Object.keys(next.weights).length, days: Object.keys(next.days).length, gym: Object.keys(next.gym).length, runs: Object.keys(next.runs).length };
}

export function resetAll() {
  const now = Date.now();
  state = defaultState();
  for (const id of Object.keys(shardsOf(state))) meta.t[id] = now;
  for (const k of Object.keys(meta.t)) meta.t[k] = now;
  pushed = {};
  wipe = true;
  saveLocalNow();
  syncSoon();
  listeners.forEach((l) => l());
}

// ───────────── Copie en ligne (capacité db) ─────────────
// Un document par bloc : core + un document par mois pour les journées et pour les séances.
// Dernier écrit gagnant, par bloc. Si la capacité est absente, l'appli reste 100 % locale.
const sync = { status: 'off', last: null, detail: '' };
const syncListeners = new Set();
export const getSync = () => sync;
export const useSync = () => useSyncExternalStore((fn) => { syncListeners.add(fn); return () => syncListeners.delete(fn); }, () => syncSnapshot);
let syncSnapshot = { ...sync };
function setSync(patch) { Object.assign(sync, patch); syncSnapshot = { ...sync }; syncListeners.forEach((l) => l()); }

let db = null;
let pushed = {};      // id → JSON poussé / reçu
let syncTimer = null;
let busy = false;
let dead = false;
let wipe = false;                 // après import / réinitialisation : supprimer les blocs distants devenus vides
const knownRemote = new Set();

export function shardsOf(s) {
  const out = { core: { settings: s.settings, weights: s.weights, runs: s.runs, equip: s.equip, shop: s.shop, blood: s.blood, body: s.body, budget: s.budget, flags: s.flags } };
  for (const [d, v] of Object.entries(s.days)) { const id = `days_${monthKey(d)}`; (out[id] = out[id] || {})[d] = v; }
  for (const [d, v] of Object.entries(s.gym)) { const id = `gym_${monthKey(d)}`; (out[id] = out[id] || {})[d] = v; }
  return out;
}

function snapshotSeen() {
  const cur = shardsOf(state);
  for (const id of Object.keys(cur)) lastSeen[id] = JSON.stringify(cur[id]);
}

function adoptShard(id, data) {
  quiet = true;
  try {
  update((s) => {
    if (id === 'core') return mergeDefaults({ ...s, ...data });
    const kind = id.startsWith('days_') ? 'days' : id.startsWith('gym_') ? 'gym' : null;
    if (!kind) return s;
    const mk = id.slice(kind.length + 1);
    const kept = Object.fromEntries(Object.entries(s[kind]).filter(([d]) => monthKey(d) !== mk));
    return { ...s, [kind]: { ...kept, ...data } };
  });
  } finally { quiet = false; }
  const j = JSON.stringify(shardsOf(state)[id] || {});
  lastSeen[id] = j;
  pushed[id] = j;
}

async function initSync() {
  try {
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c || typeof c.use !== 'function') return;
    db = await c.use('db');
    if (!db) return;
    setSync({ status: 'syncing', detail: '' });
    const snap = await db.collection(COLLECTION).get();
    const remote = {};
    snap.docs.forEach((d) => { const v = d.data(); if (v && v.data) { remote[d.id] = v; knownRemote.add(d.id); } });
    const local = shardsOf(state);
    for (const [id, doc] of Object.entries(remote)) {
      const rj = JSON.stringify(doc.data);
      const lj = JSON.stringify(local[id] || {});
      const lt = meta.t[id] || 0;
      if (rj === lj) { pushed[id] = lj; meta.t[id] = Math.max(lt, doc._t || 0); continue; }
      if ((doc._t || 0) > lt) { adoptShard(id, doc.data); meta.t[id] = doc._t || Date.now(); }
    }
    saveLocalNow();
    await pushDirty();
    setSync({ status: 'ok', last: Date.now() });
  } catch (e) {
    dead = e && (e.code === 'not_granted' || e.code === 'capability_disabled' || e.code === 'quota_exceeded' || e.code === 'revoked');
    setSync({ status: 'error', detail: (e && e.code) || 'unavailable' });
  }
}

async function pushDirty() {
  if (!db || dead) return;
  const cur = shardsOf(state);
  const ids = Object.keys(cur);
  for (const id of ids) {
    const json = JSON.stringify(cur[id]);
    if (pushed[id] === json) continue;
    if (id !== 'core' && Object.keys(cur[id]).length === 0) continue;
    const t = meta.t[id] || Date.now();
    await db.doc(`${COLLECTION}/${id}`).set({ _t: t, data: cur[id] });
    pushed[id] = json;
    knownRemote.add(id);
  }
  if (wipe) {
    for (const id of [...knownRemote]) {
      if (!cur[id]) { await db.doc(`${COLLECTION}/${id}`).delete(); knownRemote.delete(id); }
    }
    wipe = false;
  }
}

function markDirtyTimes() {
  const cur = shardsOf(state);
  const now = Date.now();
  for (const id of Object.keys(cur)) {
    const json = JSON.stringify(cur[id]);
    if (pushed[id] !== json && lastSeen[id] !== json) meta.t[id] = now;
    lastSeen[id] = json;
  }
}
function syncSoon() {
  markDirtyTimes();
  if (!db || dead) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (busy) { syncSoon(); return; }
    busy = true;
    try { setSync({ status: 'syncing' }); await pushDirty(); setSync({ status: 'ok', last: Date.now() }); }
    catch (e) {
      dead = e && (e.code === 'not_granted' || e.code === 'quota_exceeded' || e.code === 'revoked');
      setSync({ status: 'error', detail: (e && e.code) || 'unavailable' });
    } finally { busy = false; }
  }, 1800);
}

// Demande ponctuelle : pas de salle le 25/11/2026. Appliquée une seule fois, après la synchro (pour ne pas être écrasée par la copie en ligne),
// et seulement si la séance n'a pas été commencée. « Remettre la séance » reste possible ensuite.
const SKIP_DAY = '2026-11-25';
export function applyOneOffs() {
  if (state.flags?.skipGym20261125) return;
  update((s) => {
    let next = setIn(s, ['flags', 'skipGym20261125'], true);
    const g = s.gym[SKIP_DAY];
    const started = g && Object.values(g.ex || {}).some((l) => l.some((x) => x.done));
    if (!started && s.days[SKIP_DAY]?.skipGym === undefined) {
      next = setIn(next, ['days', SKIP_DAY, 'skipGym'], true);
      if (g) next = setIn(next, ['gym', SKIP_DAY], undefined);
    }
    return next;
  });
}

export function startSync() {
  // la capacité peut répondre après le premier affichage : l'appli fonctionne déjà en local
  snapshotSeen();
  (async () => { await initSync(); applyOneOffs(); })();
}

// ───────────── Presse-papiers et fichiers ─────────────
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* repli ci-dessous */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

export async function saveFile(filename, data) {
  try {
    const c = window.claude;
    const dl = c && c.use ? await c.use('downloads') : null;
    if (!dl) return { ok: false, code: 'unavailable' };
    const r = await dl.save({ filename, data });
    return { ok: true, status: r && r.status };
  } catch (e) {
    return { ok: false, code: (e && e.code) || 'unavailable' };
  }
}
