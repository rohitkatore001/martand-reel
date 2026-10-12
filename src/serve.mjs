// Shared Chromium launcher + local file server on the secure origin https://x.test/
// (WebCodecs is only exposed in secure contexts; about:blank and file:// are not enough).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://x.test';

const PW = '/opt/toolchains/.nvm/versions/node/v22.23.3/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.css': 'text/css',
};

// Lists drop-in assets so the page can pick them up without code changes.
export function assetManifest() {
  const list = (dir, exts) => {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter(f => exts.includes(path.extname(f).toLowerCase())).sort().map(f => `${dir}/${f}`);
  };
  return {
    fonts: list('assets/fonts', ['.ttf', '.otf', '.woff', '.woff2']),
    photos: list('assets/photos', ['.jpg', '.jpeg', '.png', '.webp']),
    vo: list('assets/vo', ['.wav']),
  };
}

export async function launch() {
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await context.route(`${ORIGIN}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__assets.json') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(assetManifest()) });
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel || 'index.html');
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: 'not found' });
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const body = fs.readFileSync(file);
    const range = route.request().headers()['range'];
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      // Byte-range support so <video> seeking works in verify.mjs.
      let [a, b] = range.slice(6).split('-');
      let start = a === '' ? body.length - Number(b) : Number(a);
      let end = (a !== '' && b !== '') ? Number(b) : body.length - 1;
      end = Math.min(end, body.length - 1);
      return route.fulfill({
        status: 206, body: body.subarray(start, end + 1),
        headers: { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` },
      });
    }
    return route.fulfill({ status: 200, body, headers: { 'content-type': type, 'accept-ranges': 'bytes' } });
  });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => console.log(`[page error] ${e.message}`));
  return { browser, context, page };
}

export function writeDataUrl(file, dataUrl) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}
