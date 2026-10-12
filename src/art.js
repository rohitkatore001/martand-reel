// art.js - reusable flat-vector illustration helpers for the reel (window.Art).
// Everything is deterministic: random values come from seeded generators, animation from t.
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ math / easing
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
  const easeIn = k => Math.pow(clamp(k), 3);
  const easeInOut = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const backOut = k => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const elastic = k => { k = clamp(k); if (k === 0 || k === 1) return k; return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (TAU / 3)) + 1; };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 4; ctx.stroke(); }
  }
  function circle(ctx, x, y, r, fill) { ellipse(ctx, x, y, r, r, fill); }
  function line(ctx, pts, color, lw, cap) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = cap || 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }
  function vgrad(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function vignette(ctx, strength, color) {
    const g = ctx.createRadialGradient(540, 960, 380, 540, 960, 1250);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color || `rgba(0,0,0,${strength == null ? 0.6 : strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  const caches = {};
  function cached(key, w, h, fn) {
    if (caches[key]) return caches[key];
    const c = new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
    fn(c.getContext('2d'), w, h);
    caches[key] = c;
    return c;
  }
  function grain(ctx, t, alpha) {
    const tile = cached('grain', 256, 256, (g) => {
      const im = g.createImageData(256, 256), r = rng(77);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = r() * 255;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    });
    const f = Math.floor(t * 24), r = rng(f + 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay';
    const ox = -Math.floor(r() * 256), oy = -Math.floor(r() * 256);
    for (let y = oy; y < 1920; y += 256) for (let x = ox; x < 1080; x += 256) ctx.drawImage(tile, x, y);
    ctx.restore();
  }

  // ------------------------------------------------------------------ farsan granules
  const FARSAN_COLORS = {
    sev: ['#e8a93a', '#f0b84a', '#d9922b', '#f4c35a'],
    boondi: ['#e07a1f', '#d4691a', '#eb8a2c'],
    peanut: ['#a8642e', '#b8733a', '#8f5326'],
    poha: ['#f6e0a0', '#efd38a', '#f9e8b8'],
    dal: ['#f2c230', '#e9b520', '#f6cf4c'],
    masoor: ['#e8743a', '#f08a4a', '#d9622c'],
    leaf: ['#3d6b2a', '#2f5a22'],
  };
  function granule(ctx, type, x, y, s, rot, r) {
    const pal = FARSAN_COLORS[type];
    const col = pal[Math.floor(r() * pal.length)];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    switch (type) {
      case 'sev': {
        const L = s * (2.2 + r() * 2.2), bend = (r() - 0.5) * s * 2;
        ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, bend, L / 2, 0);
        ctx.strokeStyle = col; ctx.lineWidth = s * 0.55; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,190,0.55)'; ctx.lineWidth = s * 0.16;
        ctx.beginPath(); ctx.moveTo(-L / 2.4, -s * 0.12); ctx.quadraticCurveTo(0, bend - s * 0.12, L / 2.4, -s * 0.12); ctx.stroke();
        break;
      }
      case 'boondi': {
        ellipse(ctx, 0, 0, s * 0.62, s * 0.58, col);
        ellipse(ctx, -s * 0.18, -s * 0.2, s * 0.18, s * 0.14, 'rgba(255,220,150,0.6)');
        break;
      }
      case 'peanut': {
        ellipse(ctx, 0, 0, s * 0.85, s * 0.55, col);
        ellipse(ctx, -s * 0.2, -s * 0.18, s * 0.35, s * 0.15, 'rgba(255,215,170,0.45)');
        break;
      }
      case 'poha': {
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.45, 0, 0, TAU);
        ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(180,140,60,0.35)'; ctx.lineWidth = s * 0.1; ctx.stroke();
        break;
      }
      case 'masoor':
      case 'dal': {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.55, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
        break;
      }
      case 'leaf': {
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.7, s, 0); ctx.quadraticCurveTo(0, s * 0.7, -s, 0);
        ctx.fillStyle = col; ctx.fill(); break;
      }
    }
    ctx.restore();
  }
  function pickType(r) {
    const v = r();
    return v < 0.42 ? 'sev' : v < 0.6 ? 'boondi' : v < 0.72 ? 'peanut' : v < 0.84 ? 'poha' : v < 0.97 ? 'dal' : 'leaf';
  }
  // A heap of farsan as a cached sprite. w x h box, mound shape (half ellipse) or 'flat' layer.
  function farsanSprite(w, h, seed, opts) {
    opts = opts || {};
    const gs = opts.grain || Math.max(6, w / 34);
    const key = `farsan:${w}:${h}:${seed}:${opts.shape || 'mound'}:${gs}`;
    return cached(key, w, h, (g) => {
      const r = rng(seed);
      const n = Math.round((w * h) / (gs * gs) * 0.9);
      const pts = [];
      for (let i = 0; i < n * 3 && pts.length < n; i++) {
        const u = r() * 2 - 1, v = r();
        const x = w / 2 + u * (w / 2 - gs);
        let top;
        if (opts.shape === 'flat') top = h * 0.15 + Math.sin(u * 9 + seed) * h * 0.06;
        else top = h - (h - gs) * Math.sqrt(Math.max(0, 1 - u * u)) * (0.92 + 0.08 * Math.sin(u * 13 + seed));
        const y = top + v * (h - top);
        if (y > h - gs * 0.5) continue;
        pts.push([x, y]);
      }
      pts.sort((a, b) => a[1] - b[1]);
      // dark base so gaps don't show the background
      g.save();
      g.beginPath();
      if (opts.shape === 'flat') { g.rect(gs, h * 0.22, w - 2 * gs, h * 0.78 - gs * 0.5); }
      else g.ellipse(w / 2, h, w / 2 - gs * 1.5, h - gs * 1.5, 0, Math.PI, TAU);
      g.fillStyle = '#b8701f'; g.fill(); g.restore();
      for (const [x, y] of pts) granule(g, pickType(r), x, y, gs * (0.8 + r() * 0.5), r() * TAU, r);
    });
  }
  // falling / flying granules: emitted continuously between t0 and t1 at (x +- spread, y0) falling to yEnd
  function sprinkle(ctx, t, t0, t1, x, spread, y0, yEnd, rate, seed, size) {
    if (t < t0) return;
    const r = rng(seed);
    const n = Math.floor((t1 - t0) * rate);
    for (let i = 0; i < n; i++) {
      const te = t0 + (i / rate) + r() * 0.05, dx = (r() - 0.5) * spread, rot0 = r() * TAU, sp = r() * 6 - 3, type = pickType(r), s = size * (0.8 + r() * 0.5);
      const seedG = Math.floor(r() * 1e6);
      const dt = t - te;
      if (dt < 0) continue;
      const y = y0 + 200 * dt + 0.5 * 2600 * dt * dt;
      if (y > yEnd) continue;
      granule(ctx, type, x + dx + dx * dt * 0.6, y, s, rot0 + sp * dt, rng(seedG));
    }
  }
  // burst of crumbs from (x,y) at time te
  function crumbs(ctx, t, te, x, y, n, seed, size, power) {
    const dt = t - te;
    if (dt < 0 || dt > 1.4) return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.7, v = (power || 900) * (0.35 + r() * 0.8);
      const type = pickType(r), s = size * (0.5 + r() * 0.8), rot = r() * TAU, sp = (r() - 0.5) * 20, seedG = Math.floor(r() * 1e6);
      const px = x + Math.cos(a) * v * dt, py = y + Math.sin(a) * v * dt + 0.5 * 2400 * dt * dt;
      ctx.globalAlpha = clamp(1.4 - dt);
      granule(ctx, type, px, py, s, rot + sp * dt, rng(seedG));
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ steam, tea
  function steam(ctx, x, y, s, t, alpha) {
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.6 + k / 3) % 1;
      ctx.globalAlpha = (alpha == null ? 0.55 : alpha) * Math.sin(ph * Math.PI);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9 * s;
      ctx.beginPath();
      const bx = x + (k - 1) * 28 * s, by = y - ph * 120 * s;
      for (let i = 0; i <= 12; i++) {
        const yy = by - i * 9 * s, xx = bx + Math.sin(i * 0.6 + t * 3 + k * 2) * 12 * s;
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // cutting-chai glass, bottom centre at (x, y), height 180*s
  function teaGlass(ctx, x, y, s, t, opts) {
    opts = opts || {};
    const h = 180 * s, wt = 62 * s, wb = 46 * s;
    ctx.save();
    ellipse(ctx, x, y + 4 * s, wb * 1.3, 10 * s, 'rgba(0,0,0,0.25)');
    ctx.beginPath(); ctx.moveTo(x - wt, y - h); ctx.lineTo(x + wt, y - h); ctx.lineTo(x + wb, y); ctx.lineTo(x - wb, y); ctx.closePath();
    ctx.fillStyle = 'rgba(230,240,245,0.35)'; ctx.fill();
    // tea
    const lvl = h * 0.82;
    const wl = wb + (wt - wb) * (lvl / h);
    ctx.beginPath(); ctx.moveTo(x - wl, y - lvl); ctx.lineTo(x + wl, y - lvl); ctx.lineTo(x + wb, y); ctx.lineTo(x - wb, y); ctx.closePath();
    const g = ctx.createLinearGradient(x - wt, 0, x + wt, 0);
    g.addColorStop(0, '#8a4f22'); g.addColorStop(0.5, '#c0783a'); g.addColorStop(1, '#7a421b');
    ctx.fillStyle = g; ctx.fill();
    ellipse(ctx, x, y - lvl, wl, 7 * s, '#d9a066');
    // ribs + highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3 * s;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 20 * s, y - h * 0.95); ctx.lineTo(x + i * 15 * s, y - 4 * s); ctx.stroke(); }
    line(ctx, [x - wt * 0.75, y - h * 0.9, x - wb * 0.7, y - h * 0.15], 'rgba(255,255,255,0.6)', 6 * s);
    ctx.beginPath(); ctx.moveTo(x - wt, y - h); ctx.lineTo(x + wt, y - h); ctx.lineTo(x + wb, y); ctx.lineTo(x - wb, y); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * s; ctx.stroke();
    ctx.restore();
    if (opts.steam !== false) steam(ctx, x, y - h - 10 * s, s, t);
  }
  // round cup with saucer, bottom centre (x,y)
  function teaCup(ctx, x, y, s, t) {
    ellipse(ctx, x, y, 120 * s, 24 * s, '#e9e4dc', '#c8c0b4', 4 * s);
    ctx.beginPath(); ctx.moveTo(x - 85 * s, y - 120 * s); ctx.bezierCurveTo(x - 85 * s, y - 10 * s, x + 85 * s, y - 10 * s, x + 85 * s, y - 120 * s); ctx.closePath();
    ctx.fillStyle = '#fbf8f2'; ctx.fill(); ctx.strokeStyle = '#d0c6b8'; ctx.lineWidth = 4 * s; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 98 * s, y - 85 * s, 26 * s, -1.3, 1.6); ctx.strokeStyle = '#fbf8f2'; ctx.lineWidth = 12 * s; ctx.stroke();
    ellipse(ctx, x, y - 120 * s, 85 * s, 16 * s, '#b86b30');
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 70 * s, y - 85 * s, 140 * s, 10 * s);
    steam(ctx, x, y - 140 * s, s, t);
  }

  // ------------------------------------------------------------------ rain / city
  function cityNight(ctx, x, y, w, h, t, seed) {
    vgrad(ctx, x, y, w, h, ['#1b2a4a', '#2c3f66', '#5a5f86', '#8a6f86']);
    const r = rng(seed || 5);
    const layers = [{ c: '#2a3556', hmin: 0.25, hmax: 0.55, lit: 0.25 }, { c: '#1a2240', hmin: 0.35, hmax: 0.8, lit: 0.35 }];
    layers.forEach((L, li) => {
      let bx = x - 20;
      while (bx < x + w) {
        const bw = 60 + r() * 110, bh = h * (L.hmin + r() * (L.hmax - L.hmin));
        ctx.fillStyle = L.c; ctx.fillRect(bx, y + h - bh, bw - 6, bh);
        for (let wy = y + h - bh + 16; wy < y + h - 12; wy += 26) {
          for (let wx = bx + 10; wx < bx + bw - 22; wx += 22) {
            const v = r();
            if (v < L.lit) {
              const tw = Math.sin(t * 2 + v * 50) > 0.97 ? 0.4 : 1;
              ctx.fillStyle = `rgba(255,${200 + Math.floor(r() * 40)},120,${0.75 * tw})`;
              ctx.fillRect(wx, wy, 10, 13);
            }
          }
        }
        bx += bw;
      }
      if (li === 0) { ctx.fillStyle = 'rgba(40,50,90,0.35)'; ctx.fillRect(x, y, w, h); }
    });
  }
  function rain(ctx, x, y, w, h, t, seed, density) {
    const r = rng(seed || 9);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // falling streaks
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const n = density || 160;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sx = x + r() * w, sp = 1400 + r() * 900, ph = r(), L = 30 + r() * 40;
      const yy = y + (((t * sp) / h + ph) % 1) * (h + 80) - 40;
      ctx.moveTo(sx, yy); ctx.lineTo(sx - 6, yy + L);
    }
    ctx.stroke();
    // droplets on glass sliding slowly
    for (let i = 0; i < 70; i++) {
      const dx = x + r() * w, sp = 10 + r() * 60, ph = r(), rad = 4 + r() * 9;
      const dy = y + ((ph * h + t * sp) % h);
      ctx.fillStyle = 'rgba(210,225,255,0.28)';
      ctx.beginPath(); ctx.ellipse(dx, dy, rad * 0.8, rad, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(dx - rad * 0.25, dy - rad * 0.35, rad * 0.25, 0, TAU); ctx.fill();
      if (sp > 45) { ctx.fillStyle = 'rgba(210,225,255,0.12)'; ctx.fillRect(dx - rad * 0.3, dy - 60, rad * 0.6, 60); }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ characters
  const SKIN = { light: '#e8b48c', mid: '#c98a5e', deep: '#a8693f' };
  // Flat-vector person. (x,y) = feet centre on the ground (sitting: seat centre), s = scale (adult ~1000*s tall).
  // spec: { kind: man|friend|aaji|kid|mom|dad, pose: stand|sit, t, facing (1 right / -1 left),
  //         eyes: open|closed|happy, mouth: smile|open|laugh|chew|o, armL/armR: [shoulderDeg, elbowDeg] (0 = straight down,
  //         positive = forward toward facing), bob (px), lean (rad), blinkSeed }
  // returns { handL:[x,y], handR:[x,y], head:[x,y] } in canvas coordinates.
  function person(ctx, x, y, s, spec) {
    const k = spec.kind || 'man';
    const f = spec.facing || 1;
    const t = spec.t || 0;
    const sit = spec.pose === 'sit';
    const P = {
      man: { skin: SKIN.mid, shirt: '#3c6e9e', pants: '#2d3442', hair: '#1d1410', h: 1 },
      friend: { skin: SKIN.deep, shirt: '#d9822b', pants: '#4a3b2c', hair: '#1b120c', h: 1, mous: true },
      dad: { skin: SKIN.mid, shirt: '#f2efe6', pants: '#f2efe6', hair: '#2b2622', h: 1, mous: true, kurta: true },
      mom: { skin: SKIN.light, shirt: '#b0283a', pants: '#b0283a', hair: '#1d1410', h: 0.95, saree: '#b0283a', border: '#e7b23a', bun: true, bindi: true },
      aaji: { skin: SKIN.mid, shirt: '#2f7a4a', pants: '#2f7a4a', hair: '#d9d6d0', h: 0.9, saree: '#2f7a4a', border: '#c9302c', bun: true, kumkum: true, specs: true },
      kid: { skin: SKIN.light, shirt: '#f4f4f0', pants: '#2c4f8c', hair: '#1d1410', h: 0.62, bag: true, bigHead: true },
    }[k];
    const S = s * P.h;
    const breathe = Math.sin(t * 2.2 + (spec.blinkSeed || 0)) * 4;
    const bob = (spec.bob || 0);
    const W = (lx, ly) => [x + f * lx * S, y + ly * S];
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const hipY = sit ? -170 : -450, shY = sit ? -500 : -780 - breathe * 0.3;
    const headR = P.bigHead ? 125 : 98;
    const headY = shY - 40 - headR + bob / S;
    const lean = spec.lean || 0;
    const headX = Math.sin(lean) * 120;
    // shadow
    ellipse(ctx, x, y + 6 * S, (sit ? 300 : 170) * S, 24 * S, 'rgba(0,0,0,0.18)');
    // legs
    if (sit) {
      ctx.fillStyle = P.saree || P.pants;
      roundRect(ctx, x - 270 * S, y - 170 * S, 540 * S, 170 * S, 80 * S); ctx.fill();
      ctx.fillStyle = P.skin;
      ellipse(ctx, x - 200 * S, y - 30 * S, 55 * S, 28 * S, P.skin); ellipse(ctx, x + 200 * S, y - 30 * S, 55 * S, 28 * S, P.skin);
      if (P.border) { ctx.fillStyle = P.border; ctx.fillRect(x - 270 * S, y - 40 * S, 540 * S, 18 * S); }
    } else if (P.saree) {
      ctx.fillStyle = P.saree;
      ctx.beginPath(); const a = W(-120, hipY), b = W(120, hipY);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(...W(150, -20)); ctx.lineTo(...W(-150, -20)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.border; ctx.beginPath(); ctx.moveTo(...W(-150, -20)); ctx.lineTo(...W(150, -20)); ctx.lineTo(...W(152, -55)); ctx.lineTo(...W(-152, -55)); ctx.closePath(); ctx.fill();
      // nauvari pleats
      line(ctx, [...W(0, hipY + 20), ...W(10, -60)], 'rgba(0,0,0,0.18)', 10 * S);
      line(ctx, [...W(50, hipY + 20), ...W(70, -60)], 'rgba(0,0,0,0.12)', 8 * S);
      ellipse(ctx, ...W(-60, -10), 50 * S, 18 * S, '#5a3a2a'); ellipse(ctx, ...W(60, -10), 50 * S, 18 * S, '#5a3a2a');
    } else {
      const step = spec.walk ? Math.sin(t * 14) : 0;
      const legs = [[-55, step], [55, -step]];
      for (const [lx, st] of legs) {
        const hip = W(lx, hipY), foot = W(lx + st * 90, -20);
        line(ctx, [hip[0], hip[1], foot[0], foot[1]], P.pants, 105 * S, 'butt');
        ellipse(ctx, foot[0] + f * 20 * S, foot[1] + 5 * S, 62 * S, 26 * S, '#3a2a20');
      }
      if (P.kurta) { ctx.fillStyle = P.shirt; ctx.fillRect(x - 135 * S, y + hipY * S - 10 * S, 270 * S, 200 * S); }
    }
    // bag (kid)
    if (P.bag) { ctx.fillStyle = '#c0392b'; const bp = W(f > 0 ? -175 : 175, shY + 40); roundRect(ctx, bp[0] - 70 * S, bp[1], 140 * S, 260 * S, 30 * S); ctx.fill(); }
    // torso
    ctx.fillStyle = P.shirt;
    ctx.beginPath();
    ctx.moveTo(...W(-130, shY + 10)); ctx.quadraticCurveTo(...W(0, shY - 25), ...W(130, shY + 10));
    ctx.lineTo(...W(115, hipY + 20)); ctx.lineTo(...W(-115, hipY + 20)); ctx.closePath(); ctx.fill();
    if (P.saree) { // pallu across the chest
      ctx.fillStyle = P.saree; ctx.beginPath(); ctx.moveTo(...W(-130, shY + 10)); ctx.lineTo(...W(-60, shY)); ctx.lineTo(...W(115, hipY + 10)); ctx.lineTo(...W(40, hipY + 20)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.border; ctx.beginPath(); ctx.moveTo(...W(-60, shY)); ctx.lineTo(...W(-30, shY)); ctx.lineTo(...W(125, hipY + 5)); ctx.lineTo(...W(115, hipY + 25)); ctx.closePath(); ctx.fill();
    } else if (!P.kurta) {
      line(ctx, [...W(-30, shY - 5), ...W(0, shY + 40), ...W(30, shY - 5)], 'rgba(0,0,0,0.25)', 10 * S); // collar
    } else {
      line(ctx, [...W(0, shY), ...W(0, shY + 150)], 'rgba(0,0,0,0.15)', 8 * S);
    }
    if (k === 'kid') line(ctx, [...W(0, shY + 5), ...W(0, shY + 110)], '#c0392b', 22 * S, 'butt'); // tie
    // arms
    const arm = (side, ang) => {
      ang = ang || [8, 10];
      const sh = [side * 125, shY + 35];
      const a1 = ang[0] * Math.PI / 180, a2 = (ang[0] + ang[1]) * Math.PI / 180;
      const el = [sh[0] + Math.sin(a1) * 190, sh[1] + Math.cos(a1) * 190];
      const hd = [el[0] + Math.sin(a2) * 175, el[1] + Math.cos(a2) * 175];
      const p0 = W(...sh), p1 = W(...el), p2 = W(...hd);
      line(ctx, [...p0, ...p1, ...p2], P.saree && side < 0 ? P.saree : P.shirt, 68 * S);
      line(ctx, [...p1, ...p2], P.kurta || P.saree ? P.skin : P.shirt, 56 * S);
      if (!P.kurta && !P.saree) line(ctx, [p1[0] + (p2[0] - p1[0]) * 0.55, p1[1] + (p2[1] - p1[1]) * 0.55, ...p2], P.skin, 54 * S);
      if (P.saree) { ellipse(ctx, p1[0] + (p2[0] - p1[0]) * 0.7, p1[1] + (p2[1] - p1[1]) * 0.7, 30 * S, 30 * S, null, '#2e7dd1', 8 * S); }
      circle(ctx, p2[0], p2[1], 40 * S, P.skin);
      return p2;
    };
    // draw far arm first
    const handL = arm(-1, spec.armL), handR = arm(1, spec.armR);
    // neck + head
    line(ctx, [...W(headX * 0.3, shY + 10), ...W(headX * 0.5, shY - 50)], P.skin, 70 * S, 'butt');
    const hc = W(headX + 8, headY);
    const hr = headR * S;
    if (P.bun) circle(ctx, hc[0] - f * 70 * S, hc[1] - 20 * S, 52 * S, P.hair);
    // ears
    circle(ctx, hc[0] - f * hr * 0.92, hc[1] + 8 * S, 22 * S, P.skin);
    ellipse(ctx, hc[0], hc[1], hr * 0.95, hr * 1.04, P.skin);
    // hair
    ctx.fillStyle = P.hair;
    ctx.beginPath();
    if (k === 'aaji' || k === 'mom') {
      ctx.ellipse(hc[0], hc[1] - hr * 0.25, hr * 1.0, hr * 0.85, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath(); ctx.fill();
      line(ctx, [hc[0], hc[1] - hr * 1.08, hc[0], hc[1] - hr * 0.7], k === 'aaji' ? '#c9302c' : '#c9302c', 7 * S); // sindoor / parting
    } else {
      ctx.ellipse(hc[0] - f * 6 * S, hc[1] - hr * 0.5, hr * 1.02, hr * 0.7, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hc[0] + f * hr * 0.3, hc[1] - hr * 0.62, hr * 0.62, hr * 0.32, f * 0.25, 0, TAU); ctx.fill();
      if (k === 'friend') { ctx.fillStyle = '#7a2a1a'; roundRect(ctx, hc[0] - hr, hc[1] - hr * 1.12, hr * 2, hr * 0.42, hr * 0.2); ctx.fill(); }
    }
    if (k === 'aaji' && spec.pallu !== false) { // pallu over the head
      ctx.fillStyle = P.saree; ctx.beginPath();
      ctx.moveTo(hc[0] - hr * 1.1, hc[1] + hr * 0.9); ctx.quadraticCurveTo(hc[0] - hr * 1.25, hc[1] - hr * 1.35, hc[0] + hr * 0.4, hc[1] - hr * 1.15);
      ctx.quadraticCurveTo(hc[0] - hr * 0.6, hc[1] - hr * 0.9, hc[0] - hr * 0.85, hc[1] + hr * 0.9); ctx.closePath(); ctx.fill();
      line(ctx, [hc[0] - hr * 1.12, hc[1] + hr * 0.6, hc[0] - hr * 1.2, hc[1] - hr * 0.5, hc[0] - hr * 0.2, hc[1] - hr * 1.2], P.border, 10 * S);
    }
    // face
    const fx = hc[0] + f * hr * 0.12, fy = hc[1] + hr * 0.05;
    const blinkPeriod = 3.1 + ((spec.blinkSeed || 0) % 7) * 0.37;
    const blink = ((t + (spec.blinkSeed || 0)) % blinkPeriod) < 0.12;
    const eyes = spec.eyes === 'closed' || blink ? 'closed' : spec.eyes || 'open';
    const ex = 34 * S, ey = fy - 6 * S;
    for (const sx of [-1, 1]) {
      const exx = fx + sx * ex;
      if (eyes === 'open') { circle(ctx, exx, ey, 11 * S, '#1a1210'); circle(ctx, exx + 3 * S, ey - 4 * S, 3.5 * S, '#fff'); }
      else if (eyes === 'happy') { ctx.beginPath(); ctx.arc(exx, ey + 6 * S, 14 * S, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 7 * S; ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(exx, ey - 4 * S, 14 * S, Math.PI * 0.15, Math.PI * 0.85); ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 7 * S; ctx.stroke(); }
      line(ctx, [exx - 16 * S, ey - 30 * S - (spec.brow || 0) * S, exx + 14 * S, ey - 33 * S - (spec.brow || 0) * S], k === 'aaji' ? '#9a948c' : '#2a1c14', 7 * S);
    }
    if (P.specs) {
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 5 * S;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + sx * ex, ey, 25 * S, 0, TAU); ctx.stroke(); }
      line(ctx, [fx - ex + 25 * S, ey, fx + ex - 25 * S, ey], '#3a2a20', 5 * S);
    }
    if (P.kumkum) { ctx.fillStyle = '#c9182c'; roundRect(ctx, fx - 6 * S, ey - 62 * S, 12 * S, 24 * S, 6 * S); ctx.fill(); }
    if (P.bindi) circle(ctx, fx, ey - 46 * S, 8 * S, '#c9182c');
    // cheeks
    ellipse(ctx, fx - 52 * S, fy + 32 * S, 16 * S, 9 * S, 'rgba(220,90,80,0.25)');
    ellipse(ctx, fx + 52 * S, fy + 32 * S, 16 * S, 9 * S, 'rgba(220,90,80,0.25)');
    // nose
    line(ctx, [fx + f * 4 * S, fy + 4 * S, fx + f * 12 * S, fy + 26 * S, fx, fy + 30 * S], 'rgba(90,40,20,0.45)', 5 * S);
    if (P.mous) line(ctx, [fx - 30 * S, fy + 48 * S, fx, fy + 42 * S, fx + 30 * S, fy + 48 * S], '#1b120c', 11 * S);
    // mouth
    const my = fy + 58 * S, mouth = spec.mouth || 'smile';
    ctx.fillStyle = '#7a2420'; ctx.strokeStyle = '#5a1a14'; ctx.lineWidth = 6 * S;
    if (mouth === 'smile') { ctx.beginPath(); ctx.arc(fx, my - 12 * S, 26 * S, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); }
    else if (mouth === 'laugh' || mouth === 'open') {
      const o = mouth === 'laugh' ? 1 + 0.25 * Math.sin(t * 18) : 1;
      ctx.beginPath(); ctx.moveTo(fx - 30 * S, my - 6 * S); ctx.quadraticCurveTo(fx, my + 44 * S * o, fx + 30 * S, my - 6 * S); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(fx - 22 * S, my - 6 * S, 44 * S, 7 * S);
    } else if (mouth === 'chew') {
      const o = 0.5 + 0.5 * Math.abs(Math.sin(t * 9));
      ellipse(ctx, fx, my, 18 * S, 8 * S * o + 3 * S, '#7a2420');
    } else if (mouth === 'o') { ellipse(ctx, fx, my, 14 * S, 18 * S, '#7a2420'); }
    else { line(ctx, [fx - 20 * S, my - 2 * S, fx + 20 * S, my], '#5a1a14', 6 * S); }
    ctx.restore();
    return { handL, handR, head: hc, headR: hr };
  }

  function speechBubble(ctx, cx, cy, w, h, tx, ty, fill) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    ctx.fillStyle = fill || '#fffaf0';
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 40, cy + h / 2 - 4); ctx.lineTo(tx, ty); ctx.lineTo(cx + 30, cy + h / 2 - 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ props
  // terracotta pot, centre of mouth at (x, y), width ~ 2*r
  function clayPot(ctx, x, y, r, opts) {
    opts = opts || {};
    const body = ctx.createRadialGradient(x - r * 0.35, y + r * 0.5, r * 0.1, x, y + r * 0.6, r * 1.3);
    body.addColorStop(0, '#d8603a'); body.addColorStop(0.6, '#b8432a'); body.addColorStop(1, '#7c2716');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.62, y);
    ctx.bezierCurveTo(x - r * 1.35, y + r * 0.35, x - r * 1.15, y + r * 1.45, x - r * 0.35, y + r * 1.55);
    ctx.lineTo(x + r * 0.35, y + r * 1.55);
    ctx.bezierCurveTo(x + r * 1.15, y + r * 1.45, x + r * 1.35, y + r * 0.35, x + r * 0.62, y);
    ctx.closePath(); ctx.fill();
    // rim
    ctx.fillStyle = '#9c3520'; roundRect(ctx, x - r * 0.75, y - r * 0.12, r * 1.5, r * 0.22, r * 0.1); ctx.fill();
    if (opts.warli !== false) warli(ctx, x, y + r * 0.78, r);
    if (opts.farsan !== false) {
      const sp = farsanSprite(Math.round(r * 1.6), Math.round(r * 0.75), opts.seed || 11, { grain: Math.max(6, r / 13) });
      ctx.drawImage(sp, x - r * 0.8, y - r * 0.7);
    }
  }
  // Warli style white figures band around a pot
  function warli(ctx, x, y, r) {
    ctx.save();
    ctx.strokeStyle = '#fff6ea'; ctx.fillStyle = '#fff6ea'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, r * 0.025);
    // band lines
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.45, r * 1.08, r * 0.09, 0, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.42, r * 1.0, r * 0.09, 0, 0, Math.PI); ctx.stroke();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const fx = x + (i - (n - 1) / 2) * r * 0.36, fy = y, u = r * 0.13;
      // two triangles body
      ctx.beginPath(); ctx.moveTo(fx - u, fy - u * 1.6); ctx.lineTo(fx + u, fy - u * 1.6); ctx.lineTo(fx, fy - u * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - u, fy + u * 1.4); ctx.lineTo(fx + u, fy + u * 1.4); ctx.lineTo(fx, fy - u * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy - u * 2.2, u * 0.45, 0, TAU); ctx.fill();
      // arms holding hands
      ctx.beginPath(); ctx.moveTo(fx - u * 0.9, fy - u * 1.5); ctx.lineTo(fx - u * 1.6, fy - u * 0.6); ctx.lineTo(fx - u * 2.0, fy - u * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + u * 0.9, fy - u * 1.5); ctx.lineTo(fx + u * 1.6, fy - u * 0.6); ctx.lineTo(fx + u * 2.0, fy - u * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - u * 0.5, fy + u * 1.4); ctx.lineTo(fx - u * 0.7, fy + u * 2.3); ctx.moveTo(fx + u * 0.5, fy + u * 1.4); ctx.lineTo(fx + u * 0.7, fy + u * 2.3); ctx.stroke();
    }
    ctx.restore();
  }
  // small clay bowl seen from the front-top, centre (x,y) rim centre, rx radius. fill: colour or function
  function clayBowl(ctx, x, y, rx, content) {
    const ry = rx * 0.32;
    ellipse(ctx, x, y + rx * 0.62, rx * 0.95, ry * 0.6, 'rgba(0,0,0,0.25)');
    const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, '#8a2f1a'); g.addColorStop(0.35, '#c8573a'); g.addColorStop(1, '#7a2614');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI); ctx.bezierCurveTo(x - rx * 0.9, y + rx * 0.55, x + rx * 0.9, y + rx * 0.55, x + rx, y); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.bezierCurveTo(x - rx * 0.95, y + rx * 0.62, x + rx * 0.95, y + rx * 0.62, x + rx, y); ctx.closePath(); ctx.fill();
    ellipse(ctx, x, y, rx, ry, '#a8442a');
    ellipse(ctx, x, y + ry * 0.12, rx * 0.88, ry * 0.78, '#5e1e10');
    if (content) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + ry * 0.1, rx * 0.88, ry * 0.8, 0, 0, TAU); ctx.clip();
      content(ctx, x, y, rx, ry); ctx.restore();
      // small mound above the rim
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - ry * 0.05, rx * 0.84, ry * 1.1, 0, Math.PI, TAU); ctx.closePath(); ctx.clip();
      content(ctx, x, y, rx, ry); ctx.restore();
    }
  }
  // filler patterns for clay bowls
  function powder(color, speck) {
    return (ctx, x, y, rx, ry) => {
      const g = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.6, 2, x, y, rx);
      g.addColorStop(0, speck || '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, color);
      ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry * 2, rx * 2, ry * 4);
    };
  }
  function bits(type, seed, base) {
    return (ctx, x, y, rx, ry) => {
      ctx.fillStyle = base; ctx.fillRect(x - rx, y - ry * 2, rx * 2, ry * 4);
      const r = rng(seed);
      for (let i = 0; i < 160; i++) {
        const a = r() * TAU, d = Math.sqrt(r());
        granule(ctx, type, x + Math.cos(a) * d * rx, y - ry * 0.3 + Math.sin(a) * d * ry * 1.1, rx * 0.075, r() * TAU, r);
      }
    };
  }
  function crystals(seed) {
    return (ctx, x, y, rx, ry) => {
      ctx.fillStyle = '#8a6f78'; ctx.fillRect(x - rx, y - ry * 2, rx * 2, ry * 4);
      const r = rng(seed);
      for (let i = 0; i < 140; i++) {
        const a = r() * TAU, d = Math.sqrt(r()), s = rx * (0.04 + r() * 0.05);
        ctx.fillStyle = ['#b5979f', '#9d7f88', '#d0b8bd', '#6e5660'][Math.floor(r() * 4)];
        ctx.save(); ctx.translate(x + Math.cos(a) * d * rx, y - ry * 0.3 + Math.sin(a) * d * ry * 1.1); ctx.rotate(r() * TAU);
        ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore();
      }
    };
  }
  // stainless steel dabba (tin box) with hinged lid; (x,y) bottom centre, w width, open 0..1
  function steelDabba(ctx, x, y, w, open, inside) {
    const h = w * 0.62, ry = w * 0.16;
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#7d858c'); g.addColorStop(0.25, '#e6ebee'); g.addColorStop(0.45, '#a9b1b7'); g.addColorStop(0.75, '#d9dee2'); g.addColorStop(1, '#6d747a');
    ellipse(ctx, x, y, w * 0.55, ry * 0.7, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x - w / 2, y); ctx.ellipse(x, y, w / 2, ry, 0, Math.PI, 0, true); ctx.lineTo(x + w / 2, y - h); ctx.closePath(); ctx.fill();
    line(ctx, [x - w / 2, y - h * 0.2, x + w / 2, y - h * 0.2], 'rgba(0,0,0,0.12)', 4);
    // mouth
    ellipse(ctx, x, y - h, w / 2, ry, '#b8bfc4');
    ellipse(ctx, x, y - h + 4, w / 2 - 10, ry - 6, '#4a3020');
    if (inside && open > 0.05) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - h + 4, w / 2 - 12, ry - 8, 0, 0, TAU); ctx.clip();
      const sp = farsanSprite(Math.round(w - 24), Math.round(ry * 2), 23, { shape: 'flat', grain: w / 30 });
      ctx.drawImage(sp, x - w / 2 + 12, y - h - ry + 4); ctx.restore();
    }
    // lid hinged at the back, rotates upward
    const a = open * 1.9;
    ctx.save(); ctx.translate(x, y - h - ry * 0.9);
    ctx.scale(1, Math.cos(a));
    const lg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    lg.addColorStop(0, '#8c949a'); lg.addColorStop(0.3, '#f1f4f6'); lg.addColorStop(1, '#7a8288');
    ctx.translate(0, ry * 0.9);
    ellipse(ctx, 0, 0, w / 2 + 6, ry + 4, lg); ctx.fillStyle = lg;
    ellipse(ctx, 0, 0, w / 2 - 20, ry - 10, null, 'rgba(0,0,0,0.15)', 4);
    ctx.restore();
    if (open > 0.5) { // lid edge seen behind when open
      ctx.save(); ctx.globalAlpha = clamp((open - 0.5) * 3);
      ctx.fillStyle = '#c3c9ce'; roundRect(ctx, x - w / 2 - 6, y - h - ry - w * 0.55 * Math.sin(a) * 0.5, w + 12, 16, 8); ctx.restore();
    }
  }
  // flat plate seen at an angle
  function plate(ctx, x, y, rx, color, rim) {
    ellipse(ctx, x, y + rx * 0.08, rx * 1.02, rx * 0.36, 'rgba(0,0,0,0.25)');
    ellipse(ctx, x, y, rx, rx * 0.34, rim || '#d7dde1');
    ellipse(ctx, x, y, rx * 0.82, rx * 0.27, color || '#eef1f3');
  }
  function bowl(ctx, x, y, rx, outer, inner) {
    const ry = rx * 0.33;
    ellipse(ctx, x, y + rx * 0.62, rx, ry * 0.6, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = outer;
    ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.bezierCurveTo(x - rx, y + rx * 0.75, x + rx, y + rx * 0.75, x + rx, y); ctx.closePath(); ctx.fill();
    ellipse(ctx, x, y, rx, ry, outer);
    ellipse(ctx, x, y + 3, rx * 0.92, ry * 0.85, inner);
  }
  function scatter(ctx, x, y, rx, ry, n, seed, drawFn) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r());
      drawFn(ctx, x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry, r);
    }
  }
  function lemon(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.beginPath(); ctx.arc(0, 0, 60 * s, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#d8d02a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 50 * s, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#f4ef8a'; ctx.fill();
    ctx.strokeStyle = '#e6dd5a'; ctx.lineWidth = 4 * s;
    for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 48 * s, Math.sin(a) * 48 * s); ctx.stroke(); }
    ctx.restore();
  }
  function bus(ctx, x, y, w, color) {
    const h = w * 0.42;
    ctx.fillStyle = color || '#c0392b'; roundRect(ctx, x - w / 2, y - h, w, h, w * 0.06); ctx.fill();
    ctx.fillStyle = '#e8eef2';
    for (let i = 0; i < 5; i++) { roundRect(ctx, x - w / 2 + w * 0.05 + i * w * 0.18, y - h * 0.85, w * 0.14, h * 0.35, 8); ctx.fill(); }
    ctx.fillStyle = '#f4d03f'; ctx.fillRect(x - w / 2, y - h * 0.38, w, h * 0.08);
    circle(ctx, x - w * 0.3, y, w * 0.07, '#222'); circle(ctx, x + w * 0.3, y, w * 0.07, '#222');
    circle(ctx, x - w * 0.3, y, w * 0.03, '#999'); circle(ctx, x + w * 0.3, y, w * 0.03, '#999');
  }

  // ------------------------------------------------------------------ icons (replace emoji)
  function icon(ctx, name, x, y, s, color) {
    const c = color || '#fff';
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (name) {
      case 'ear':
        ctx.beginPath(); ctx.moveTo(-20, 30); ctx.bezierCurveTo(-45, 0, -40, -45, 0, -45); ctx.bezierCurveTo(40, -45, 45, -5, 25, 15);
        ctx.bezierCurveTo(10, 30, 10, 45, -5, 48); ctx.bezierCurveTo(-15, 50, -20, 42, -20, 30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -5); ctx.bezierCurveTo(-10, -25, 18, -25, 15, -5); ctx.bezierCurveTo(12, 8, 0, 8, 0, 18); ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(10, 0, 62 + i * 18, -0.5, 0.5); ctx.globalAlpha = 0.7 - i * 0.2; ctx.stroke(); }
        ctx.globalAlpha = 1;
        break;
      case 'tea':
        ctx.beginPath(); ctx.moveTo(-40, -10); ctx.lineTo(30, -10); ctx.lineTo(24, 40); ctx.quadraticCurveTo(-5, 52, -34, 40); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(38, 12, 14, -1.4, 1.5); ctx.stroke();
        line(ctx, [-50, 52, 40, 52], c, 9);
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 18 - 5, -22); ctx.quadraticCurveTo(i * 18 + 6, -36, i * 18 - 5, -50); ctx.stroke(); }
        break;
      case 'poha':
        ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.arc(0, 0, 50, 0, Math.PI); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-38, 0); ctx.quadraticCurveTo(-20, -28, 0, -14); ctx.quadraticCurveTo(20, -32, 38, 0); ctx.stroke();
        circle(ctx, -12, -8, 6, c); circle(ctx, 14, -10, 6, c);
        break;
      case 'salad':
        ctx.beginPath(); ctx.moveTo(-52, 0); ctx.lineTo(52, 0); ctx.arc(0, 0, 52, 0, Math.PI); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-18, -12, 16, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(18, -14, 14, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(10, -45, 30, -48); ctx.stroke();
        break;
      case 'chili':
        ctx.beginPath(); ctx.moveTo(-40, -20); ctx.bezierCurveTo(-20, -30, 40, -10, 42, 45); ctx.bezierCurveTo(10, 20, -30, 5, -40, -20); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-40, -20); ctx.quadraticCurveTo(-50, -40, -35, -52); ctx.stroke();
        break;
      case 'bus':
        roundRect(ctx, -50, -40, 100, 72, 14); ctx.stroke();
        line(ctx, [-50, -5, 50, -5], c, 7);
        ctx.strokeRect(-36, -28, 30, 16); ctx.strokeRect(6, -28, 30, 16);
        circle(ctx, -28, 38, 11, c); circle(ctx, 28, 38, 11, c);
        break;
      case 'namaste':
        ctx.beginPath(); ctx.moveTo(-4, -55); ctx.bezierCurveTo(-30, -30, -38, 10, -30, 40); ctx.lineTo(-4, 40); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -55); ctx.bezierCurveTo(30, -30, 38, 10, 30, 40); ctx.lineTo(4, 40); ctx.closePath(); ctx.stroke();
        line(ctx, [-42, 52, -30, 40], c, 9); line(ctx, [42, 52, 30, 40], c, 9);
        for (const a of [-2.4, -1.57, -0.7]) { line(ctx, [Math.cos(a) * 62, Math.sin(a) * 62 - 10, Math.cos(a) * 78, Math.sin(a) * 78 - 10], c, 7); }
        break;
      case 'phone':
        ctx.beginPath();
        ctx.moveTo(-35, -45); ctx.quadraticCurveTo(-50, -40, -48, -20); ctx.bezierCurveTo(-40, 20, -10, 45, 25, 50); ctx.quadraticCurveTo(45, 50, 48, 35);
        ctx.lineTo(28, 15); ctx.lineTo(10, 25); ctx.bezierCurveTo(-5, 18, -15, 5, -22, -10); ctx.lineTo(-12, -28); ctx.closePath(); ctx.fill();
        break;
      case 'dhol':
        ctx.beginPath(); ctx.ellipse(-40, 0, 14, 40, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(40, 0, 14, 40, 0, 0, TAU); ctx.stroke();
        line(ctx, [-40, -40, 40, -40], c, 9); line(ctx, [-40, 40, 40, 40], c, 9);
        line(ctx, [-30, -38, 0, 38, 30, -38], c, 5);
        break;
    }
    ctx.restore();
  }

  root.Art = {
    TAU, rng, clamp, lerp, prog, easeOut, easeIn, easeInOut, backOut, elastic,
    roundRect, ellipse, circle, line, glow, vgrad, vignette, grain, cached,
    granule, farsanSprite, sprinkle, crumbs, steam, teaGlass, teaCup, cityNight, rain,
    person, speechBubble, clayPot, warli, clayBowl, powder, bits, crystals, steelDabba, plate, bowl, scatter, lemon, bus, icon,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
