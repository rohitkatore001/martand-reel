/*
 * text.js - single text API used by every scene. Two interchangeable backends:
 *   1. 'font'   : a real Devanagari font dropped into assets/fonts/ (.ttf/.otf/.woff/.woff2).
 *                 Loaded with FontFace; Chromium shapes it with HarfBuzz via ctx.fillText.
 *   2. 'vector' : the built-in stroke glyph engine (deva.js), used when no font is present.
 * Call `await Text.init()` once before drawing. Same API either way:
 *   Text.draw(ctx, text, x, y, size, {fill, stroke, strokeWidth, align, baseline, weight})
 *   Text.measure(text, size) / Text.wrap(text, size, maxWidth) / Text.lineHeight(size)
 * Coordinates follow deva.js: baseline 'headline' (default) puts y on the shirorekha,
 * 'middle' centres the letter body on y, 'bottom' puts y on the letter baseline.
 */
(function (root) {
  'use strict';
  const Deva = root.Deva;
  const FAMILY = 'ReelDeva';
  // Approximate positions of the headline / baseline inside a typical Devanagari font em box
  // (Noto Sans Devanagari, Mukta, Baloo 2 are all close to these).
  // F.headline is the fraction of the em between headline and baseline subtracted from 1, so the
  // body height (0.58 em) matches the vector engine's 0.56 * size.
  const F = { headline: 0.42, baseline: 1.0, scale: 0.95 };
  let fontCtx = null;

  const Text = {
    backend: 'vector',
    fontFile: null,
    async init(manifestUrl) {
      let fonts = [];
      try {
        const r = await fetch(manifestUrl || '/__assets.json');
        if (r.ok) fonts = (await r.json()).fonts || [];
      } catch (e) { /* no manifest: stay on the vector engine */ }
      if (fonts.length) {
        try {
          const face = new FontFace(FAMILY, `url(/${fonts[0]})`, { weight: '100 900' });
          await face.load();
          document.fonts.add(face);
          Text.backend = 'font';
          Text.fontFile = fonts[0];
        } catch (e) {
          console.warn('font load failed, using vector Devanagari engine: ' + e.message);
        }
      }
      return Text.backend;
    },
    _font(size, weight) {
      const w = weight && weight < 1 ? 500 : 800;
      return `${w} ${(size * F.scale).toFixed(2)}px "${FAMILY}", "Noto Sans", sans-serif`;
    },
    _mctx() {
      if (!fontCtx) fontCtx = new OffscreenCanvas(8, 8).getContext('2d');
      return fontCtx;
    },
    measure(text, size, opts) {
      if (Text.backend === 'vector') return Deva.measure(text, size, opts);
      const c = Text._mctx();
      c.font = Text._font(size, opts && opts.weight);
      return c.measureText(text).width;
    },
    draw(ctx, text, x, y, size, opts) {
      opts = opts || {};
      if (Text.backend === 'vector') return Deva.draw(ctx, text, x, y, size, opts);
      const em = size * F.scale;
      const base = opts.baseline || 'headline';
      // convert our anchor to the alphabetic baseline of the real font
      const bodyH = (F.baseline - F.headline) * em;
      const yb = base === 'middle' ? y + bodyH / 2 : base === 'bottom' ? y : y + bodyH;
      ctx.save();
      ctx.font = Text._font(size, opts.weight);
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      if (opts.stroke && opts.strokeWidth) {
        ctx.lineWidth = opts.strokeWidth * 2;
        ctx.strokeStyle = opts.stroke;
        ctx.strokeText(text, x, yb);
      }
      ctx.fillStyle = opts.fill || '#000';
      ctx.fillText(text, x, yb);
      const w = ctx.measureText(text).width;
      ctx.restore();
      return w;
    },
    wrap(text, size, maxWidth, opts) {
      const words = text.split(/\s+/).filter(Boolean);
      const lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (!cur || Text.measure(t, size, opts) <= maxWidth) cur = t;
        else { lines.push(cur); cur = w; }
      }
      if (cur) lines.push(cur);
      return lines;
    },
    lineHeight(size) { return Deva.lineHeight(size); },
    // draw wrapped, centred block; returns total height
    drawBlock(ctx, text, cx, yTop, size, maxWidth, opts) {
      const lines = Text.wrap(text, size, maxWidth, opts);
      const lh = Text.lineHeight(size);
      lines.forEach((l, i) => Text.draw(ctx, l, cx, yTop + i * lh, size, Object.assign({}, opts, { align: 'center' })));
      return lines.length * lh;
    },
  };
  root.Text = Text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
