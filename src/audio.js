// audio.js - synthesized soundtrack for the reel (window.ReelAudio), rendered in an OfflineAudioContext.
// Everything is deterministic (seeded noise). Sound plan follows the script:
//   0-3 s   ASMR crunch hits                     3-8 s   rain ambience + harmonium drone + bansuri flute
//   8-15 s  warm flashback flute                 15-20 s toss whoosh, packet tear, bite crunch, echo phrase
//   20-34 s dhol / lezim groove (128.6 BPM, cut accents)   34-47 s gentler drone + pulse + flute
//   47-55 s big drum hit + tutari swell + groove 55-57 s tutari call + drum hit, bhandara shimmer
// If assets/vo/*.wav exists it is mixed at full level and the music is ducked under every VO span (timeline.js).
(function () {
  'use strict';
  const TL = window.TIMELINE;
  const DUR = TL.DURATION;
  let voBytes = null;

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  async function init() {
    try {
      const m = await (await fetch('/__assets.json')).json();
      const f = (m.vo || []).find(p => /vo\.wav$/i.test(p)) || (m.vo || [])[0];
      if (f) { voBytes = await (await fetch('/' + f)).arrayBuffer(); console.log('voice-over found: ' + f); }
    } catch (e) { console.warn('no VO loaded: ' + e.message); }
  }

  async function build(sr) {
    const ac = new OfflineAudioContext(2, Math.round(sr * DUR), sr);
    const R = rng(2024);
    // ---------------------------------------------------------------- buses
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    const master = ac.createGain(); master.gain.value = 0.9;
    comp.connect(master).connect(ac.destination);
    const music = ac.createGain(); music.connect(comp);
    const sfx = ac.createGain(); sfx.connect(comp);
    // reverb (seeded exponential-decay impulse)
    const ir = ac.createBuffer(2, sr * 2.6, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c), r = rng(10 + c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const verb = ac.createConvolver(); verb.buffer = ir;
    const verbOut = ac.createGain(); verbOut.gain.value = 0.35; verb.connect(verbOut).connect(music);
    // noise source buffer
    const nb = ac.createBuffer(1, sr * 3, sr);
    { const d = nb.getChannelData(0), r = rng(7); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }

    // ---------------------------------------------------------------- primitives
    function pan(dest, p) { if (!p) return dest; const n = ac.createStereoPanner(); n.pan.value = p; n.connect(dest); return n; }
    function env(g, t, a, peak, d, sustain) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      if (sustain) { g.gain.setValueAtTime(peak, t + a + sustain); }
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + (sustain || 0) + d);
    }
    function noise(t, dur, o) {
      o = o || {};
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f || 2000; f.Q.value = o.q || 1;
      if (o.fEnd) { f.frequency.setValueAtTime(o.f, t); f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur); }
      const g = ac.createGain();
      env(g, t, o.a || 0.002, o.gain || 0.3, Math.max(0.01, dur - (o.a || 0.002)));
      s.connect(f).connect(g).connect(pan(o.dest || sfx, o.pan));
      if (o.send) g.connect(verb);
      s.start(t, R() * 2.5); s.stop(t + dur + 0.05);
    }
    function tone(t, dur, freq, o) {
      o = o || {};
      const s = ac.createOscillator(); s.type = o.type || 'sine';
      s.frequency.setValueAtTime(o.fStart || freq, t);
      if (o.fStart) s.frequency.exponentialRampToValueAtTime(freq, t + (o.glide || 0.05));
      if (o.fEnd) s.frequency.exponentialRampToValueAtTime(o.fEnd, t + (o.drop || dur));
      if (o.detune) s.detune.value = o.detune;
      const g = ac.createGain();
      env(g, t, o.a || 0.005, o.gain || 0.2, Math.max(0.02, dur - (o.a || 0.005) - (o.sus || 0)), o.sus);
      let node = s;
      if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.lpq || 0.7; s.connect(f); node = f; }
      node.connect(g).connect(pan(o.dest || music, o.pan));
      if (o.send) { const sg = ac.createGain(); sg.gain.value = o.send; g.connect(sg).connect(verb); }
      s.start(t); s.stop(t + dur + 0.05);
      return s;
    }

    // ---------------------------------------------------------------- sound design
    function crunch(t, amt) {
      amt = amt || 1;
      const n = 9 + Math.floor(R() * 5);
      for (let i = 0; i < n; i++) {
        const tt = t + Math.pow(R(), 1.6) * 0.2;
        noise(tt, 0.015 + R() * 0.045, { f: 1400 + R() * 4200, q: 0.8 + R() * 2, gain: (0.25 + R() * 0.45) * amt, pan: (R() - 0.5) * 0.5 });
      }
      for (let i = 0; i < 14; i++) noise(t + R() * 0.25, 0.006, { type: 'highpass', f: 5000, gain: 0.2 * amt * R() });
      tone(t, 0.12, 70, { fStart: 160, glide: 0.03, gain: 0.5 * amt, dest: sfx });
    }
    function whoosh(t, len, amt) {
      len = len || 0.45; amt = amt || 1;
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3200, t + len * 0.6); f.frequency.exponentialRampToValueAtTime(900, t + len);
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 * amt, t + len * 0.6); g.gain.linearRampToValueAtTime(0, t + len);
      const p = ac.createStereoPanner(); p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + len);
      s.connect(f).connect(g).connect(p).connect(sfx);
      s.start(t, R() * 2); s.stop(t + len + 0.05);
    }
    function rip(t) {
      noise(t, 0.35, { f: 700, fEnd: 3500, q: 3, gain: 0.45 });
      for (let i = 0; i < 18; i++) noise(t + i * 0.018, 0.012, { f: 2500 + R() * 2000, q: 2, gain: 0.25 });
    }
    function dagga(t, amt) { // dhol bass side
      amt = amt == null ? 1 : amt;
      tone(t, 0.42, 52, { fStart: 150, glide: 0.09, gain: 0.75 * amt, dest: music });
      noise(t, 0.06, { type: 'lowpass', f: 500, gain: 0.25 * amt, dest: music });
    }
    function tilli(t, amt) { // dhol treble crack
      amt = amt == null ? 1 : amt;
      noise(t, 0.07, { f: 1900, q: 1.6, gain: 0.35 * amt, dest: music, pan: 0.15 });
      tone(t, 0.09, 380, { fStart: 520, glide: 0.02, gain: 0.18 * amt, dest: music, pan: 0.15 });
    }
    function jingle(t, amt) { // lezim jingles
      amt = amt == null ? 1 : amt;
      noise(t, 0.06, { type: 'highpass', f: 6500, gain: 0.12 * amt, dest: music, pan: -0.3 });
      for (const f of [3150, 4720, 6080]) tone(t, 0.16, f, { gain: 0.025 * amt, dest: music, pan: -0.3 });
    }
    function boom(t, amt) {
      amt = amt || 1;
      tone(t, 1.6, 34, { fStart: 95, glide: 0.25, gain: 0.95 * amt, dest: sfx });
      noise(t, 0.5, { type: 'lowpass', f: 900, gain: 0.45 * amt, send: true });
      noise(t, 1.4, { type: 'highpass', f: 4000, gain: 0.12 * amt, send: true }); // crash shimmer
    }
    function tutari(t, dur, freq, amt) { // long brass horn: sawtooth through formant filters, pitch rises into the note
      amt = amt || 1;
      const s = ac.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(freq * 0.75, t); s.frequency.exponentialRampToValueAtTime(freq, t + 0.35);
      const vib = ac.createOscillator(); vib.frequency.value = 5.2; const vg = ac.createGain(); vg.gain.value = freq * 0.008; vib.connect(vg).connect(s.frequency);
      const s2 = ac.createOscillator(); s2.type = 'sawtooth'; s2.detune.value = 9;
      s2.frequency.setValueAtTime(freq * 0.75, t); s2.frequency.exponentialRampToValueAtTime(freq, t + 0.38);
      const mix = ac.createGain(); mix.gain.value = 0.5; s.connect(mix); s2.connect(mix);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * amt, t + 0.3); g.gain.linearRampToValueAtTime(0.22 * amt, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
      for (const [f, q, gg] of [[750, 4, 1], [1250, 5, 0.7], [2600, 6, 0.35]]) {
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const fg = ac.createGain(); fg.gain.value = gg; mix.connect(bp).connect(fg).connect(g);
      }
      g.connect(music); const sg = ac.createGain(); sg.gain.value = 0.6; g.connect(sg).connect(verb);
      for (const o of [s, s2, vib]) { o.start(t); o.stop(t + dur + 0.05); }
    }
    function drone(t0, t1, root, level, bright) { // harmonium-like reed drone: Sa + Pa + upper Sa
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 1.2); g.gain.setValueAtTime(level, t1 - 1.0); g.gain.linearRampToValueAtTime(0, t1);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright || 1100; lp.Q.value = 0.6;
      const trem = ac.createOscillator(); trem.frequency.value = 4.6; const tg = ac.createGain(); tg.gain.value = level * 0.12; trem.connect(tg).connect(g.gain);
      lp.connect(g).connect(music); const sg = ac.createGain(); sg.gain.value = 0.4; g.connect(sg).connect(verb);
      for (const [f, d, a] of [[root, -6, 1], [root, 7, 0.8], [root * 1.5, 3, 0.55], [root * 2, -4, 0.35]]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        const og = ac.createGain(); og.gain.value = a * 0.25; o.connect(og).connect(lp);
        o.start(t0); o.stop(t1 + 0.05);
      }
      trem.start(t0); trem.stop(t1 + 0.05);
    }
    function flute(t, dur, f, amt) { // bansuri: sine + soft 2nd harmonic + breath, delayed vibrato, meend glide in
      amt = amt || 1;
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2 * 0.97, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.09);
      const vib = ac.createOscillator(); vib.frequency.value = 5.3;
      const vg = ac.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.009, t + Math.min(dur, 0.5));
      vib.connect(vg); vg.connect(o.frequency);
      const g = ac.createGain();
      const peak = 0.17 * amt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.07); g.gain.linearRampToValueAtTime(peak * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur + 0.12);
      const g2 = ac.createGain(); g2.gain.value = 0.12;
      o.connect(g); o2.connect(g2).connect(g);
      g.connect(pan(music, -0.1)); const sg = ac.createGain(); sg.gain.value = 0.9; g.connect(sg).connect(verb);
      noise(t, Math.min(0.25, dur), { f: 2200, q: 0.8, gain: 0.03 * amt, dest: music, send: true });
      for (const n of [o, o2, vib]) { n.start(t); n.stop(t + dur + 0.2); }
    }
    function rain(t0, t1, level) {
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.4); g.gain.setValueAtTime(level, t1 - 0.5); g.gain.linearRampToValueAtTime(0, t1);
      s.connect(hp).connect(lp).connect(g).connect(sfx); s.start(t0); s.stop(t1 + 0.05);
      for (let t = t0; t < t1; t += 0.03 + R() * 0.08) noise(t, 0.01, { type: 'highpass', f: 3000 + R() * 3000, gain: level * (0.6 + R()), pan: R() * 1.6 - 0.8 });
    }

    // ---------------------------------------------------------------- cue sheet
    // 0-3 hook: dark low hum + crunches
    tone(0.1, 2.9, 55, { gain: 0.05, lp: 200, a: 0.8, dest: music });
    for (const c of [0.75, 1.45, 2.15]) crunch(c, 1);
    whoosh(2.75, 0.5, 0.9);
    // 3-8 city
    rain(3.0, 8.4, 0.05);
    const D = 146.83; // Sa = D3
    drone(3.2, 15.2, D, 0.11, 900);
    const N = { A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, F5: 739.99, A5: 880, B5: 987.77, D6: 1174.66 };
    const phrase = (t, seq, amt) => { let x = t; for (const [n, d] of seq) { if (n) flute(x, d * 0.95, N[n], amt); x += d; } return x; };
    phrase(3.5, [['A4', 0.55], ['B4', 0.35], ['D5', 1.3], [null, 0.2], ['E5', 0.45], ['F5', 0.45], ['E5', 0.35], ['D5', 1.5]]);
    // 8-15 flashback (warmer, more ornamented)
    whoosh(7.7, 0.8, 0.6);
    for (let i = 0; i < 6; i++) tone(7.9 + i * 0.07, 1.2, [1174.66, 1318.5, 1480, 1760, 1975.5, 2349.3][i], { gain: 0.03, send: 0.8, dest: music }); // memory chime
    phrase(8.7, [['A5', 0.8], ['F5', 0.35], ['E5', 0.35], ['F5', 0.45], ['A5', 0.45], ['B5', 1.3], [null, 0.3], ['A5', 0.4], ['F5', 0.4], ['E5', 0.55], ['D5', 1.7]]);
    tone(9.2, 0.5, 900, { gain: 0.04, dest: sfx }); // dabba lid clink
    noise(9.2, 0.3, { type: 'highpass', f: 4000, gain: 0.08 });
    for (let i = 0; i < 4; i++) noise(10.4 + i * 0.13, 0.05, { type: 'lowpass', f: 700, gain: 0.12 }); // kid footsteps
    noise(11.55, 0.25, { f: 2500, q: 1, gain: 0.15 }); // handful rustle
    for (let i = 0; i < 5; i++) noise(12.4 + i * 0.12, 0.05, { type: 'lowpass', f: 700, gain: 0.1 });
    // 15-20 present
    noise(14.8, 0.25, { type: 'highpass', f: 2000, gain: 0.15, send: true });
    rain(15.0, 16.8, 0.02);
    drone(15.0, 20.0, D, 0.07, 1300);
    whoosh(15.45, 0.7, 0.8); // toss
    noise(16.15, 0.08, { type: 'lowpass', f: 900, gain: 0.25 }); // catch
    rip(16.85);
    crunch(17.72, 1.1);
    for (let i = 0; i < 5; i++) crunch(17.95 + i * 0.22, 0.35);
    phrase(17.8, [['B5', 0.55], ['A5', 0.55], ['F5', 1.1]], 0.7);
    boom(18.8, 0.7);
    // dhol roll build-up into the montage
    for (let i = 0; i < 12; i++) tilli(19.2 + i * (0.8 / 12), 0.25 + i * 0.06);
    whoosh(19.6, 0.4, 0.8);
    // 20-34 montage groove
    const B = TL.BEAT, E8 = B / 2;
    for (let t = 20, k = 0; t < 34 - 0.01; t += E8, k++) {
      const pos = k % 8;
      if (pos === 0 || pos === 3 || pos === 5 || pos === 6) dagga(t, pos === 0 ? 1 : 0.75);
      if (pos === 2 || pos === 4 || pos === 7) tilli(t, pos === 4 ? 1 : 0.7);
      jingle(t, pos % 2 ? 0.6 : 1);
      if (pos === 0 || pos === 4) tone(t, B * 1.8, pos === 0 ? 73.42 : 110, { type: 'sawtooth', lp: 500, gain: 0.12, dest: music }); // bass pulse D2 / A2
    }
    for (let i = 0; i < 6; i++) {
      const tc = TL.MONTAGE.start + i * TL.MONTAGE.cut;
      if (i > 0) whoosh(tc - 0.2, 0.3, 0.7);
      noise(tc, 0.6, { type: 'highpass', f: 5000, gain: 0.12, send: true }); // cut accent shimmer
      dagga(tc, 1.1);
    }
    // a little shehnai-like riff on top of the groove
    for (let i = 0; i < 6; i++) {
      const tc = TL.MONTAGE.start + i * TL.MONTAGE.cut + B;
      flute(tc, B * 0.9, i % 2 ? N.A5 : N.F5, 0.55); flute(tc + B, B * 0.9, N.E5, 0.5); flute(tc + 2 * B, B * 1.8, i % 2 ? N.F5 : N.D5, 0.5);
    }
    // 34-41 ingredients: gentler pulse
    whoosh(33.85, 0.35, 0.8);
    drone(34.0, 47.2, D, 0.08, 1000);
    for (let t = 34.2, k = 0; t < 46.8; t += B, k++) {
      if (k % 4 === 0) dagga(t, 0.4);
      if (k % 4 === 2) tilli(t, 0.35);
      jingle(t, 0.3);
    }
    for (let i = 0; i < 6; i++) tone(34.3 + i * 0.55 + 0.25, 0.25, 1400 + i * 120, { gain: 0.05, send: 0.5, dest: music }); // bowl pop ticks
    phrase(34.6, [['D5', 0.6], ['E5', 0.6], ['F5', 0.9], ['A5', 0.9], ['F5', 0.6], ['E5', 1.2], [null, 0.5], ['D5', 0.6], ['E5', 0.6], ['D5', 1.2]], 0.7);
    // 41-47 family
    phrase(41.6, [['A4', 0.5], ['D5', 0.5], ['E5', 0.5], ['F5', 1.0], ['E5', 0.5], ['D5', 0.5], ['B4', 0.5], ['D5', 1.5]], 0.8);
    // 47-55 hero
    boom(47.0, 1);
    tutari(47.05, 1.9, 293.66, 1);
    tutari(47.05, 1.9, 440, 0.6);
    for (let t = 48.0, k = 0; t < 54.9; t += E8, k++) {
      const pos = k % 8;
      if (pos === 0 || pos === 3 || pos === 5) dagga(t, 0.7);
      if (pos === 2 || pos === 6) tilli(t, 0.6);
      if (pos % 2 === 0) jingle(t, 0.6);
    }
    drone(48.0, 55.2, D, 0.06, 1400);
    noise(51.0, 0.6, { type: 'highpass', f: 5000, gain: 0.12, send: true }); // price reveal sparkle
    tone(51.5, 0.6, 1760, { gain: 0.06, send: 0.8 }); tone(51.6, 0.8, 2349.3, { gain: 0.05, send: 0.8 });
    tutari(51.9, 1.4, 440, 0.7);
    // 55-57 end card
    whoosh(54.7, 0.35, 0.8);
    boom(55.0, 1.1);
    tutari(55.02, 1.9, 293.66, 1.1);
    tutari(55.02, 1.9, 587.33, 0.5);
    for (let i = 0; i < 30; i++) tone(55.05 + R() * 1.2, 0.4, 2000 + R() * 3000, { gain: 0.02, send: 0.9 }); // bhandara shimmer

    // ---------------------------------------------------------------- voice-over + ducking
    if (voBytes) {
      const vb = await ac.decodeAudioData(voBytes.slice(0));
      const s = ac.createBufferSource(); s.buffer = vb;
      const vg = ac.createGain(); vg.gain.value = 1.0;
      s.connect(vg).connect(comp); s.start(0);
      const duck = 0.35;
      music.gain.setValueAtTime(1, 0);
      // merge spans that touch or nearly touch (gap < pre-roll + release) so automation events never interleave
      const PRE = 0.15, REL = 0.25, spans = [];
      for (const sp of TL.SUBS.slice().sort((a, b) => a.start - b.start)) {
        const last = spans[spans.length - 1];
        if (last && sp.start - PRE <= last.end + REL) last.end = Math.max(last.end, sp.end);
        else spans.push({ start: sp.start, end: sp.end });
      }
      for (const sp of spans) {
        music.gain.setValueAtTime(1, Math.max(0, sp.start - PRE));
        music.gain.linearRampToValueAtTime(duck, sp.start);
        music.gain.setValueAtTime(duck, sp.end);
        music.gain.linearRampToValueAtTime(1, sp.end + REL);
      }
    }
    // final fade
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR);

    const out = await ac.startRendering();
    // master normalisation: peak to -1 dBFS (guarantees no clipping)
    let peak = 0;
    for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; } }
    const target = Math.pow(10, -1 / 20);
    const gain = peak > 0 ? target / peak : 1;
    for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= gain; }
    let peak2 = 0;
    for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) peak2 = Math.max(peak2, Math.abs(d[i])); }
    const peakDb = 20 * Math.log10(peak2);
    if (!(peakDb <= -0.5)) throw new Error('soundtrack peak too high: ' + peakDb.toFixed(2) + ' dBFS');
    window.__audioInfo = { rawPeak: peak, peakDb, vo: !!voBytes };
    console.warn(`soundtrack: peak ${peakDb.toFixed(2)} dBFS (normalised by ${(20 * Math.log10(gain)).toFixed(1)} dB), VO ${voBytes ? 'mixed' : 'absent'}`);
    return out;
  }

  window.ReelAudio = { init, build };
})();
