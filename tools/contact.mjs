// Contact sheet of rendered stills: NODE_OPTIONS= node tools/contact.mjs out/contact.png out/stills/still_01.50.png ...
// Tiles up to 16 images (4 x 4) into one 1080x1920 PNG with the file name under each tile.
import { launch, ORIGIN, writeDataUrl } from '../src/serve.mjs';
const [outFile, ...files] = process.argv.slice(2);
const { browser, page } = await launch();
await page.goto(`${ORIGIN}/src/textsheet.html`);
const url = await page.evaluate(async (files) => {
  const c = document.getElementById('c'), ctx = c.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 1080, 1920);
  const cols = 4, tw = 270, th = 480;
  for (let i = 0; i < files.length && i < 16; i++) {
    const img = new Image(); img.src = '/' + files[i]; await img.decode();
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    ctx.drawImage(img, x + 2, y + 2, tw - 4, th - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 2, y + th - 26, tw - 4, 24);
    ctx.fillStyle = '#fff'; ctx.font = '600 16px "Noto Sans"'; ctx.fillText(files[i].split('/').pop(), x + 8, y + th - 9);
  }
  return c.toDataURL('image/png');
}, files);
writeDataUrl(outFile, url);
await browser.close();
console.log('wrote ' + outFile);
