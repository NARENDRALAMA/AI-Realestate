// Writes dist/_headers (Cloudflare Pages response headers) after `npm run build`.
// Usage: VITE_API_URL=https://<cloud-run-url> node scripts/write-headers.mjs
//
// The prerendered index.html contains small inline <script> blocks (the deferred app
// loader), so instead of allowing every inline script ('unsafe-inline') the CSP lists
// the SHA-256 hash of each one. The hashes change with every build, which is why this
// runs after the build instead of being a static file in public/.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const api = (process.env.VITE_API_URL ?? '').replace(/\/$/, '')
if (!/^https:\/\//.test(api)) throw new Error('Set VITE_API_URL to the https:// backend URL')

const html = await readFile(`${root}dist/index.html`, 'utf8')
const sha = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`
const unique = (items) => [...new Set(items)]
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(([, body]) => sha(body))
// The inlined stylesheet(s) and the few style="" attributes in the prerendered HTML are
// allowed by hash too, so no 'unsafe-inline' is needed. 'unsafe-hashes' only lets
// attributes whose exact text matches a listed hash through. Styles React sets later
// go through the CSSOM (element.style), which CSP does not restrict.
const styleBlocks = unique([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, body]) => sha(body)))
const styleAttrs = unique([...html.matchAll(/\sstyle="([^"]*)"/g)].map(([, value]) => sha(value)))

const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`,
  `style-src 'self' ${styleBlocks.join(' ')}${styleAttrs.length ? ` 'unsafe-hashes' ${styleAttrs.join(' ')}` : ''}`,
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${api}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
  ! Access-Control-Allow-Origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
await writeFile(`${root}dist/_headers`, headers)
console.log(
  `Wrote dist/_headers (${hashes.length} script, ${styleBlocks.length} style-block, ${styleAttrs.length} style-attribute hashes; connect-src ${api})`,
)
