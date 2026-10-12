#!/usr/bin/env node
// Structural + playback verification of a rendered MP4.
//   NODE_OPTIONS= node verify.mjs [out/martand_farsan_reel.mp4] [--expect-duration 56]
// 1) parses the ISO-BMFF box tree and prints the tracks
// 2) loads the file in headless Chromium <video> (https://x.test origin): metadata, size, duration,
//    seek to the middle, canplay; grabs the decoded middle frame -> out/stills/decoded_check.png
// 3) decodes the audio track with AudioContext.decodeAudioData
// Exits non-zero on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT, ORIGIN, writeDataUrl } from './src/serve.mjs';

const args = process.argv.slice(2);
const fileArg = args.find(a => !a.startsWith('--')) || 'out/martand_farsan_reel.mp4';
const ei = args.indexOf('--expect-duration');
const file = path.resolve(ROOT, fileArg);
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures.push(msg); };

if (!fs.existsSync(file)) { console.error(`missing ${file}`); process.exit(1); }
const buf = fs.readFileSync(file);

// ---------------------------------------------------------------- box tree
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf']);
function parse(start, end, depth, out) {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(p + 8)); hdr = 16; }
    else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) throw new Error(`bad box ${type} at ${p} size ${size}`);
    const b = { type, start: p, size, hdr, depth, children: [] };
    out.push(b);
    if (CONTAINERS.has(type)) parse(p + hdr, p + size, depth + 1, b.children);
    if (type === 'stsd') parse(p + hdr + 8, p + size, depth + 1, b.children);
    if (type === 'avc1' || type === 'Opus') parse(p + hdr + (type === 'avc1' ? 78 : 28), p + size, depth + 1, b.children);
    p += size;
  }
  if (p !== end) throw new Error(`trailing bytes at ${p}`);
  return out;
}
const find = (list, type) => { for (const b of list) { if (b.type === type) return b; const r = find(b.children, type); if (r) return r; } return null; };
const findAll = (list, type, acc = []) => { for (const b of list) { if (b.type === type) acc.push(b); findAll(b.children, type, acc); } return acc; };

let tree;
try { tree = parse(0, buf.length, 0, []); check(true, `box tree parses (${buf.length} bytes)`); }
catch (e) { check(false, `box tree: ${e.message}`); }

const tracks = [];
if (tree) {
  const top = tree.map(b => b.type).join(' ');
  console.log(`top-level boxes: ${top}`);
  check(['ftyp', 'moov', 'mdat'].every(t => tree.some(b => b.type === t)), 'ftyp + moov + mdat present');
  const mvhd = find(tree, 'mvhd');
  const mv = mvhd.start + mvhd.hdr;
  const mvTs = buf.readUInt32BE(mv + 20), mvDur = Number(buf.readBigUInt64BE(mv + 24));
  const movieDuration = mvDur / mvTs;
  console.log(`movie duration ${movieDuration.toFixed(3)} s`);
  for (const trak of findAll(tree, 'trak')) {
    const mdhd = find(trak.children, 'mdhd'), hdlr = find(trak.children, 'hdlr');
    const m = mdhd.start + mdhd.hdr;
    const ts = buf.readUInt32BE(m + 20), dur = Number(buf.readBigUInt64BE(m + 24));
    const kind = buf.toString('latin1', hdlr.start + hdlr.hdr + 8, hdlr.start + hdlr.hdr + 12);
    const stsz = find(trak.children, 'stsz');
    const count = buf.readUInt32BE(stsz.start + stsz.hdr + 8);
    const co64 = find(trak.children, 'co64') || find(trak.children, 'stco');
    const entry = find(trak.children, 'stsd').children[0];
    const t = { kind, codec: entry.type, timescale: ts, duration: dur / ts, samples: count };
    if (entry.type === 'avc1') {
      const e = entry.start + entry.hdr;
      t.width = buf.readUInt16BE(e + 24); t.height = buf.readUInt16BE(e + 26);
      const avcC = find(entry.children, 'avcC');
      const a = avcC.start + avcC.hdr;
      t.profile = buf[a + 1]; t.level = buf[a + 3];
      t.fps = count / t.duration;
      const stss = find(trak.children, 'stss');
      t.keyframes = stss ? buf.readUInt32BE(stss.start + stss.hdr + 4) : 0;
    } else if (entry.type === 'Opus') {
      const dOps = find(entry.children, 'dOps');
      const d = dOps.start + dOps.hdr;
      t.channels = buf[d + 1]; t.preSkip = buf.readUInt16BE(d + 2); t.inputRate = buf.readUInt32BE(d + 4);
    }
    // all chunk offsets must point inside mdat
    const mdat = tree.find(b => b.type === 'mdat');
    const n = buf.readUInt32BE(co64.start + co64.hdr + 4);
    let inside = true;
    for (let i = 0; i < n; i++) {
      const off = co64.type === 'co64' ? Number(buf.readBigUInt64BE(co64.start + co64.hdr + 8 + i * 8)) : buf.readUInt32BE(co64.start + co64.hdr + 8 + i * 4);
      if (off < mdat.start + mdat.hdr || off >= mdat.start + mdat.size) { inside = false; break; }
    }
    t.offsetsOk = inside;
    tracks.push(t);
    console.log(`track: ${JSON.stringify(t)}`);
  }
  const v = tracks.find(t => t.kind === 'vide');
  const a = tracks.find(t => t.kind === 'soun');
  check(v && v.codec === 'avc1', 'H.264 (avc1) video track');
  check(v && v.width === 1080 && v.height === 1920, `video 1080x1920 (got ${v && v.width}x${v && v.height})`);
  check(v && Math.abs(v.fps - 30) < 0.5, `~30 fps (got ${v && v.fps.toFixed(2)})`);
  check(a && a.codec === 'Opus', 'Opus audio track');
  check(tracks.every(t => t.offsetsOk), 'all sample offsets inside mdat');
  globalThis.__movieDuration = movieDuration;
}

// ---------------------------------------------------------------- playback in Chromium
const expect = ei >= 0 ? Number(args[ei + 1]) : globalThis.__movieDuration;
const rel = path.relative(ROOT, file).split(path.sep).join('/');
const { browser, page } = await launch();
try {
  await page.goto(`${ORIGIN}/src/textsheet.html`); // any page on the secure origin
  const r = await page.evaluate(async (src) => {
    const out = {};
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = src;
    document.body.appendChild(v);
    const wait = (ev, ms) => new Promise((ok, bad) => {
      const to = setTimeout(() => bad(new Error('timeout waiting for ' + ev)), ms);
      v.addEventListener(ev, () => { clearTimeout(to); ok(); }, { once: true });
      v.addEventListener('error', () => { clearTimeout(to); bad(new Error('media error ' + (v.error && v.error.code) + ' ' + (v.error && v.error.message))); }, { once: true });
    });
    try {
      await wait('loadedmetadata', 20000);
      out.loadedmetadata = true;
      out.w = v.videoWidth; out.h = v.videoHeight; out.duration = v.duration;
      if (v.readyState < 3) await wait('canplay', 20000);
      out.canplay = true;
      const mid = v.duration / 2;
      v.currentTime = mid;
      await wait('seeked', 20000);
      out.seeked = true; out.seekTime = v.currentTime;
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 997) { sum += px[i] + px[i + 1] + px[i + 2]; n++; }
      out.meanLuma = sum / n / 3;
      out.png = c.toDataURL('image/png');
      // audio track decodes?
      const bytes = await (await fetch(src)).arrayBuffer();
      const ac = new OfflineAudioContext(2, 48000, 48000);
      const ab = await ac.decodeAudioData(bytes);
      const ch = ab.getChannelData(0);
      let peak = 0; for (let i = 0; i < ch.length; i += 7) peak = Math.max(peak, Math.abs(ch[i]));
      out.audio = { duration: ab.duration, channels: ab.numberOfChannels, sampleRate: ab.sampleRate, peak };
    } catch (e) { out.error = e.message; }
    return out;
  }, `${ORIGIN}/${rel}`);
  if (r.error) check(false, `chromium playback: ${r.error}`);
  check(r.loadedmetadata, 'Chromium <video> loadedmetadata fired');
  check(r.w === 1080 && r.h === 1920, `decoded size ${r.w}x${r.h}`);
  check(r.duration && Math.abs(r.duration - expect) < 0.5, `duration ${r.duration && r.duration.toFixed(3)} s (expected ~${expect && expect.toFixed(2)})`);
  check(r.canplay, 'canplay fired');
  check(r.seeked, `seek to middle worked (currentTime ${r.seekTime && r.seekTime.toFixed(3)})`);
  check(r.meanLuma > 2, `decoded frame is not blank (mean ${r.meanLuma && r.meanLuma.toFixed(1)})`);
  check(r.audio && r.audio.duration > expect - 0.6 && r.audio.peak > 0.01, `audio decodes (${r.audio && JSON.stringify(r.audio)})`);
  if (r.png) {
    const f = path.join(ROOT, 'out', 'stills', 'decoded_check.png');
    writeDataUrl(f, r.png);
    console.log(`wrote ${path.relative(ROOT, f)}`);
  }
} finally {
  await browser.close();
}
if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
