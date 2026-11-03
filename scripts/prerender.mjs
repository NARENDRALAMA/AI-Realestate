// Renders the landing page to static HTML and injects it into dist/index.html.
// Runs after `vite build` and `vite build --ssr` (see the "build" script).
// The stylesheet is inlined too, removing the only render-blocking request.
//
// Because "/" is fully prerendered (visible and navigable without JavaScript), the app
// bundle is not needed for first paint there. The entry script and its modulepreloads are
// moved into a tiny loader: on "/" it starts after the window `load` event (then hydrates),
// on every other route (served the same file by the SPA fallback) it starts immediately.
import { readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ssrEntry = pathToFileURL(`${root}dist-ssr/entry-server.js`).href
const indexPath = `${root}dist/index.html`

const { render } = await import(ssrEntry)
const html = render('/')
let page = await readFile(indexPath, 'utf8')

if (!page.includes('<div id="root"></div>')) throw new Error('root placeholder not found in dist/index.html')
// Motion renders its settled state as inline styles (style="opacity:1;transform:none").
// Those values are the CSS defaults, so the attributes change nothing visually; removing
// them lets the Content-Security-Policy forbid inline style attributes entirely (no
// 'unsafe-inline' or 'unsafe-hashes'). Motion sets later styles through element.style,
// which CSP allows. Attributes with any non-default declaration are kept.
const DEFAULT_DECLARATIONS = new Set(['opacity:1', 'transform:none', 'height:auto', 'width:auto'])
const isDefaultOnly = (value) =>
  value.split(';').map((d) => d.trim().replace(/\s+/g, '')).filter(Boolean).every((d) => DEFAULT_DECLARATIONS.has(d))
const bodyHtml = html.replace(/\sstyle="([^"]*)"/g, (attr, value) => (isDefaultOnly(value) ? '' : attr))
page = page.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)

// Inline the (single) stylesheet so first paint doesn't wait on a render-blocking request.
const cssRe = /<link rel="stylesheet" crossorigin href="([^"]+)">/
const cssHref = page.match(cssRe)?.[1]
if (cssHref) {
  const css = (await readFile(`${root}dist${cssHref}`, 'utf8'))
    // The display serif only styles headings: never swap it in late (that would delay the
    // headline's paint and shift layout). It's used when ready at first paint or cached.
    .replace(/@font-face\{[^}]*Newsreader Variable[^}]*\}/g, (rule) =>
      rule.replace('font-display:swap', 'font-display:optional'),
    )
  page = page.replace(cssRe, () => `<style>${css}</style>`)
}

const entryRe = /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/
const preloadRe = /<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g
const entry = page.match(entryRe)?.[1]
if (!entry) throw new Error('entry script not found in dist/index.html')
const preloads = [...page.matchAll(preloadRe)].map((m) => m[1])
page = page.replace(entryRe, '').replace(preloadRe, '')

const loader = `<script>
      (function () {
        var entry = ${JSON.stringify(entry)}, preloads = ${JSON.stringify(preloads)};
        function start() {
          preloads.forEach(function (href) {
            var l = document.createElement('link');
            l.rel = 'modulepreload'; l.crossOrigin = ''; l.href = href;
            document.head.appendChild(l);
          });
          var s = document.createElement('script');
          s.type = 'module'; s.crossOrigin = ''; s.src = entry;
          document.head.appendChild(s);
        }
        if (location.pathname !== '/' || document.readyState === 'complete') start();
        else window.addEventListener('load', start, { once: true });
      })();
    </script>
  </head>`
page = page.replace('</head>', loader)

await writeFile(indexPath, page)
await rm(`${root}dist-ssr`, { recursive: true, force: true })
console.log(
  `Prerendered landing page (${(html.length / 1024).toFixed(1)} KB of HTML); deferred ${entry} + ${preloads.length} preloads`,
)
