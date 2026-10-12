// Glyph tuning lab: renders variants of a glyph inside sample words for side-by-side comparison.
//   NODE_OPTIONS= node tools/glyphlab.mjs variants.json out.png
// variants.json: {size, rows:[{ch, word, variants:[{id, def:{a, s, d, ...}}]}]} (def as in src/deva.js; omit def = current)
import fs from 'node:fs';
import { launch, ORIGIN, writeDataUrl } from '../src/serve.mjs';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { browser, page } = await launch();
await page.goto(`${ORIGIN}/src/textsheet.html`);
const url = await page.evaluate(async (spec) => {
  await Text.init();
  const c = document.getElementById('c'); const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf6ec'; ctx.fillRect(0, 0, 1080, 1920);
  const size = spec.size || 100;
  let y = 40;
  for (const row of spec.rows) {
    let x = 30;
    for (const v of row.variants) {
      if (v.def) Deva._setGlyph(row.ch, Object.assign({}, v.def));
      ctx.fillStyle = '#a00'; ctx.font = '600 22px "Noto Sans"'; ctx.fillText(v.id, x, y + 20);
      const w = v.word || row.word;
      Text.draw(ctx, w, x, y + 50, size, { fill: '#2b1a10' });
      x += Deva.measure(w, size) + 50;
    }
    y += size * 1.6;
  }
  return c.toDataURL('image/png');
}, spec);
writeDataUrl(process.argv[3], url);
await browser.close();
