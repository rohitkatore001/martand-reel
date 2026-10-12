// Minimal ISO-BMFF (MP4) muxer: one H.264 (avc1/avcC) video track + optional Opus audio track.
// Samples are written sequentially (all video, then all audio) into a single mdat; moov is
// placed before mdat (fast start) using 64-bit chunk offsets (co64), one chunk per sample.
//
// input: muxMp4({
//   video: { width, height, timescale, fps, codec, avcC: Buffer, samples: [{data, ts(us), dur(us), key}] },
//   audio: { sampleRate, channels, preSkip, durationSamples, samples: [{data, ts(us), dur(us)}] } | null })
// Opus mapping per "Encapsulation of Opus in ISO Base Media File Format" (Opus sample entry + dOps).

const u8 = n => Buffer.from([n & 255]);
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const i16 = n => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
const str = s => Buffer.from(s, 'latin1');

function box(type, ...parts) {
  const body = Buffer.concat(parts.flat());
  return Buffer.concat([u32(8 + body.length), str(type), body]);
}
function fullbox(type, version, flags, ...parts) {
  return box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
}
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32);

function mvhd(timescale, duration, nextTrack) {
  return fullbox('mvhd', 1, 0, u64(0), u64(0), u32(timescale), u64(duration), u32(0x00010000), u16(0x0100), u16(0),
    u32(0), u32(0), ...MATRIX, ...Array(6).fill(u32(0)), u32(nextTrack));
}
function tkhd(id, duration, w, h, isAudio) {
  return fullbox('tkhd', 1, 3, u64(0), u64(0), u32(id), u32(0), u64(duration), u32(0), u32(0),
    i16(0), i16(isAudio ? 1 : 0), u16(isAudio ? 0x0100 : 0), u16(0), ...MATRIX, u32(w << 16), u32(h << 16));
}
function mdhd(timescale, duration) {
  // language 'und' packed ISO-639-2/T
  const lang = ((('u'.charCodeAt(0) - 0x60) << 10) | (('n'.charCodeAt(0) - 0x60) << 5) | ('d'.charCodeAt(0) - 0x60));
  return fullbox('mdhd', 1, 0, u64(0), u64(0), u32(timescale), u64(duration), u16(lang), u16(0));
}
function hdlr(type, name) {
  return fullbox('hdlr', 0, 0, u32(0), str(type), u32(0), u32(0), u32(0), str(name + '\0'));
}
function dinf() { return box('dinf', fullbox('dref', 0, 0, u32(1), fullbox('url ', 0, 1))); }

function stts(deltas) {
  const runs = [];
  for (const d of deltas) {
    const r = runs[runs.length - 1];
    if (r && r[1] === d) r[0]++; else runs.push([1, d]);
  }
  return fullbox('stts', 0, 0, u32(runs.length), ...runs.flatMap(([c, d]) => [u32(c), u32(d)]));
}
function stsc() { return fullbox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)); }
function stsz(sizes) { return fullbox('stsz', 0, 0, u32(0), u32(sizes.length), ...sizes.map(u32)); }
function co64(offsets) { return fullbox('co64', 0, 0, u32(offsets.length), ...offsets.map(u64)); }
function stss(keys) { return fullbox('stss', 0, 0, u32(keys.length), ...keys.map(u32)); }

function avc1(w, h, avcC) {
  return box('avc1', Buffer.alloc(6), u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(w), u16(h),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), Buffer.alloc(32), u16(0x0018), i16(-1),
    box('avcC', avcC), box('pasp', u32(1), u32(1)));
}
function opusEntry(channels, sampleRate, preSkip) {
  const dOps = box('dOps', u8(0), u8(channels), u16(preSkip), u32(sampleRate), i16(0), u8(0));
  return box('Opus', Buffer.alloc(6), u16(1), u32(0), u32(0), u16(channels), u16(16), u16(0), u16(0),
    u32(48000 << 16), dOps);
}
function elst(segDur, mediaTime) {
  return box('edts', fullbox('elst', 1, 0, u32(1), u64(segDur), u64(mediaTime), u16(1), u16(0)));
}

export function muxMp4({ video, audio }) {
  const MOVIE_TS = 1000;
  const vts = video.timescale || 90000;
  // video sample deltas from timestamps (us -> timescale), last sample uses its duration
  const vs = video.samples.slice().sort((a, b) => a.ts - b.ts);
  const vT = vs.map(s => Math.round(s.ts * vts / 1e6));
  const frameDur = Math.round(vts / video.fps);
  const vDeltas = vT.map((t, i) => (i + 1 < vT.length ? vT[i + 1] - t : frameDur));
  const vDur = vDeltas.reduce((a, b) => a + b, 0);
  const keys = vs.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);

  let as = null, aDeltas = null, aDur = 0;
  const ats = 48000;
  if (audio) {
    as = audio.samples.slice().sort((a, b) => a.ts - b.ts);
    aDeltas = as.map(s => Math.round(s.dur * ats / 1e6));
    aDur = aDeltas.reduce((a, b) => a + b, 0);
  }

  const build = (base) => {
    let off = base;
    const vOff = vs.map(s => { const o = off; off += s.data.length; return o; });
    const aOff = as ? as.map(s => { const o = off; off += s.data.length; return o; }) : [];
    const vMovieDur = Math.round(vDur * MOVIE_TS / vts);
    const vtrak = box('trak',
      tkhd(1, vMovieDur, video.width, video.height, false),
      elst(vMovieDur, 0),
      box('mdia', mdhd(vts, vDur), hdlr('vide', 'VideoHandler'),
        box('minf', fullbox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf(),
          box('stbl', fullbox('stsd', 0, 0, u32(1), avc1(video.width, video.height, video.avcC)),
            stts(vDeltas), stss(keys), stsc(), stsz(vs.map(s => s.data.length)), co64(vOff)))));
    const traks = [vtrak];
    let movieDur = vMovieDur;
    if (as) {
      const preSkip = audio.preSkip || 312;
      const playable = audio.durationSamples ? Math.min(audio.durationSamples, aDur - preSkip) : aDur - preSkip;
      const aMovieDur = Math.round(playable * MOVIE_TS / ats);
      movieDur = Math.max(movieDur, aMovieDur);
      traks.push(box('trak',
        tkhd(2, aMovieDur, 0, 0, true),
        elst(aMovieDur, preSkip),
        box('mdia', mdhd(ats, aDur), hdlr('soun', 'SoundHandler'),
          box('minf', fullbox('smhd', 0, 0, i16(0), u16(0)), dinf(),
            box('stbl', fullbox('stsd', 0, 0, u32(1), opusEntry(audio.channels, audio.sampleRate, preSkip)),
              stts(aDeltas), stsc(), stsz(as.map(s => s.data.length)), co64(aOff))))));
    }
    return box('moov', mvhd(MOVIE_TS, movieDur, traks.length + 1), ...traks);
  };

  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'), str('Opus'));
  const payload = Buffer.concat([...vs.map(s => s.data), ...(as ? as.map(s => s.data) : [])]);
  const mdatHeader = payload.length + 16 > 0xffffffff
    ? Buffer.concat([u32(1), str('mdat'), u64(payload.length + 16)])
    : Buffer.concat([u32(payload.length + 8), str('mdat')]);
  // moov size does not depend on offsets (co64 is fixed width), so build twice
  const moov0 = build(0);
  const base = ftyp.length + moov0.length + mdatHeader.length;
  const moov = build(base);
  return Buffer.concat([ftyp, moov, mdatHeader, payload]);
}
