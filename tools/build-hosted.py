#!/usr/bin/env python3
"""Transforme dist/test.html en docs/index.html : balises iPhone, manifeste, icône et service worker."""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'dist' / 'test.html').read_text(encoding='utf-8')

old_head = '</head><body><title>Cap 72 kg</title>\n'
assert old_head in src, "structure de dist/test.html inattendue"
head = '''<title>Cap 72 kg</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Cap 72 kg">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-180.png">
</head><body>
'''
html = src.replace(old_head, head)

sw = '<script>if("serviceWorker"in navigator&&location.protocol==="https:"){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}</script>\n'
assert '</body>' in html
html = html.replace('</body>', sw + '</body>', 1)
(root / 'docs' / 'index.html').write_text(html, encoding='utf-8')
print('docs/index.html :', len(html) // 1024, 'Ko')
