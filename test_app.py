import datetime, json, pathlib, re, sys, traceback
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parent
NM = ROOT / 'node_modules'
HTML = (ROOT / 'dist' / 'test.html').read_text(encoding='utf-8')
CDN = {
    'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js': NM / 'react/umd/react.production.min.js',
    'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js': NM / 'react-dom/umd/react-dom.production.min.js',
    'https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js': NM / 'prop-types/prop-types.min.js',
    'https://cdn.jsdelivr.net/npm/recharts@2.15.4/umd/Recharts.js': NM / 'recharts/umd/Recharts.js',
}
SHOTS = ROOT / 'shots'
SHOTS.mkdir(exist_ok=True)

MOCK = r"""
(() => {
  const store = new Map(Object.entries(window.__SEED_DB__ || {}));
  window.__calls = [];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const mkDoc = (path) => ({
    id: path.split('/').pop(), path,
    async get() { const v = store.get(path); return { id: path.split('/').pop(), exists: v !== undefined, data: () => (v === undefined ? undefined : clone(v)), metadata: { fromCache: false } }; },
    async set(d) { window.__calls.push(['set', path]); store.set(path, clone(d)); },
    async delete() { window.__calls.push(['delete', path]); store.delete(path); },
  });
  const db = {
    doc: mkDoc,
    collection(col) {
      return { async get() {
        const docs = [...store.entries()].filter(([p]) => p.startsWith(col + '/') && p.split('/').length === 2).map(([p, v]) => ({ id: p.split('/')[1], exists: true, data: () => clone(v) }));
        return { docs, size: docs.length, empty: !docs.length };
      } };
    },
  };
  const downloads = { async save(req) { window.__calls.push(['download', req.filename]); window.__lastDownload = { filename: req.filename, data: req.data }; return { status: 'saved' }; } };
  window.claude = { use: async (n) => (n === 'db' ? db : n === 'downloads' ? downloads : null) };
  window.__dump = () => Object.fromEntries([...store.entries()]);
})();
"""

results = []
logs = []


def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))


def step(name):
    def deco(fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            ok(name + ' (exception)', False, str(e).split('\n')[0][:200])
            traceback.print_exc(limit=2)
        return fn
    return deco


PAGE_OVERRIDE = {}


def make_context(browser, when, seed_ls=None, seed_db=None, vp=(390, 844)):
    ctx = browser.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=1, timezone_id='Europe/Paris', locale='fr-FR', has_touch=True, is_mobile=True)
    pre = ''
    if seed_db is not None:
        pre += f'window.__SEED_DB__ = {json.dumps(seed_db)};'
    ctx.add_init_script(pre + MOCK)
    if seed_ls is not None:
        ctx.add_init_script(f"try{{ if(!localStorage.getItem('cap72.v1')) localStorage.setItem('cap72.v1', {json.dumps(json.dumps(seed_ls))}); }}catch(e){{}}")

    def handler(route):
        url = route.request.url
        if url == 'https://app.test/':
            route.fulfill(status=200, content_type='text/html; charset=utf-8', body=PAGE_OVERRIDE.get('html', HTML))
        elif url in CDN:
            route.fulfill(status=200, content_type='application/javascript', body=CDN[url].read_text(encoding='utf-8'))
        elif 'fonts.googleapis.com' in url:
            route.fulfill(status=200, content_type='text/css', body='')
        else:
            route.abort()
    ctx.route('**/*', handler)
    page = ctx.new_page()
    page.on('console', lambda m: logs.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    page.clock.install(time=when)
    return ctx, page


def shot(page, name, full=False):
    page.wait_for_timeout(280)
    page.screenshot(path=str(SHOTS / name), full_page=full)


def tab(page, name):
    page.locator('.tabbar .tab-btn', has_text=name).click()
    page.wait_for_timeout(120)


def seed_state():
    """Six semaines de données fictives (test uniquement) pour juger les courbes."""
    import random
    random.seed(7)
    start = datetime.date(2026, 11, 30)
    weights, gym, runs = {}, {}, {}
    for d in range(0, 44):
        day = start + datetime.timedelta(days=d)
        w = 65.0 + 0.30 * (d / 7) + random.uniform(-0.25, 0.25)
        weights[day.isoformat()] = round(w, 1)
        wd = day.weekday()  # lun=0
        wk = d // 7 + 1
        if wd == 2:  # mercredi : Bas
            gym[day.isoformat()] = {'s': 'bas', 'ex': {'squat': [{'kg': str(60 + 5 * (wk // 2)), 'reps': '9', 'done': True}] * 3, 'rdl': [{'kg': str(70 + 5 * (wk // 2)), 'reps': '10', 'done': True}] * 3}, 'note': ''}
        if wd == 0:  # lundi : Haut
            gym[day.isoformat()] = {'s': 'haut', 'ex': {'dc': [{'kg': str(50 + 2.5 * wk), 'reps': '8', 'done': True}] * 3}, 'note': ''}
        if wd in (1, 4):
            km = {1: 3 + 0.5 * (wk - 1), 4: 2.5 + 0.4 * (wk - 1)}[wd]
            runs[day.isoformat()] = {'id': 'A' if wd == 1 else 'B', 'km': round(km, 1), 'sec': int(km * 390), 'rpe': '5'}
    return {'state': {'v': 1, 'settings': {}, 'weights': weights, 'days': {}, 'gym': gym, 'runs': runs, 'equip': {}, 'shop': {}, 'blood': {}}, 'meta': {'t': {}}}


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ───────────── Parcours 0 : appareil neuf, onglet Stats vide ─────────────
    ctx0, page0 = make_context(browser, datetime.datetime(2026, 12, 2, 15, 30, 0))
    page0.goto('https://app.test/')
    page0.wait_for_selector('.app-header')

    @step('Stats : état vide')
    def _():
        tab(page0, 'Stats')
        page0.wait_for_timeout(300)
        ok('état vide des charges', page0.get_by_text('Pas encore de charge enregistrée').is_visible())
        ok('tuiles sans données', page0.get_by_text('dès 2 semaines de pesées').is_visible())
    ctx0.close()

    # ───────────── Parcours 1 : mercredi 2/12/2026 (semaine 1), 15 h 30, appareil neuf ─────────────
    ctx, page = make_context(browser, datetime.datetime(2026, 12, 2, 15, 30, 0))
    page.goto('https://app.test/')
    page.wait_for_selector('.app-header', timeout=15000)

    @step('Aujourd’hui : rendu initial')
    def _():
        ok('titre de l’onglet', page.locator('h1').inner_text() == 'Aujourd’hui', page.locator('h1').inner_text())
        ok('jauge : 65,0 kg au départ', page.get_by_text('65,0').first.is_visible())
        ok('compte à rebours J−123', page.get_by_text('J−123').is_visible())
        ok('semaine 1/18', page.get_by_text('Semaine 1/18').is_visible())
        ok('alerte repas en retard (2)', page.get_by_text('2 repas pas cochés').is_visible())
        ok('cible 2 764 kcal affichée (semaine 1)', page.get_by_text(re.compile(r'2\W764 kcal')).first.is_visible())
        ok('fil de la journée', page.get_by_role('group', name='Fil de la journée').is_visible())
        ok('montée progressive annoncée', page.get_by_text('Montée progressive').first.is_visible())
        shot(page, '01_today_top.png')

    @step('Séance : retirer et remettre')
    def _():
        ok('carnet proposé', page.get_by_role('button', name='Ouvrir le carnet').is_visible())
        page.get_by_role('button', name=re.compile('^Retirer cette séance')).click()
        ok('séance retirée affichée', page.get_by_text('Séance retirée').first.is_visible())
        page.get_by_role('button', name='Remettre la séance').click()
        ok('séance remise', page.get_by_role('button', name='Ouvrir le carnet').is_visible())
        page.get_by_role('button', name=re.compile('^Retirer cette séance')).click()
        ok('retirée de nouveau', page.get_by_text('Séance retirée').first.is_visible())
        shot(page, '01b_today_skipped.png')

    @step('Matin : réveil, compléments')
    def _():
        page.get_by_label('Heure de réveil').fill('07:10')
        ok('petit-déjeuner déduit du réveil', page.get_by_text('Petit-déjeuner visé à 07:40').is_visible())
        page.get_by_role('button', name='Mes compléments').click()
        page.get_by_role('button', name='Zinc', exact=True).click()
        ok('Zinc ajouté', page.get_by_role('button', name='Retirer Zinc').count() == 1)
        page.get_by_role('button', name='Retirer Créatine monohydrate').click()
        page.get_by_role('button', name=re.compile('^Confirmer le retrait')).click()
        page.get_by_role('button', name='Fermer').last.click()
        ok('créatine retirée de la journée', page.get_by_role('button', name=re.compile('^Créatine monohydrate')).count() == 0)
        zinc = page.get_by_role('button', name='Zinc dose de l’étiquette')
        ok('zinc le soir', zinc.is_visible())
        zinc.click()
        ok('zinc coché', zinc.get_attribute('aria-pressed') == 'true')
        page.get_by_role('button', name='Mes compléments').click()
        page.get_by_role('button', name='Créatine monohydrate', exact=True).click()
        page.get_by_role('button', name='Fermer').last.click()
        ok('créatine remise', page.get_by_role('button', name='Créatine monohydrate 5 g').count() == 1)

    @step('Repas : calories réelles et saisie libre')
    def _():
        page.get_by_role('button', name='Modifier les calories Déjeuner').click()
        page.get_by_label('Calories du repas').fill('900')
        page.get_by_role('button', name='Enregistrer', exact=True).click()
        ok('repas modifié', page.get_by_text('modifié').first.is_visible())
        page.get_by_role('button', name='Modifier les calories Déjeuner').click()
        page.get_by_role('button', name='Remettre le plan').click()
        ok('plan remis', page.get_by_text('modifié').count() == 0)
        page.get_by_role('button', name='Déjeuner : fait').click()
        page.get_by_role('button', name='Saisir des calories (repas libre)').click()
        page.get_by_label('Nom de l’ajout').fill('Kebab')
        page.get_by_label('Calories', exact=True).fill('1000')
        page.get_by_role('button', name='Ajouter à ma journée').click()
        ok('saisie libre estimée', page.get_by_text('macros estimées').is_visible())
        page.get_by_role('button', name='Retirer Kebab').click()
        ok('saisie retirée', page.get_by_role('button', name='Retirer Kebab').count() == 0)

    @step('Aujourd’hui : repas, eau, créatine')
    def _():
        page.get_by_role('button', name='Petit-déjeuner : à faire').click()
        ok('petit-déjeuner coché', page.get_by_role('button', name='Petit-déjeuner : fait').is_visible())
        ok('restants kcal = 1 975', page.get_by_text(re.compile(r'Reste 1\W975 kcal')).is_visible())
        page.get_by_role('button', name='500 ml', exact=True).click()
        ok('hydratation 0,50 L', page.get_by_text('0,50').first.is_visible())
        page.get_by_role('button', name='Créatine monohydrate 5 g').click()
        ok('créatine cochée', page.get_by_role('button', name='Créatine monohydrate 5 g').get_attribute('aria-pressed') == 'true')
        page.get_by_role('button', name=re.compile('Détails Déjeuner')).click()
        ok('détail du déjeuner', page.get_by_text('Riz basmati (cru)').is_visible())

    @step('Pacerio : saisie, collage, bonus')
    def _():
        page.get_by_label('Nombre de pas').fill('9500')
        page.get_by_label('Calories actives').fill('1030')
        page.get_by_role('button', name='Valider').click()
        ok('cible = 3 194 (bonus 430)', page.get_by_text(re.compile(r'3\W194 kcal')).first.is_visible())
        page.get_by_role('button', name='Coller').click()
        page.get_by_label('Données à importer').fill('8450 pas, 620 kcal')
        page.get_by_role('button', name='Importer').click()
        page.wait_for_timeout(150)
        ok('pas importés', page.get_by_label('Nombre de pas').input_value() == '8450', page.get_by_label('Nombre de pas').input_value())
        ok('cible = 2 784 (bonus 20)', page.get_by_text(re.compile(r'2\W784 kcal')).first.is_visible())

    @step('Ajout rapide et oubli de repas')
    def _():
        page.get_by_role('button', name='Ajout', exact=True).click()
        page.get_by_role('button', name=re.compile('^Banane')).click()
        ok('ajout visible dans Restants', page.get_by_text('Ajouts du jour').is_visible())
        page.get_by_role('button', name='J’ai oublié un repas').click()
        ok('plan de secours affiché', page.get_by_text('Bois le shake tout de suite').is_visible())
        page.get_by_role('button', name='Ajouter un shake à ma journée').click()
        ok('shake ajouté', page.get_by_text('Shake Liquid Mass en plus').is_visible())
        ok('icône Retirer visible', page.get_by_role('button', name=re.compile('^Retirer')).first.locator('svg').count() == 1)
        ok('2 notifications au plus', page.locator('.toast-host > div').count() <= 2, str(page.locator('.toast-host > div').count()))
        page.evaluate('window.scrollTo(0, 700)')
        shot(page, '02_today_mid.png')
        page.evaluate('window.scrollTo(0, 1500)')
        shot(page, '03_today_low.png')
        page.evaluate('window.scrollTo(0, 0)')

    @step('Pesée du jour')
    def _():
        page.get_by_label('Poids du jour à jeun').fill('65,4')
        page.get_by_role('button', name='Enregistrer la pesée').click()
        ok('poids 65,4 sur la jauge', page.get_by_text('65,4').first.is_visible())

    @step('Entraînement : carnet de salle')
    def _():
        tab(page, 'Sport')
        page.get_by_role('tab', name='Bas', exact=True).click()
        ok('séance Bas proposée', page.get_by_text('Bas du corps').first.is_visible())
        page.get_by_role('button', name='Démarrer la séance').click()
        ok('squat affiché', page.get_by_text('Squat barre (cage)').first.is_visible())
        page.get_by_label('Charge série 1').first.fill('60')
        page.get_by_role('button', name='Valider la série 1').first.click()
        ok('minuteur de repos lancé', page.locator('.timer-bar').get_by_text('Repos · Squat').is_visible())
        ok('compteur 1/3', page.get_by_text('1/3', exact=True).first.is_visible())
        shot(page, '04_gym.png')
        page.clock.fast_forward(200000)
        page.wait_for_timeout(500)
        ok('minuteur terminé', page.locator('.timer-bar').get_by_text('Repos terminé').is_visible())
        page.get_by_role('button', name='Ajouter 15 secondes').count()
        page.get_by_role('button', name='Série', exact=True).first.click()
        ok('série ajoutée (1/4)', page.get_by_text('1/4', exact=True).first.is_visible())

    @step('Entraînement : course et plan')
    def _():
        page.get_by_role('tab', name='Course').click()
        page.get_by_label('Distance en kilomètres').fill('3')
        page.get_by_label('Minutes', exact=True).fill('21')
        page.get_by_label('Secondes', exact=True).fill('15')
        page.get_by_role('button', name='Enregistrer', exact=True).click()
        page.wait_for_timeout(150)
        ok('course listée', page.get_by_text(re.compile(r'3 km · 21:15 · 7:05 /km')).is_visible())
        shot(page, '05_run.png')
        page.get_by_role('tab', name='Plan 18 sem.').click()
        ok('plan : test des 10 km', page.get_by_text('TEST · 10 km facile').is_visible())
        ok('plan : tempo en blocs', page.get_by_text('Tempo en blocs · 3 × 4 min').is_visible())
        page.evaluate('window.scrollTo(0, 900)')
        shot(page, '06_plan.png')
        page.evaluate('window.scrollTo(0, 0)')

    @step('Nutrition : jours, recettes, courses, alarmes')
    def _():
        tab(page, 'Nutrition')
        ok('type de jour = Course (course saisie aujourd’hui)', page.get_by_role('tab', name=re.compile(r'^Course ·')).get_attribute('aria-selected') == 'true')
        page.get_by_role('tab', name=re.compile(r'^Standard ·')).click()
        ok('jour standard 2 775 kcal (semaine 1)', page.get_by_text(re.compile(r'2\W775')).first.is_visible())
        page.get_by_role('tab', name=re.compile(r'^Course ·')).click()
        ok('jour de course 3 293 (semaine 1)', page.get_by_text(re.compile(r'3\W293')).first.is_visible())
        shot(page, '07_nutri_days.png')
        page.get_by_role('tab', name='Recettes').click()
        ok('recette Liquid Mass', page.get_by_text('Shake Liquid Mass').first.is_visible())
        page.get_by_role('button', name='Ajouter à aujourd’hui').first.click()
        page.get_by_role('tab', name='Courses').click()
        ok('liste : flocons d’avoine', page.get_by_text('Flocons d’avoine').first.is_visible())
        page.get_by_role('button', name=re.compile('Flocons d’avoine')).click()
        ok('case cochée', page.get_by_role('button', name=re.compile('Flocons d’avoine')).get_attribute('aria-pressed') == 'true')
        page.get_by_role('button', name='Copier la liste').click()
        shot(page, '08_nutri_shop.png')
        page.get_by_role('tab', name='Alarmes').click()
        ok('alarme 07:30', page.get_by_text('07:30').first.is_visible())
        shot(page, '09_nutri_alarms.png')

    @step('Varier : menus, rotation, whey')
    def _():
        tab(page, 'Nutrition')
        page.get_by_role('tab', name='Varier').click()
        ok('trois repas variables', page.get_by_text('Petit-déjeuner', exact=True).first.is_visible() and page.get_by_text('Dîner', exact=True).first.is_visible())
        page.get_by_role('radio', name='Dîner : Pâtes thon – tomate').click()
        ok('dîner choisi', page.get_by_role('radio', name='Dîner : Pâtes thon – tomate').get_attribute('aria-checked') == 'true')
        shot(page, '07b_varier.png', True)
        page.get_by_role('tab', name='Courses').click()
        ok('courses : thon ajouté', page.get_by_text('Thon au naturel (égoutté)').first.is_visible())
        ok('courses : bœuf haché retiré', page.get_by_text('Bœuf haché').count() == 0)
        ok('courses : whey présente', page.get_by_text('Whey (poudre)').count() >= 1)
        page.get_by_role('tab', name='Varier').click()
        page.get_by_role('switch', name='Whey dans le shake').click()
        page.get_by_role('tab', name='Courses').click()
        ok('courses : whey retirée', page.get_by_text('Whey (poudre)').count() == 0)
        page.get_by_role('tab', name='Varier').click()
        page.get_by_role('switch', name='Whey dans le shake').click()
        page.get_by_role('switch', name='Rotation automatique des menus').click()
        ok('rotation : choix verrouillés', page.get_by_role('radio', name='Dîner : Pâtes thon – tomate').is_disabled())
        page.get_by_role('switch', name='Rotation automatique des menus').click()
        tab(page, 'Aujourd’hui')
        ok('dîner du jour = menu choisi', page.get_by_text('Pâtes thon – tomate').first.is_visible())
        ok('déjeuner déjà coché garde son menu', page.get_by_text('Riz – poulet – légumes').first.is_visible())

    @step('Santé : matériel et bilan sanguin')
    def _():
        tab(page, 'Santé')
        page.get_by_role('button', name=re.compile('Balance de cuisine')).click()
        ok('matériel 1/14', page.get_by_text('1/14').first.is_visible())
        shot(page, '10_health_gear.png')
        page.get_by_role('tab', name='Sang').click()
        ok('fenêtre S12', page.get_by_text(re.compile(r'15 févr\. → 21 févr\. 2027')).is_visible())
        page.get_by_label('Testostérone totale au bilan de départ').fill('18,5')
        page.get_by_label('Testostérone totale au contrôle de la semaine 12').fill('20')
        ok('écart calculé Δ +1,50', page.get_by_text('Δ +1,50').is_visible())
        shot(page, '11_health_blood.png')

    @step('Stats : courbes sans données')
    def _():
        tab(page, 'Stats')
        page.wait_for_timeout(400)
        ok('graphique poids rendu', page.locator('svg.recharts-surface').count() >= 2, str(page.locator('svg.recharts-surface').count()))
        page.get_by_role('button', name='Tableau').first.click()
        ok('tableau jumeau', page.get_by_role('columnheader', name='Moyenne').is_visible())
        page.get_by_role('button', name='Courbe').first.click()
        shot(page, '12_stats_empty.png')

    @step('Données : export, sync, import')
    def _():
        page.get_by_label('Mes données : sauvegarde et synchronisation').click()
        page.wait_for_timeout(2600)
        ok('copie en ligne : à jour', page.get_by_text('À jour').is_visible())
        page.get_by_role('button', name='Exporter (JSON)').click()
        page.wait_for_timeout(200)
        dl = page.evaluate('window.__lastDownload')
        ok('téléchargement proposé', dl and dl['filename'] == 'cap72-sauvegarde-2026-12-02.json', str(dl and dl['filename']))
        payload = json.loads(dl['data'])
        ok('export : poids 65,4', payload['data']['weights'].get('2026-12-02') == 65.4, str(payload['data']['weights']))
        ok('export : séance de salle', '2026-12-02' in payload['data']['gym'])
        ok('export : course', '2026-12-02' in payload['data']['runs'])
        calls = page.evaluate('window.__calls')
        ids = {c[1] for c in calls if c[0] == 'set'}
        ok('docs en ligne : core + days + gym', {'cap72/core', 'cap72/days_2026_12', 'cap72/gym_2026_12'} <= ids, str(ids))
        shot(page, '13_data.png')
        page.get_by_role('button', name='Importer en collant le texte').click()
        page.get_by_label('Texte JSON à importer').fill(dl['data'])
        page.get_by_role('button', name='Restaurer').click()
        page.wait_for_timeout(200)
        ok('import restauré (pluriels)', page.get_by_text('Sauvegarde restaurée : 1 pesée, 1 séance, 1 course').is_visible())

    @step('Réglages')
    def _():
        page.get_by_label('Réglages').click()
        page.get_by_label('Calories de base').fill('3200')
        page.get_by_role('button', name='Fermer').last.click()
        tab(page, 'Aujourd’hui')
        ok('cible mise à jour', page.get_by_text(re.compile(r'2\W8\d\d kcal')).first.is_visible())
        page.get_by_label('Réglages').click()
        page.get_by_label('Calories de base').fill('3100')
        shot(page, '14_settings.png')
        page.get_by_role('button', name='Fermer').last.click()

    page.wait_for_timeout(2300)
    dump = page.evaluate('window.__dump()')
    page.reload()
    page.wait_for_selector('.app-header')

    @step('Rechargement : données persistantes')
    def _():
        tab(page, 'Aujourd’hui')
        ok('poids 65,4 conservé', page.get_by_text('65,4').first.is_visible())
        ok('pas conservés', page.get_by_label('Nombre de pas').input_value() == '8450')
    ctx.close()

    # ───────────── Parcours 2 : nouvel appareil, localStorage vide, copie en ligne existante ─────────────
    ctx2, page2 = make_context(browser, datetime.datetime(2026, 12, 2, 18, 0, 0), seed_db=dump)
    page2.goto('https://app.test/')
    page2.wait_for_selector('.app-header')
    page2.wait_for_timeout(1500)

    @step('Nouvel appareil : reprise depuis la copie en ligne')
    def _():
        ok('poids repris (65,4)', page2.get_by_text('65,4').first.is_visible())
        ok('pas repris', page2.get_by_label('Nombre de pas').input_value() == '8450')
    ctx2.close()

    # ───────────── Parcours 3 : semaine 7 avec historique (courbes) ─────────────
    seed = seed_state()
    ctx3, page3 = make_context(browser, datetime.datetime(2027, 1, 8, 9, 0, 0), seed_ls=seed)
    page3.goto('https://app.test/')
    page3.wait_for_selector('.app-header')

    @step('Historique : jauge, coach, courbes')
    def _():
        shot(page3, '20_today_seeded.png')
        tab(page3, 'Stats')
        page3.wait_for_timeout(500)
        ok('3 graphiques', page3.locator('svg.recharts-surface').count() >= 3, str(page3.locator('svg.recharts-surface').count()))
        ok('coach affiché', page3.get_by_text('Coach calories').is_visible())
        shot(page3, '21_stats_seeded.png', True)
        page3.locator('svg.recharts-surface').first.hover(position={'x': 200, 'y': 100})
        page3.wait_for_timeout(200)
        shot(page3, '22_stats_tooltip.png')

    @step('Historique : suggestion de charge')
    def _():
        tab(page3, 'Sport')
        page3.get_by_role('tab', name='Bas', exact=True).click()
        page3.get_by_role('button', name='Démarrer la séance').click()
        txt = page3.locator('main').inner_text()
        ok('suggestion de progression', bool(re.search(r'Tout validé à \d+(,\d)? kg → essaie', txt)), txt[:200])
        shot(page3, '23_gym_seeded.png')
    ctx3.close()


    # ───────────── Parcours 5 : Compta, mensurations, alarmes (dimanche 29/11) ─────────────
    ctx5, page5 = make_context(browser, datetime.datetime(2026, 11, 29, 9, 0, 0))
    page5.goto('https://app.test/')
    page5.wait_for_selector('.app-header')
    norm = lambda t: re.sub(r'\s+', ' ', t)

    @step('Dimanche : rappel des mensurations')
    def _():
        ok('avant le départ', page5.get_by_text('Départ le lundi 30 novembre').is_visible())
        ok('rappel mesures', page5.get_by_text('pas encore de point de départ').is_visible())
        page5.get_by_role('button', name='Prendre mes mesures').click()
        ok('onglet Mesures ouvert', page5.get_by_role('tab', name='Mesures').get_attribute('aria-selected') == 'true')

    @step('Mensurations : saisie, écart, garde-fou')
    def _():
        page5.get_by_label('Tour de taille en centimètres').fill('740')
        ok('valeur hors limites refusée', page5.get_by_role('button', name='Enregistrer', exact=True).is_disabled())
        page5.get_by_label('Date de la mesure').fill('2026-11-26')
        page5.get_by_label('Tour de taille en centimètres').fill('73')
        page5.get_by_label('Tour de bras en centimètres').fill('28')
        page5.get_by_role('button', name='Enregistrer', exact=True).click()
        page5.get_by_label('Date de la mesure').fill('2026-11-29')
        page5.get_by_label('Tour de taille en centimètres').fill('74,5')
        page5.get_by_role('button', name='Enregistrer', exact=True).click()
        page5.wait_for_timeout(150)
        ok('écart +1,5 depuis le départ', page5.get_by_text('+1,5 cm').is_visible())
        shot(page5, '40_mesures.png')

    @step('Compta : prix, dépenses, plafond, export')
    def _():
        tab(page5, 'Aujourd’hui')
        page5.get_by_role('button', name='Mes compléments').click()
        page5.get_by_role('button', name='Vitamine D', exact=True).click()
        page5.get_by_role('button', name='Fermer').last.click()
        tab(page5, 'Compta')
        ok('état vide', page5.get_by_text('Rien de saisi pour l’instant').is_visible())
        page5.get_by_role('tab', name='Prix').click()
        for el in page5.get_by_label(re.compile('^Prix : ')).all():
            el.fill('2')
        page5.get_by_label('Montant : Abonnement salle').fill('30')
        page5.get_by_label('Prix du pot : Vitamine D').fill('10')
        page5.get_by_label('Durée d’un pot en semaines : Vitamine D').fill('9')
        page5.get_by_role('tab', name='Dépenses').click()
        page5.get_by_label('Montant de la dépense').fill('12,50')
        page5.get_by_label('Libellé de la dépense').fill('Courses')
        page5.get_by_role('button', name='Ajouter', exact=True).click()
        page5.get_by_label('Montant de la dépense').fill('40')
        page5.get_by_role('button', name='Compléments', exact=True).click()
        page5.get_by_label('Libellé de la dépense').fill('Whey')
        page5.get_by_role('button', name='Ajouter', exact=True).click()
        ok('historique', page5.get_by_text('Whey').first.is_visible())
        page5.get_by_role('button', name=re.compile('^Modifier la dépense Whey')).click()
        page5.get_by_label('Montant de la dépense').fill('45')
        page5.get_by_role('button', name='Enregistrer', exact=True).click()
        page5.get_by_role('tab', name='Résumé').click()
        page5.get_by_label('Plafond mensuel en euros').fill('100')
        txt = norm(page5.locator('main').inner_text())
        ok('dépensé 57,50 €', '57,50 €' in txt, txt[:300])
        ok('plafond : reste', 'Reste' in txt)
        ok('coût d’un jour standard', 'Un jour standard' in txt)
        ok('conseils de dépense', 'où mettre ton argent' in txt.lower())
        ok('graphique des dépenses', page5.locator('svg.recharts-surface').count() >= 1)
        shot(page5, '41_compta.png', True)
        page5.get_by_role('tab', name='Dépenses').click()
        page5.get_by_role('button', name='Exporter les dépenses (CSV)').click()
        page5.wait_for_timeout(200)
        dl = page5.evaluate('window.__lastDownload')
        ok('CSV exporté', dl and dl['filename'].startswith('cap72-depenses-') and 'Date;Libellé;Catégorie;Montant' in dl['data'], str(dl)[:200])
        page5.get_by_role('button', name=re.compile('^Modifier la dépense Whey')).click()
        page5.get_by_role('button', name='Supprimer cette dépense').click()
        page5.get_by_role('button', name='Confirmer la suppression').click()
        ok('dépense supprimée', page5.get_by_role('button', name=re.compile('^Modifier la dépense Whey')).count() == 0)

    @step('Nutrition : coût des courses et export Calendrier')
    def _():
        tab(page5, 'Nutrition')
        page5.get_by_role('tab', name='Courses').click()
        ok('budget de la liste', page5.get_by_text('Budget de cette liste').is_visible())
        page5.get_by_role('tab', name='Alarmes').click()
        page5.get_by_role('button', name=re.compile('Exporter pour Calendrier')).click()
        page5.wait_for_timeout(200)
        dl = page5.evaluate('window.__lastDownload')
        ok('.ics exporté', dl and dl['filename'] == 'cap72-alarmes.ics' and dl['data'].count('BEGIN:VEVENT') == 11, str(dl)[:120])
        page5.evaluate("(() => { const u = window.claude.use; window.__u = u; window.claude.use = async (n) => (n === 'downloads' ? null : u(n)); })()")
        page5.get_by_role('button', name=re.compile('Exporter pour Calendrier')).click()
        ok('repli sans téléchargement', page5.get_by_text('Le téléchargement n’est pas disponible ici').is_visible())

    @step('Export JSON : compta et mesures')
    def _():
        page5.evaluate('window.claude.use = window.__u')
        page5.get_by_label('Mes données : sauvegarde et synchronisation').click()
        page5.get_by_role('button', name='Exporter (JSON)').click()
        page5.wait_for_timeout(200)
        d = json.loads(page5.evaluate('window.__lastDownload')['data'])['data']
        ok('export : dépenses, mesures, drapeaux', len(d['budget']['expenses']) == 1 and len(d['body']) == 2 and 'flags' in d, str(list(d)))
        page5.get_by_role('button', name='Fermer').last.click()
    ctx5.close()

    # ───────────── Parcours 4 : petit écran (360 × 740), aucun débordement horizontal ─────────────
    # ───────────── Parcours 6 : vendredi 27/11 à 0 h 33, avant le départ : revenir à la veille ─────────────
    ctx6, page6 = make_context(browser, datetime.datetime(2026, 11, 27, 0, 33, 0))
    page6.goto('https://app.test/')
    page6.wait_for_selector('.app-header')

    @step('Après minuit, avant le départ : saisir la veille')
    def _():
        ok('invitation à compléter la veille', page6.get_by_text('Tu complètes encore la journée d’hier').is_visible())
        ok('jour précédent actif avant le départ', page6.get_by_role('button', name='Jour précédent').is_enabled())
        page6.get_by_role('button', name='Hier', exact=True).click()
        ok('journée d’hier affichée', page6.get_by_text('Hier · tu peux compléter cette journée').is_visible())
        ok('date d’hier', page6.get_by_text(re.compile(r'jeudi 26 novembre', re.I)).first.is_visible())
        page6.get_by_label('Heure de réveil').fill('07:00')
        page6.get_by_role('button', name=re.compile('^Petit-déjeuner : à faire|Petit-déjeuner')).first.click()
        page6.get_by_role('button', name='Revenir à aujourd’hui').click()
        page6.get_by_role('button', name='Jour précédent').click()
        ok('saisie conservée sur la veille', page6.get_by_label('Heure de réveil').input_value() == '07:00')
        for _ in range(6):
            page6.get_by_role('button', name='Jour précédent').click()
        ok('retour limité à 7 jours', page6.get_by_role('button', name='Jour précédent').is_disabled())
    ctx6.close()

    # ───────────── Parcours 7 : iPhone en mode application (encoche simulée à 59 px) ─────────────
    PAGE_OVERRIDE['html'] = HTML.replace('env(safe-area-inset-top, 0px)', '59px').replace('env(safe-area-inset-bottom, 0px)', '34px')
    ctx7, page7 = make_context(browser, datetime.datetime(2026, 12, 2, 15, 30, 0))
    page7.goto('https://app.test/')
    page7.wait_for_selector('.app-header')

    @step('iPhone : l’en-tête ne masque pas la navigation de jour')
    def _():
        def covered(sel_name):
            return page7.evaluate("""(n) => { const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===n); if(!b) return 'absent'; const r=b.getBoundingClientRect(); const e=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return (e===b||b.contains(e)) ? 'ok' : 'masqué par '+(e&&e.className); }""", sel_name)
        ok('« Jour précédent » atteignable', covered('Jour précédent') == 'ok', covered('Jour précédent'))
        page7.mouse.wheel(0, 600)
        page7.wait_for_timeout(200)
        ok('en-tête collé en haut après défilement', page7.evaluate("document.querySelector('.app-header').getBoundingClientRect().top") == 0)
        page7.mouse.wheel(0, -2000)
        page7.wait_for_timeout(200)
        page7.get_by_role('button', name='Jour précédent').click()
        ok('clic sur Jour précédent', page7.get_by_text('Mardi 1 décembre').first.is_visible())
        shot(page7, '40_iphone_notch.png')
    @step('Carte Maintenant : cocher en un geste')
    def _():
        page7.get_by_role('button', name='Revenir à aujourd’hui').click()
        ok('2 repas en retard annoncés', page7.get_by_text('2 repas pas cochés').is_visible())
        page7.get_by_role('button', name='Marquer Petit-déjeuner comme fait').click()
        ok('le petit-déjeuner est coché, il reste le déjeuner', page7.get_by_text('Déjeuner pas coché').is_visible())
        page7.get_by_role('button', name='Marquer Déjeuner comme fait').click()
        ok('plus de retard : le shake de 16 h 30 est proposé', page7.get_by_text('Shake Liquid Mass · 16:30').is_visible())
        shot(page7, '42_now.png')
    @step('Objectifs de la semaine et anneau de calories')
    def _():
        ok('anneau de calories', page7.get_by_role('img', name=re.compile('^Calories : ')).is_visible())
        ok('carte objectifs', page7.get_by_text('Objectifs · semaine 1').is_visible())
        for lbl in ['Séances de muscu', 'Sorties de course', 'Jours à 90 % des calories', 'Jours à 95 % des protéines', 'Pesées à jeun']:
            ok(f'objectif « {lbl} »', page7.get_by_text(lbl).is_visible())
        ok('prochain jalon', page7.get_by_text(re.compile('Prochain jalon')).is_visible())
        ok('barre de progression du programme', page7.get_by_role('progressbar', name='Avancement du programme').count() == 1)
        page7.get_by_text('Objectifs · semaine 1').scroll_into_view_if_needed()
        shot(page7, '41_goals.png')
    ctx7.close()
    PAGE_OVERRIDE.clear()

    ctx4, page4 = make_context(browser, datetime.datetime(2027, 1, 8, 9, 0, 0), seed_ls=seed, vp=(360, 740))
    page4.goto('https://app.test/')
    page4.wait_for_selector('.app-header')

    @step('Petit écran : pas de défilement horizontal')
    def _():
        for label in ['Aujourd’hui', 'Sport', 'Nutrition', 'Santé', 'Stats', 'Compta']:
            tab(page4, label)
            page4.wait_for_timeout(250)
            w = page4.evaluate('[document.documentElement.scrollWidth, window.innerWidth]')
            ok(f'360 px · {label} sans débordement', w[0] <= w[1], str(w))
        tab(page4, 'Santé')
        over = page4.evaluate("[...document.querySelectorAll('.tab-btn, [role=tab]')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
        ok('360 px · libellés d’onglets entiers', not over, str(over))
        page4.get_by_role('tab', name='Mesures').click()
        ok('360 px · sous-onglet Mesures sans débordement', page4.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        tab(page4, 'Compta')
        for sub in ['Prix', 'Dépenses']:
            page4.get_by_role('tab', name=sub).click()
            ok(f'360 px · Compta {sub} sans débordement', page4.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        shot(page4, '33_small_compta.png')
        tab(page4, 'Nutrition')
        for sub in ['Jours', 'Varier', 'Recettes', 'Courses', 'Alarmes']:
            page4.get_by_role('tab', name=sub).click()
            ok(f'360 px · Nutrition {sub} sans débordement', page4.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        over = page4.evaluate("[...document.querySelectorAll('[role=tab]')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
        ok('360 px · sous-onglets Nutrition entiers', not over, str(over))
        page4.get_by_role('tab', name='Varier').click()
        shot(page4, '34_small_varier.png', True)
        tab(page4, 'Aujourd’hui')
        shot(page4, '30_small_today.png', True)
        tab(page4, 'Sport')
        shot(page4, '31_small_train.png')
        tab(page4, 'Nutrition')
        shot(page4, '32_small_nutri.png')
    ctx4.close()
    browser.close()

# ───────────── Bilan ─────────────
bad = [l for l in logs if not (l[0] == 'warning' and 'Download the React DevTools' in l[1])]
print('\nConsole / erreurs de page :', len(bad))
for l in bad[:20]:
    print('  ', l[0], l[1][:240])
fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} vérifications réussies ; console : {len(bad)} message(s)')
sys.exit(1 if fails or bad else 0)
