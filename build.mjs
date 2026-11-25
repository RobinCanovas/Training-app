import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as lucide from 'lucide';

const root = process.cwd();
mkdirSync('dist', { recursive: true });

// 1. Icônes Lucide : on n'embarque que celles qui sont citées dans le code
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(f) && !f.startsWith('icons.generated')) files.push(p);
  }
})('src');
const names = new Set();
const declared = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"`]([A-Z][A-Za-z0-9]*)['"`]/g)) if (lucide.icons[m[1]]) names.add(m[1]);
  for (const m of src.matchAll(/(?:icon|name)\s*[=:]\s*['"]([A-Z][A-Za-z0-9]*)['"]/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\?\s*'([A-Z][A-Za-z0-9]*)'\s*:\s*'([A-Z][A-Za-z0-9]*)'/g)) { declared.add(m[1]); declared.add(m[2]); }
}
const missing = [...declared].filter((n) => !lucide.icons[n] && !['Barlow'].includes(n));
if (missing.length) console.warn('⚠ icônes introuvables :', missing.join(', '));
const icons = Object.fromEntries([...names].sort().map((n) => [n, lucide.icons[n]]));
writeFileSync('src/icons.generated.js', `export const ICONS = ${JSON.stringify(icons)};\n`);
console.log(`icônes embarquées : ${names.size}`);

// 2. Tailwind (CSS précompilé)
execFileSync('npx', ['tailwindcss', '-c', 'tailwind.config.cjs', '-i', 'src/styles.css', '-o', 'dist/tw.css', '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
const css = readFileSync('dist/tw.css', 'utf8');

// 3. JS : JSX → IIFE, React/ReactDOM/Recharts viennent de globales (CDN)
await build({
  entryPoints: ['src/main.jsx'],
  outfile: 'dist/bundle.js',
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  jsx: 'transform',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  inject: [resolve(root, 'src/shims/inject-react.js')],
  alias: {
    react: resolve(root, 'src/shims/react.js'),
    'react-dom/client': resolve(root, 'src/shims/react-dom-client.js'),
    recharts: resolve(root, 'src/shims/recharts.js'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
let js = readFileSync('dist/bundle.js', 'utf8');
if (/<\/script/i.test(js)) { js = js.replace(/<\/script/gi, '<\\/script'); console.warn('· </script échappé dans le bundle'); }

// 4. Fragment HTML pour l'Artifact
const CDN = [
  'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js',
  'https://cdn.jsdelivr.net/npm/recharts@2.15.4/umd/Recharts.js',
];
const FONT = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap';
const fallback = "<p style=\"padding:24px;font:16px system-ui;color:#EAF0FA\">Impossible de charger les bibliothèques (réseau). Recharge la page.</p>";
const fragment = `<title>Cap 72 kg</title>
<meta name="theme-color" content="#0B1020">
<link rel="stylesheet" href="${FONT}">
<style>${css}</style>
<div id="cap72-root"></div>
${CDN.map((u) => `<script src="${u}"></script>`).join('\n')}
<script>
if (!(window.React && window.ReactDOM && window.Recharts && window.PropTypes)) {
  document.getElementById('cap72-root').innerHTML = ${JSON.stringify(fallback)};
} else {
${js}
}
</script>
`;
writeFileSync('dist/cap72.html', fragment);

// 5. Page de test : même squelette que l'Artifact
const skeleton = `<!doctype html><html lang="fr"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0}</style></head><body>${fragment}</body></html>`;
writeFileSync('dist/test.html', skeleton);
console.log(`fragment : ${(fragment.length / 1024).toFixed(0)} Ko · css ${(css.length / 1024).toFixed(0)} Ko · js ${(js.length / 1024).toFixed(0)} Ko`);
