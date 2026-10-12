/*
 * encoder.js - in-page frame loop + WebCodecs encoding.
 * Expects window.REEL = { duration (s), fps, draw(ctx, t), buildAudio(sampleRate) -> Promise<AudioBuffer> }.
 * Encoded chunks are streamed to Node through the exposed functions __sendChunks / __sendWav.
 */
(function () {
  'use strict';
  const W = 1080, H = 1920;
  const VIDEO_CODEC = 'avc1.640028'; // H.264 High@4.0 (supported by this Chromium; Baseline is not)

  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const canvas = () => document.getElementById('c');
  const toU8 = d => (d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength)).slice();

  window.renderStill = async function (t) {
    const c = canvas();
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    window.REEL.draw(ctx, t);
    return c.toDataURL('image/png');
  };

  async function encodeVideo(R) {
    const c = canvas();
    const ctx = c.getContext('2d', { willReadFrequently: false });
    const fps = R.fps || 30;
    const n = Math.round(R.duration * fps);
    let avcC = null, err = null, batch = [], pending = Promise.resolve();
    const flush = () => {
      if (!batch.length) return pending;
      const b = batch; batch = [];
      pending = pending.then(() => window.__sendChunks('video', b));
      return pending;
    };
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = toU8(meta.decoderConfig.description);
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        batch.push({ data: b64(buf), ts: chunk.timestamp, dur: chunk.duration || Math.round(1e6 / fps), key: chunk.type === 'key' });
      },
      error: e => { err = e; },
    });
    const cfg = { codec: VIDEO_CODEC, width: W, height: H, bitrate: R.bitrate || 10_000_000, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
    const sup = await VideoEncoder.isConfigSupported(cfg);
    if (!sup.supported) throw new Error('VideoEncoder config not supported: ' + JSON.stringify(cfg));
    enc.configure(cfg);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      if (err) throw err;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      R.draw(ctx, i / fps);
      const frame = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (batch.length >= 30) await flush();
      if (i % 15 === 0 && window.__progress) {
        const el = (performance.now() - t0) / 1000;
        window.__progress(`video frame ${i + 1}/${n}  ${((i + 1) / el).toFixed(1)} fps`);
      }
    }
    await enc.flush();
    if (err) throw err;
    await flush();
    enc.close();
    if (!avcC) throw new Error('encoder produced no avcC description');
    return { avcC: b64(avcC), frames: n, fps };
  }

  async function encodeAudio(R) {
    if (!R.buildAudio) return null;
    const sr = 48000;
    const buf = await R.buildAudio(sr);
    const ch = buf.numberOfChannels, len = buf.length;
    const L = buf.getChannelData(0), Rr = ch > 1 ? buf.getChannelData(1) : L;
    // WAV copy (16-bit PCM interleaved), streamed in parts
    const part = sr * 5;
    for (let s = 0; s < len; s += part) {
      const e = Math.min(len, s + part);
      const pcm = new Int16Array((e - s) * 2);
      for (let i = s, k = 0; i < e; i++) {
        pcm[k++] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767)));
        pcm[k++] = Math.max(-32768, Math.min(32767, Math.round(Rr[i] * 32767)));
      }
      await window.__sendWav(b64(new Uint8Array(pcm.buffer)), e >= len ? { sampleRate: sr, channels: 2 } : null);
    }
    // Opus encode
    let preSkip = 312, err = null, batch = [];
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        const d = meta && meta.decoderConfig && meta.decoderConfig.description;
        if (d) {
          const u = toU8(d);
          if (u.length >= 12 && String.fromCharCode(...u.subarray(0, 8)) === 'OpusHead') preSkip = u[10] | (u[11] << 8);
        }
        const b = new Uint8Array(chunk.byteLength);
        chunk.copyTo(b);
        batch.push({ data: b64(b), ts: chunk.timestamp, dur: chunk.duration || 20000 });
      },
      error: e => { err = e; },
    });
    enc.configure({ codec: 'opus', sampleRate: sr, numberOfChannels: 2, bitrate: 160000 });
    const F = 960 * 10;
    for (let s = 0; s < len; s += F) {
      const n = Math.min(F, len - s);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(s, s + n), 0);
      data.set(Rr.subarray(s, s + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(s * 1e6 / sr), data });
      enc.encode(ad);
      ad.close();
      if (err) throw err;
      if (batch.length > 200) { const b = batch; batch = []; await window.__sendChunks('audio', b); }
    }
    await enc.flush();
    if (err) throw err;
    if (batch.length) await window.__sendChunks('audio', batch);
    enc.close();
    return { sampleRate: sr, channels: 2, preSkip, audioSamples: len };
  }

  window.encodeReel = async function () {
    const R = window.REEL;
    const a = await encodeAudio(R);
    const v = await encodeVideo(R);
    return Object.assign({ width: W, height: H, videoCodec: VIDEO_CODEC, duration: R.duration, textBackend: window.Text.backend },
      v, a || {});
  };
})();
