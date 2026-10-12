#!/usr/bin/env node
// Render driver. Run with an empty NODE_OPTIONS on this machine:
//   NODE_OPTIONS= node render.mjs               full reel -> out/martand_farsan_reel.mp4 (+ out/soundtrack.wav)
//   NODE_OPTIONS= node render.mjs --test        5 s pipeline test -> out/test_clip.mp4
//   NODE_OPTIONS= node render.mjs --stills 1,8.5,20   PNG stills -> out/stills/still_<t>.png
//   NODE_OPTIONS= node render.mjs --textsheet   Devanagari text sheets -> out/stills/text_sheet_*.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT, ORIGIN, writeDataUrl } from './src/serve.mjs';
import { muxMp4 } from './src/mp4mux.mjs';
import { makeSrt } from './tools/make_srt.mjs';

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

async function textsheet(page) {
  await page.goto(`${ORIGIN}/src/textsheet.html`);
  const res = await page.evaluate(() => window.renderSheets());
  console.log(`text backend: ${res.backend}`);
  if (res.missing.length) console.log(`WARNING: characters without glyphs: ${res.missing.join(' ')}`);
  for (const [name, url] of Object.entries(res.pages)) {
    const f = path.join(OUT, 'stills', `${name}.png`);
    writeDataUrl(f, url);
    console.log(`wrote ${path.relative(ROOT, f)}`);
  }
  if (res.missing.length) process.exitCode = 1;
}

function wavFile(pcm, sampleRate, channels) {
  // pcm: Int16Array interleaved
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function encode(page, mode, outName) {
  const video = [], audio = [];
  let wavParts = [], wavInfo = null;
  await page.exposeFunction('__sendChunks', (kind, batch) => {
    for (const c of batch) {
      const rec = { data: Buffer.from(c.data, 'base64'), ts: c.ts, dur: c.dur, key: c.key };
      (kind === 'video' ? video : audio).push(rec);
    }
  });
  await page.exposeFunction('__sendWav', (b64, info) => { wavParts.push(Buffer.from(b64, 'base64')); if (info) wavInfo = info; });
  await page.exposeFunction('__progress', msg => process.stdout.write(`\r${msg}        `));
  await page.goto(`${ORIGIN}/src/reel.html?mode=${mode}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const t0 = Date.now();
  const meta = await page.evaluate(() => window.encodeReel());
  process.stdout.write('\n');
  console.log(`encoded ${video.length} video / ${audio.length} audio chunks in ${((Date.now() - t0) / 1000).toFixed(1)} s (text backend: ${meta.textBackend})`);
  // the muxer writes no ctts box, so it needs decode order == presentation order (no B-frames)
  for (const [name, list] of [['video', video], ['audio', audio]]) {
    for (let i = 1; i < list.length; i++) if (!(list[i].ts > list[i - 1].ts)) throw new Error(`${name} chunk ${i} timestamp ${list[i].ts} is not after ${list[i - 1].ts} (B-frames or reordering are not supported by src/mp4mux.mjs)`);
  }
  const mp4 = muxMp4({
    video: { width: meta.width, height: meta.height, timescale: 90000, fps: meta.fps, codec: meta.videoCodec, avcC: Buffer.from(meta.avcC, 'base64'), samples: video },
    audio: audio.length ? { sampleRate: meta.sampleRate, channels: meta.channels, preSkip: meta.preSkip, samples: audio, durationSamples: meta.audioSamples } : null,
  });
  const f = path.join(OUT, outName);
  fs.writeFileSync(f, mp4);
  console.log(`wrote ${path.relative(ROOT, f)} (${(mp4.length / 1e6).toFixed(2)} MB, ${meta.duration}s)`);
  if (wavParts.length && wavInfo) {
    const pcm = Buffer.concat(wavParts);
    const wf = path.join(OUT, mode === 'test' ? 'test_clip.wav' : 'soundtrack.wav');
    fs.writeFileSync(wf, wavFile(new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2), wavInfo.sampleRate, wavInfo.channels));
    console.log(`wrote ${path.relative(ROOT, wf)}`);
  }
}

async function stills(page, list) {
  await page.goto(`${ORIGIN}/src/reel.html?mode=reel`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  for (const t of list) {
    const url = await page.evaluate(t => window.renderStill(t), t);
    const f = path.join(OUT, 'stills', `still_${String(t.toFixed(2)).padStart(5, '0')}.png`);
    writeDataUrl(f, url);
    console.log(`wrote ${path.relative(ROOT, f)}`);
  }
}

const { browser, page } = await launch();
try {
  if (flag('--textsheet')) await textsheet(page);
  else if (flag('--stills')) await stills(page, (opt('--stills') || '1').split(',').map(Number));
  else if (flag('--test')) await encode(page, 'test', 'test_clip.mp4');
  else {
    console.log(`wrote ${path.relative(ROOT, makeSrt())}`);
    await encode(page, 'reel', 'martand_farsan_reel.mp4');
  }
} catch (e) {
  console.error(e.stack || e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
