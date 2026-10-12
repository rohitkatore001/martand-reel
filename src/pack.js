// pack.js - vector recreation of the मार्तंड फरसाण 500 g pouch (window.Pack).
// Pack.drawPack(ctx, x, y, h, {rotation, torn, openAmount, shine}) draws the pouch centred at (x, y), h px tall.
// If assets/photos/pack_front.(jpg|jpeg|png|webp) exists, Pack.init() loads it and the photo is used instead
// (cover-fit into the same pouch outline, same transform), so a real photo drops in without code changes.
(function (root) {
  'use strict';
  const A = root.Art, T = root.Text, S = root.REEL_STRINGS;
  const PW = 680, PH = 1000; // sprite design size
  const ASPECT = PW / PH;
  const TEAR_Y = 88; // tear notch line in sprite units
  let sprite = null, photo = null;

  function outline(g, w, h) {
    // pouch: straight sides, rounded shoulders, slight bulge
    g.beginPath();
    g.moveTo(20, 0); g.lineTo(w - 20, 0);
    g.quadraticCurveTo(w, 0, w, 30);
    g.bezierCurveTo(w + 8, h * 0.35, w + 8, h * 0.7, w - 4, h - 26);
    g.quadraticCurveTo(w - 6, h, w - 30, h);
    g.lineTo(30, h);
    g.quadraticCurveTo(6, h, 4, h - 26);
    g.bezierCurveTo(-8, h * 0.7, -8, h * 0.35, 0, 30);
    g.quadraticCurveTo(0, 0, 20, 0);
    g.closePath();
  }

  function drawVector(g) {
    const w = PW, h = PH;
    g.save();
    outline(g, w, h); g.clip();
    // off-white body
    const bg = g.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#efe6d2'); bg.addColorStop(0.5, '#fbf7ee'); bg.addColorStop(1, '#e8dec8');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // faint repeating pattern (small paisley dots and flowers)
    g.save(); g.globalAlpha = 0.16; g.strokeStyle = '#b48a4a'; g.fillStyle = '#b48a4a'; g.lineWidth = 2;
    for (let yy = 30; yy < h; yy += 70) for (let xx = (yy / 70) % 2 ? 20 : 55; xx < w; xx += 70) {
      g.beginPath(); g.arc(xx, yy, 12, 0, A.TAU); g.stroke();
      for (let k = 0; k < 6; k++) { const a = k * A.TAU / 6; g.beginPath(); g.arc(xx + Math.cos(a) * 18, yy + Math.sin(a) * 18, 3, 0, A.TAU); g.fill(); }
    }
    g.restore();
    // top crimp
    g.fillStyle = '#e2d6bc'; g.fillRect(0, 0, w, 60);
    g.strokeStyle = 'rgba(120,90,50,0.25)'; g.lineWidth = 2;
    for (let xx = 8; xx < w; xx += 9) { g.beginPath(); g.moveTo(xx, 4); g.lineTo(xx, 56); g.stroke(); }
    // tear notch marks
    g.fillStyle = 'rgba(90,60,30,0.5)';
    g.beginPath(); g.moveTo(0, TEAR_Y - 8); g.lineTo(14, TEAR_Y); g.lineTo(0, TEAR_Y + 8); g.fill();
    g.beginPath(); g.moveTo(w, TEAR_Y - 8); g.lineTo(w - 14, TEAR_Y); g.lineTo(w, TEAR_Y + 8); g.fill();
    // maroon badge with white मार्तंड
    const bw = 420, bh = 150, bx = (w - bw) / 2, by = 110;
    g.save();
    g.shadowColor = 'rgba(60,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    const rg = g.createLinearGradient(0, by, 0, by + bh);
    rg.addColorStop(0, '#c4161c'); rg.addColorStop(1, '#7e0d12');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(bx + 30, by); g.lineTo(bx + bw - 30, by); g.quadraticCurveTo(bx + bw + 25, by + bh / 2, bx + bw - 30, by + bh);
    g.lineTo(bx + 30, by + bh); g.quadraticCurveTo(bx - 25, by + bh / 2, bx + 30, by); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = '#f2c14e'; g.lineWidth = 5;
    g.beginPath();
    g.moveTo(bx + 38, by + 10); g.lineTo(bx + bw - 38, by + 10); g.quadraticCurveTo(bx + bw + 8, by + bh / 2, bx + bw - 38, by + bh - 10);
    g.lineTo(bx + 38, by + bh - 10); g.quadraticCurveTo(bx - 8, by + bh / 2, bx + 38, by + 10); g.closePath(); g.stroke();
    let sz = 104;
    while (T.measure(S.brand, sz) > bw - 90) sz -= 4;
    T.draw(g, S.brand, w / 2, by + bh / 2 + 6, sz, { fill: '#ffffff', align: 'center', baseline: 'middle' });
    // फरसाण big brown title
    sz = 190;
    while (T.measure(S.product, sz) > w - 70) sz -= 5;
    T.draw(g, S.product, w / 2, 330, sz, { fill: '#6b3410', stroke: '#f6e6c6', strokeWidth: 8, align: 'center' });
    T.draw(g, S.product, w / 2, 330, sz, { fill: '#7a3c12', align: 'center' });
    // tagline
    sz = 56;
    while (T.measure(S.tagline, sz) > w - 90) sz -= 2;
    T.draw(g, S.tagline, w / 2, 488, sz, { fill: '#9b1418', align: 'center' });
    // pot with farsan
    A.clayPot(g, w / 2, 690, 165, { seed: 31 });
    // spilled farsan around the pot
    const r = A.rng(4);
    for (let i = 0; i < 60; i++) { const side = i % 2 ? 1 : -1; A.granule(g, ['sev', 'boondi', 'peanut', 'dal'][i % 4], w / 2 + side * (150 + r() * 150), 935 - r() * 70 + 0, 12, r() * A.TAU, r); }
    // copper bottom band
    const cb = g.createLinearGradient(0, 860, 0, h);
    cb.addColorStop(0, '#d79a5c'); cb.addColorStop(0.18, '#a5602c'); cb.addColorStop(0.45, '#e2b07a'); cb.addColorStop(0.7, '#8a4a1e'); cb.addColorStop(1, '#5e2e10');
    g.fillStyle = cb;
    g.beginPath(); g.moveTo(0, 880); g.quadraticCurveTo(w / 2, 845, w, 880); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    T.draw(g, S.weight, 40, 922, 48, { fill: '#fff8ea', baseline: 'headline' });
    g.fillStyle = '#fff3dd'; g.font = '700 26px "Noto Sans"'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText('Net Wt. 500 g', w - 40, 965);
    // gloss
    const gl = g.createLinearGradient(0, 0, w, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.12, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.2, 'rgba(255,255,255,0)');
    gl.addColorStop(0.85, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h);
    g.restore();
    outline(g, w, h); g.strokeStyle = 'rgba(80,50,20,0.35)'; g.lineWidth = 3; g.stroke();
  }

  function drawPhoto(g) {
    const w = PW, h = PH;
    g.save(); outline(g, w, h); g.clip();
    const s = Math.max(w / photo.width, h / photo.height);
    g.drawImage(photo, (w - photo.width * s) / 2, (h - photo.height * s) / 2, photo.width * s, photo.height * s);
    g.restore();
  }

  function getSprite() {
    if (sprite) return sprite;
    const c = new OffscreenCanvas(PW, PH);
    const g = c.getContext('2d');
    if (photo) drawPhoto(g); else drawVector(g);
    sprite = c;
    return sprite;
  }

  async function init() {
    try {
      const m = await (await fetch('/__assets.json')).json();
      const f = (m.photos || []).find(p => /\/pack_front\.(jpe?g|png|webp)$/i.test(p));
      if (f) {
        const img = new Image();
        img.src = '/' + f;
        await img.decode();
        photo = img;
      }
    } catch (e) { console.warn('pack photo not loaded: ' + e.message); }
    sprite = null;
    getSprite();
    return photo ? 'photo' : 'vector';
  }

  // torn: 0..1 progress of the top strip flying off; shine: -1..2 position of a light sweep (null = none)
  function drawPack(ctx, x, y, h, opts) {
    opts = opts || {};
    const sp = getSprite();
    const k = h / PH, w = PW * k;
    ctx.save();
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.shadow !== false) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 50 * k * 1.5; ctx.shadowOffsetY = 25 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.translate(-w / 2, -h / 2); ctx.scale(k, k); outline(ctx, PW, PH); ctx.fill(); ctx.restore();
    }
    ctx.translate(-w / 2, -h / 2);
    ctx.scale(k, k);
    const torn = opts.torn || 0;
    if (torn <= 0) ctx.drawImage(sp, 0, 0);
    else {
      // body below the tear line with a jagged edge
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-10, TEAR_Y);
      for (let xx = 0; xx <= PW; xx += 20) ctx.lineTo(xx, TEAR_Y + ((xx / 20) % 2 ? 8 : -6));
      ctx.lineTo(PW + 10, PH + 10); ctx.lineTo(-10, PH + 10); ctx.closePath(); ctx.clip();
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
      // open mouth showing farsan
      const open = opts.openAmount == null ? A.clamp(torn * 2) : opts.openAmount;
      if (open > 0) {
        ctx.save();
        A.ellipse(ctx, PW / 2, TEAR_Y + 4, PW / 2 - 12, 40 * open, '#3a2210');
        ctx.beginPath(); ctx.ellipse(PW / 2, TEAR_Y + 4, PW / 2 - 16, 36 * open, 0, 0, A.TAU); ctx.clip();
        const fs = A.farsanSprite(PW - 40, 90, 51, { grain: 16 });
        ctx.drawImage(fs, 20, TEAR_Y - 60 * open);
        ctx.restore();
      }
      // top strip flying away
      if (torn < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - A.clamp((torn - 0.6) / 0.4);
        ctx.translate(PW * 0.8 + torn * 500, TEAR_Y - torn * 520);
        ctx.rotate(torn * 1.4);
        ctx.translate(-PW * 0.8, -TEAR_Y);
        ctx.beginPath(); ctx.rect(0, 0, PW, TEAR_Y + 4); ctx.clip();
        ctx.drawImage(sp, 0, 0);
        ctx.restore();
      }
    }
    if (opts.shine != null) {
      ctx.save(); outline(ctx, PW, PH); ctx.clip();
      const sx = opts.shine * PW * 1.6 - PW * 0.3;
      const g = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,240,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix().skewXSelf(-20)));
      ctx.fillStyle = g; ctx.fillRect(-PW, 0, PW * 3, PH);
      ctx.restore();
    }
    ctx.restore();
    return { w, h };
  }

  root.Pack = { init, drawPack, ASPECT, sprite: getSprite };
})(typeof globalThis !== 'undefined' ? globalThis : this);
