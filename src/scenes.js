// scenes.js - the full reel (script #1) drawn procedurally: window.REEL.draw(ctx, t).
// Timing lives in timeline.js, strings in strings.js, the soundtrack in audio.js.
(function () {
  'use strict';
  const A = window.Art, T = window.Text, S = window.REEL_STRINGS, TL = window.TIMELINE, P = window.Pack;
  const { clamp, lerp, prog, easeOut, easeIn, easeInOut, backOut } = A;
  const W = 1080, H = 1920;
  // Price shown on the hero card. The user confirmed the current offer is ₹100 for everyone (MRP ₹130).
  // Change the digits in strings.js (REEL_PRICE) or set showMrp:false to hide the struck-through MRP.
  const PRICE_CONFIG = { mrp: S.mrp, offer: S.offer, showMrp: true };
  const SAFE = { top: 250, bottom: 1500, left: 60, right: 1020 };

  let buf = null, buf2 = null, small = null;
  const offscreen = () => { if (!buf) { buf = new OffscreenCanvas(W, H); buf2 = new OffscreenCanvas(W, H); } return buf; };

  // ------------------------------------------------------------------ text helpers
  function fitSize(text, size, maxW) { while (size > 20 && T.measure(text, size) > maxW) size -= 2; return size; }
  function title(ctx, text, x, y, size, opts) {
    opts = Object.assign({ fill: '#fff', stroke: 'rgba(40,10,0,0.85)', strokeWidth: Math.max(4, size * 0.08), align: 'center' }, opts || {});
    const k = opts.scale == null ? 1 : opts.scale;
    ctx.save();
    ctx.globalAlpha *= opts.alpha == null ? 1 : opts.alpha;
    ctx.translate(x, y); ctx.scale(k, k);
    if (opts.rotate) ctx.rotate(opts.rotate);
    if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = size * 0.3; }
    T.draw(ctx, text, 0, 0, size, Object.assign({}, opts, { baseline: 'middle' }));
    ctx.restore();
  }
  const SUB_COLORS = { vo: '#ffffff', aaji: '#ffe08a', friend: '#bfe9ff' };
  function subtitles(ctx, t) {
    for (const s of TL.SUBS) {
      if (s.silent || t < s.start || t >= s.end) continue;
      const a = clamp(Math.min((t - s.start) / 0.15, (s.end - t) / 0.15));
      const size = 58, maxW = 900;
      const lines = T.wrap(s.text, size, maxW);
      const lh = T.lineHeight(size);
      const bw = Math.min(980, Math.max(...lines.map(l => T.measure(l, size))) + 80);
      const bh = lines.length * lh + 34;
      const y0 = SAFE.bottom - bh;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - a) * 18);
      ctx.fillStyle = 'rgba(12,6,4,0.62)';
      A.roundRect(ctx, 540 - bw / 2, y0, bw, bh, 28); ctx.fill();
      lines.forEach((l, i) => T.draw(ctx, l, 540, y0 + 17 + 0.3 * size + i * lh, size,
        { fill: SUB_COLORS[s.speaker] || '#fff', stroke: 'rgba(0,0,0,0.85)', strokeWidth: 5, align: 'center' }));
      ctx.restore();
    }
  }
  function bubble(ctx, text, cx, cy, tx, ty, k, size) {
    if (k <= 0) return;
    size = size || 66;
    const lines = T.wrap(text, size, 760);
    const lh = T.lineHeight(size);
    const w = Math.max(...lines.map(l => T.measure(l, size))) + 90, h = lines.length * lh + 60;
    ctx.save();
    ctx.translate(tx, ty); ctx.scale(backOut(k), backOut(k)); ctx.translate(-tx, -ty);
    A.speechBubble(ctx, cx, cy, w, h, tx, ty);
    lines.forEach((l, i) => T.draw(ctx, l, cx, cy - h / 2 + 30 + 0.3 * size + i * lh, size, { fill: '#5a1a0c', align: 'center' }));
    ctx.restore();
  }
  function pill(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; A.roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); }

  // ------------------------------------------------------------------ transitions
  function ripple(ctx, src, amount, t) {
    const strip = 12;
    for (let y = 0; y < H; y += strip) {
      const dx = Math.sin(y * 0.018 + t * 14) * 40 * amount;
      ctx.drawImage(src, 0, y, W, strip, dx, y, W, strip);
    }
  }
  function renderTo(c, fn, t) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
    fn(g, t);
    return c;
  }

  // ------------------------------------------------------------------ hand (hook)
  function hand(ctx, px, py, s, rot, pinch) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(s, s);
    const skin = '#c98a5e', dark = '#a86d45';
    A.line(ctx, [260, -900, 120, -260], '#3c6e9e', 230); // sleeve
    A.line(ctx, [150, -330, 70, -150], skin, 190);
    A.ellipse(ctx, 40, -120, 120, 100, skin);
    // curled fingers behind
    A.line(ctx, [120, -110, 150, -20, 110, 30], dark, 58);
    A.line(ctx, [70, -80, 95, 10, 60, 55], skin, 58);
    // index finger + thumb pinching at origin
    const g = pinch == null ? 0 : pinch;
    A.line(ctx, [-30, -170, -70, -80, -18 - g * 10, -14], skin, 62);
    A.line(ctx, [110, -40, 60, 20, 16 + g * 10, 6], skin, 66);
    A.ellipse(ctx, -14 - g * 10, -16, 20, 14, '#e8b8a0');
    A.ellipse(ctx, 18 + g * 10, 4, 20, 14, '#e8b8a0');
    A.line(ctx, [60, -150, 30, -130], 'rgba(90,40,20,0.35)', 8);
    ctx.restore();
  }
  function heldBit(ctx, x, y, s, seed) {
    const r = A.rng(seed);
    for (let i = 0; i < 9; i++) A.granule(ctx, ['sev', 'boondi', 'peanut', 'sev', 'dal'][i % 5], x + (r() - 0.5) * 60 * s, y + (r() - 0.5) * 40 * s, 22 * s, r() * A.TAU, r);
  }

  // ------------------------------------------------------------------ scene 1: hook 0-3 s
  const CRUNCH = [0.75, 1.45, 2.15];
  function sHook(ctx, t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const on = easeOut(prog(t, 0.2, 0.7));
    let shake = 0;
    for (const c of CRUNCH) { const d = t - c; if (d >= 0 && d < 0.25) shake = Math.max(shake, (1 - d / 0.25)); }
    ctx.save();
    ctx.globalAlpha = on;
    ctx.translate(Math.sin(t * 90) * 22 * shake, Math.cos(t * 70) * 18 * shake);
    const zoom = 1.05 + t * 0.03;
    ctx.translate(540, 1100); ctx.scale(zoom, zoom); ctx.translate(-540, -1100);
    A.glow(ctx, 540, 1150, 900, 'rgba(255,170,70,0.55)');
    // big heap below
    ctx.drawImage(A.farsanSprite(1400, 640, 3, { grain: 40 }), -160, 1330);
    // hand pinching farsan
    const hx = 560, hy = 1080 + Math.sin(t * 3) * 10;
    let pinch = 0;
    for (const c of CRUNCH) { const d = t - c; if (d >= -0.08 && d < 0.18) pinch = Math.max(pinch, 1 - Math.abs(d - 0.02) / 0.16); }
    heldBit(ctx, hx, hy, 1.6, 8 + CRUNCH.filter(c => t > c).length);
    hand(ctx, hx, hy, 1.6, 0.5, pinch);
    for (let i = 0; i < CRUNCH.length; i++) A.crumbs(ctx, t, CRUNCH[i], hx, hy, 34, 100 + i, 26, 1100);
    ctx.restore();
    // flash on each crunch
    for (const c of CRUNCH) { const d = t - c; if (d >= 0 && d < 0.12) { ctx.fillStyle = `rgba(255,220,160,${0.25 * (1 - d / 0.12)})`; ctx.fillRect(0, 0, W, H); } }
    A.vignette(ctx, 0.85);
    // title + ear icon
    const k = prog(t, 0.45, 0.85);
    if (k > 0) {
      const sz = fitSize(S.hook, 84, 960);
      const lines = T.wrap(S.hook, sz, 940);
      ctx.save();
      const s = backOut(k);
      ctx.save(); ctx.globalAlpha = 0.55 * clamp(k * 2); ctx.fillStyle = '#000';
      A.roundRect(ctx, 50, 255, 980, 175 + lines.length * T.lineHeight(sz), 40); ctx.fill(); ctx.restore();
      A.icon(ctx, 'ear', 540, 330, 120 * s, '#ffd27a');
      lines.forEach((l, i) => title(ctx, l, 540, 480 + i * T.lineHeight(sz), sz, { scale: s, fill: '#fff' }));
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ scene 2: city 3-8 s
  function room(ctx, t, warm) {
    A.vgrad(ctx, 0, 0, W, H, warm ? ['#3a3550', '#4a3f55', '#2a2230'] : ['#1a2238', '#222c48', '#151a2a']);
    // window
    const wx = 110, wy = 260, ww = 860, wh = 900;
    A.cityNight(ctx, wx, wy, ww, wh, t, 5);
    A.rain(ctx, wx, wy, ww, wh, t, 9, 170);
    ctx.fillStyle = 'rgba(150,180,255,0.06)'; ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 34; ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * 0.42); ctx.lineTo(wx + ww, wy + wh * 0.42); ctx.stroke();
    ctx.fillStyle = '#4a3428'; ctx.fillRect(wx - 50, wy + wh, ww + 100, 46);
    // curtains
    for (const [cx, dir] of [[40, 1], [1040, -1]]) {
      ctx.fillStyle = warm ? '#8a4a3a' : '#3e4a6e';
      ctx.beginPath(); ctx.moveTo(cx - 120 * dir, 200); ctx.lineTo(cx + 150 * dir, 200);
      ctx.quadraticCurveTo(cx + 60 * dir, 900, cx + 120 * dir, 1500); ctx.lineTo(cx - 120 * dir, 1500); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 8;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + (i * 40 - 30) * dir, 220); ctx.quadraticCurveTo(cx + (i * 30) * dir, 900, cx + (i * 30 + 10) * dir, 1500); ctx.stroke(); }
    }
    ctx.fillStyle = '#2a2018'; ctx.fillRect(0, 180, W, 30);
    // floor
    A.vgrad(ctx, 0, 1500, W, 420, warm ? ['#5a3a28', '#3a2418'] : ['#2a2a38', '#16161e']);
    if (warm) A.glow(ctx, 960, 700, 700, 'rgba(255,170,80,0.35)');
  }
  function sCity(ctx, t) {
    const lt = t - 3;
    const z = 1 + 0.05 * lt / 5;
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
    room(ctx, t, false);
    const p = A.person(ctx, 770, 1830, 1.05, { kind: 'man', facing: -1, t, armR: [30, 105], armL: [6, 8], mouth: 'flat', blinkSeed: 2, lean: -0.05 });
    A.teaGlass(ctx, p.handR[0] - 20, p.handR[1] + 40, 0.5, t);
    // rim light from the window
    A.glow(ctx, 540, 700, 700, 'rgba(120,150,255,0.18)');
    ctx.restore();
    A.vignette(ctx, 0.6);
  }

  // ------------------------------------------------------------------ scene 3: flashback 8-15 s
  function village(ctx, t) {
    A.vgrad(ctx, 0, 0, W, H, ['#e7b874', '#dca263', '#c4874a']);
    // lime-washed wall texture
    const r = A.rng(12);
    ctx.fillStyle = 'rgba(255,240,210,0.12)';
    for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.ellipse(r() * W, 200 + r() * 1100, 40 + r() * 90, 20 + r() * 40, 0, 0, A.TAU); ctx.fill(); }
    // roof beams + rafters
    ctx.fillStyle = '#5a3418'; ctx.fillRect(0, 0, W, 120);
    for (let x = -40; x < W; x += 150) { ctx.fillStyle = '#6e4220'; ctx.fillRect(x, 0, 40, 220); }
    ctx.fillStyle = '#4a2a12'; ctx.fillRect(0, 200, W, 44);
    // small window with light shafts
    ctx.fillStyle = '#fff2c4'; ctx.fillRect(120, 420, 230, 300);
    ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 18; ctx.strokeRect(120, 420, 230, 300);
    ctx.lineWidth = 10; for (let x = 165; x < 350; x += 46) { ctx.beginPath(); ctx.moveTo(x, 420); ctx.lineTo(x, 720); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(200, 500, 700, 1500);
    g.addColorStop(0, 'rgba(255,220,140,0.35)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(120, 430); ctx.lineTo(350, 420); ctx.lineTo(1000, 1500); ctx.lineTo(500, 1600); ctx.closePath(); ctx.fill();
    ctx.restore();
    // dust motes in the light
    for (let i = 0; i < 40; i++) {
      const rr = A.rng(500 + i); const x = 250 + rr() * 500 + Math.sin(t * 0.7 + i) * 20, y = 600 + rr() * 800 + Math.cos(t * 0.5 + i) * 30;
      A.circle(ctx, x, y, 2 + rr() * 3, 'rgba(255,240,200,0.6)');
    }
    // shelf with brass pots
    ctx.fillStyle = '#5a3418'; ctx.fillRect(620, 560, 400, 22);
    [[680, '#d4a02a'], [770, '#b8862a'], [860, '#d4a02a'], [950, '#9a9a9a']].forEach(([x, c], i) => {
      A.ellipse(ctx, x, 520, 38 - i * 2, 42, c); A.ellipse(ctx, x, 476, 22, 8, c);
      A.line(ctx, [x - 14, 505, x - 8, 540], 'rgba(255,255,255,0.4)', 6);
    });
    // door on the right
    ctx.fillStyle = '#4a2a12'; ctx.fillRect(900, 780, 180, 620);
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(920, 800, 160, 600);
    // floor (sarvlelI cow-dung floor) + rangoli
    A.vgrad(ctx, 0, 1380, W, 540, ['#9a6a3e', '#7a4e2c']);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = i * A.TAU / 8; ctx.beginPath(); ctx.ellipse(170 + Math.cos(a) * 40, 1790 + Math.sin(a) * 14, 26, 10, a, 0, A.TAU); ctx.stroke(); }
  }
  function sFlash(ctx, t) {
    const lt = t - 8;
    village(ctx, t);
    // Aaji seated with the dabba
    const lidOpen = easeInOut(prog(lt, 0.9, 1.8));
    const scold = prog(lt, 4.1, 4.4) * (1 - prog(lt, 6.6, 6.9));
    const aajiArm = scold > 0 ? [lerp(10, 120, scold), lerp(10, 40, scold) + Math.sin(lt * 14) * 12 * scold] : [lerp(30, 45, lidOpen), 60];
    const aaji = A.person(ctx, 690, 1520, 0.95, { kind: 'aaji', pose: 'sit', facing: -1, t, armL: [20, 50], armR: aajiArm, mouth: scold > 0.2 ? 'open' : 'smile', eyes: lt > 3.4 && lt < 4.2 ? 'open' : 'happy', blinkSeed: 4, brow: scold * 8 });
    A.steelDabba(ctx, 400, 1640, 280, lidOpen, true);
    // kid: runs in, grabs, runs out
    const kidIn = prog(lt, 2.0, 3.2), kidOut = prog(lt, 4.3, 5.6);
    if (lt > 2.0 && kidOut < 1) {
      let kx, facing = 1, walk = true, armR = [lerp(-30, 30, (Math.sin(lt * 14) + 1) / 2), 20];
      if (kidOut > 0) { kx = lerp(250, -320, easeIn(kidOut)); facing = -1; }
      else kx = lerp(-260, 250, easeOut(kidIn));
      const grab = prog(lt, 3.3, 3.7) * (1 - prog(lt, 3.9, 4.2));
      if (kidIn >= 1 && kidOut === 0) { walk = false; armR = [lerp(20, 95, grab), lerp(10, -10, grab)]; }
      const kid = A.person(ctx, kx, 1700, 1.0, { kind: 'kid', facing, t, walk, armR, armL: [-15, 20], mouth: lt > 3.8 ? 'laugh' : 'open', eyes: 'open', blinkSeed: 1 });
      if (lt > 3.75) heldBit(ctx, kid.handR[0], kid.handR[1] - 10, 0.9, 77);
      if (lt > 3.7 && lt < 4.4) A.crumbs(ctx, t, 8 + 3.75, kid.handR[0], kid.handR[1], 10, 55, 12, 400);
    }
    // speech bubble
    const bk = prog(lt, 4.2, 4.5) * (1 - prog(lt, 6.6, 6.8));
    bubble(ctx, S.aaji1, 620, 820, aaji.head[0] - 40, aaji.head[1] - aaji.headR - 20, bk, 70);
    // warm flashback grade
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,170,60,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    A.vignette(ctx, 0, 'rgba(70,30,5,0.75)');
    A.grain(ctx, t, 0.12);
    // soft dreamy edge blur hint: light leak
    A.glow(ctx, 140, 300, 600, 'rgba(255,200,120,0.35)');
    if (lt > 6.75) { ctx.fillStyle = `rgba(255,255,255,${prog(lt, 6.75, 7)})`; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------ scene 4: present 15-20 s
  function rays(ctx, cx, cy, t, c1, c2, n) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.15);
    n = n || 16;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 2200, i * A.TAU / n, (i + 1) * A.TAU / n); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function sPresent(ctx, t) {
    const lt = t - 15;
    if (lt < 1.75) {
      room(ctx, t, true);
      const toss = prog(lt, 0.15, 0.45);
      const friend = A.person(ctx, 250, 1820, 0.9, { kind: 'friend', facing: 1, t, armR: [lerp(10, 130, easeOut(toss)) - prog(lt, 0.45, 0.8) * 60, lerp(30, -20, toss)], armL: [5, 10], mouth: lt < 1.6 ? 'laugh' : 'smile', eyes: 'happy', blinkSeed: 3 });
      const fly = prog(lt, 0.45, 1.15);
      const catchK = prog(lt, 1.0, 1.2);
      const man = A.person(ctx, 820, 1820, 0.9, { kind: 'man', facing: -1, t, armR: [lerp(20, 95, catchK), lerp(30, 0, catchK)], armL: [lerp(10, 80, catchK), 10], mouth: catchK > 0.5 ? 'open' : 'smile', eyes: 'open', blinkSeed: 2 });
      // packet in flight (arc + spin), then in his hands
      let px, py, rot;
      if (lt < 0.45) { px = friend.handR[0]; py = friend.handR[1] - 60; rot = -0.3; }
      else if (fly < 1) { px = lerp(friend.handR[0], man.handR[0], fly); py = lerp(friend.handR[1] - 60, man.handR[1] - 80, fly) - Math.sin(fly * Math.PI) * 420; rot = -0.3 + fly * A.TAU * 1.25; }
      else { px = man.handR[0]; py = man.handR[1] - 80; rot = 0.1; }
      P.drawPack(ctx, px, py, 230, { rotation: rot, shadow: false });
      bubble(ctx, S.friend, 420, 640, friend.head[0] + 40, friend.head[1] - friend.headR - 10, prog(lt, 0.3, 0.55) * (1 - prog(lt, 1.6, 1.75)), 64);
      A.vignette(ctx, 0.5);
      if (lt < 0.3) { ctx.fillStyle = `rgba(255,255,255,${1 - lt / 0.3})`; ctx.fillRect(0, 0, W, H); }
      return;
    }
    if (lt < 2.7) {
      // close-up: pack tears open
      const u = lt - 1.75;
      A.vgrad(ctx, 0, 0, W, H, ['#4a2a20', '#2a1610']);
      A.glow(ctx, 540, 900, 900, 'rgba(255,170,90,0.45)');
      const z = 1 + u * 0.06;
      const torn = easeOut(prog(u, 0.15, 0.75));
      P.drawPack(ctx, 540, 1000, 1150 * z, { rotation: -0.04, torn, openAmount: easeOut(prog(u, 0.2, 0.6)) });
      // hands gripping the corners
      hand(ctx, 210, 520, 1.0, 0.9 - torn * 0.3, 0.6);
      hand(ctx, 870, 520 - torn * 60, 1.0, -0.9 - torn * 0.4, 0.6);
      A.crumbs(ctx, t, 15 + 1.75 + 0.2, 540, 480, 26, 300, 20, 900);
      return;
    }
    if (lt < 3.8) {
      // face close-up: bite, eyes closed, Aaji's echo
      const u = lt - 2.7;
      A.vgrad(ctx, 0, 0, W, H, ['#5a3420', '#2c1a10']);
      A.glow(ctx, 540, 800, 1000, 'rgba(255,190,90,0.5)');
      // ghost of Aaji (memory)
      ctx.save(); ctx.globalAlpha = 0.22 * prog(u, 0.1, 0.5);
      A.person(ctx, 820, 1050, 0.75, { kind: 'aaji', facing: -1, t, eyes: 'happy', mouth: 'open', armR: [100, 40] });
      ctx.restore();
      const m = A.person(ctx, 470, 3150, 2.5, { kind: 'man', facing: 1, t, eyes: u > 0.15 ? 'closed' : 'open', mouth: u > 0.15 ? 'chew' : 'open', armR: [10, 165], armL: [5, 5], blinkSeed: 9, lean: 0.06 });
      heldBit(ctx, m.handR[0], m.handR[1] - 30, 1.4, u < 0.2 ? 31 : 32);
      A.crumbs(ctx, t, 17.7 + 0.05, m.head[0] + 40, m.head[1] + 150, 30, 400, 22, 700);
      // echo text: three fading copies
      const ek = prog(u, 0.05, 0.4);
      for (let i = 2; i >= 0; i--) {
        const sc = 1 + i * 0.18 + u * 0.08;
        title(ctx, S.aajiEcho, 540, 420 + i * 6, 96, { scale: sc, alpha: ek * (i === 0 ? 0.95 : 0.25 / i), fill: '#ffd98a', stroke: 'rgba(90,40,0,0.6)', shadow: 'rgba(255,200,80,0.9)' });
      }
      A.grain(ctx, t, 0.08);
      return;
    }
    // brand title slam over the pack
    const u = lt - 3.8;
    A.vgrad(ctx, 0, 0, W, H, ['#8e1116', '#4a0608']);
    rays(ctx, 540, 900, t, 'rgba(255,200,100,0.10)', 'rgba(255,200,100,0)', 20);
    A.glow(ctx, 540, 900, 700, 'rgba(255,190,90,0.45)');
    const pk = backOut(prog(u, 0, 0.35));
    P.drawPack(ctx, 540, 960, 900 * (0.6 + 0.4 * pk), { rotation: 0.05 * (1 - pk), shine: lerp(-0.4, 1.4, prog(u, 0.3, 1.1)) });
    const tk = prog(u, 0.12, 0.42);
    const sz = fitSize(S.brandFull, 140, 960);
    title(ctx, S.brandFull, 540, 330, sz, { scale: lerp(2.4, 1, easeOut(tk)), alpha: tk, fill: '#ffffff', stroke: '#5a0a0a', strokeWidth: 12 });
    if (u < 0.12) { ctx.fillStyle = `rgba(255,240,200,${1 - u / 0.12})`; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------ scene 5: montage 20-34 s
  const CUTS = [
    { label: S.labels[0], icon: 'tea', bg: ['#c1561e', '#6e2410'], draw: dTea },
    { label: S.labels[1], icon: 'poha', bg: ['#2f8a7a', '#14423c'], draw: dPoha },
    { label: S.labels[2], icon: 'salad', bg: ['#a24a8a', '#4a1a46'], draw: dBhel },
    { label: S.labels[3], icon: 'chili', bg: ['#d0401c', '#5e0e08'], draw: dMisal },
    { label: S.labels[4], icon: 'bus', bg: ['#3a86c8', '#f0b860'], draw: dTravel },
    { label: S.labels[5], icon: 'namaste', bg: ['#d9a520', '#6e4a08'], draw: dGuests },
  ];
  function farsanTop(ctx, x, y, w, grow, seed) {
    const sp = A.farsanSprite(Math.round(w), Math.round(w * 0.42), seed, { grain: Math.max(8, w / 26) });
    const hh = sp.height * grow;
    if (hh < 2) return;
    ctx.drawImage(sp, 0, sp.height - hh, sp.width, hh, x - w / 2, y - hh, w, hh);
  }
  function dTea(ctx, u, t) {
    A.plate(ctx, 650, 1240, 260, '#f4efe6', '#d8cfc0');
    farsanTop(ctx, 650, 1260, 380, 0.5 + 0.5 * prog(u, 0.2, 1.4), 61);
    A.teaGlass(ctx, 330, 1300, 1.7, t);
    A.sprinkle(ctx, t, 20 + 0.15, 20 + 1.6, 650, 160, 560, 1180, 26, 71, 14);
  }
  function dPoha(ctx, u, t) {
    A.plate(ctx, 540, 1180, 380, '#f4efe6', '#d0c7b8');
    A.ellipse(ctx, 540, 1170, 280, 88, '#f2c33a');
    A.scatter(ctx, 540, 1165, 270, 80, 220, 81, (c, x, y, r) => A.granule(c, 'poha', x, y, 15, r() * A.TAU, () => 0.2 + r() * 0.1));
    A.scatter(ctx, 540, 1165, 250, 70, 26, 82, (c, x, y) => A.circle(c, x, y, 9, '#5aa02c'));
    A.scatter(ctx, 540, 1165, 250, 70, 30, 83, (c, x, y, r) => A.granule(c, 'leaf', x, y, 10, r() * A.TAU, r));
    A.lemon(ctx, 820, 1190, 0.9, 0.3);
    farsanTop(ctx, 540, 1180, 340, prog(u, 0.25, 1.6), 62);
    A.sprinkle(ctx, t, 22.33 + 0.15, 22.33 + 1.7, 540, 220, 560, 1130, 30, 72, 13);
  }
  function dBhel(ctx, u, t) {
    A.bowl(ctx, 540, 1130, 340, '#c8ced3', '#e9edf0');
    A.ellipse(ctx, 540, 1110, 300, 82, '#e6d3a6');
    A.scatter(ctx, 540, 1100, 290, 72, 200, 91, (c, x, y, r) => A.ellipse(c, x, y, 13, 7, ['#f4ead2', '#e9dbb6', '#fff6e2'][Math.floor(r() * 3)]));
    A.scatter(ctx, 540, 1100, 280, 68, 120, 92, (c, x, y, r) => A.granule(c, r() < 0.7 ? 'sev' : 'peanut', x, y, 13, r() * A.TAU, r));
    A.scatter(ctx, 540, 1100, 270, 66, 40, 93, (c, x, y, r) => { c.fillStyle = '#b4447a'; c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillRect(-10, -6, 20, 12); c.restore(); });
    A.scatter(ctx, 540, 1100, 270, 66, 34, 94, (c, x, y, r) => { c.fillStyle = '#d6281e'; c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillRect(-11, -8, 22, 16); c.restore(); });
    A.scatter(ctx, 540, 1100, 260, 60, 30, 95, (c, x, y, r) => A.granule(c, 'leaf', x, y, 9, r() * A.TAU, r));
    // lemon squeeze
    const sq = prog(u, 0.3, 0.9);
    A.lemon(ctx, 760, 780 + Math.sin(u * 20) * 4 * sq, 1.4, Math.PI + 0.3);
    if (sq > 0) for (let i = 0; i < 6; i++) { const d = ((u * 2.2 + i / 6) % 1); A.ellipse(ctx, 740 + (i % 3) * 14, 800 + d * 280, 6, 10, `rgba(250,245,170,${0.9 - d * 0.6})`); }
    farsanTop(ctx, 470, 1110, 260, prog(u, 0.2, 1.5), 63);
    A.sprinkle(ctx, t, 24.67 + 0.1, 24.67 + 1.6, 470, 160, 560, 1070, 26, 73, 13);
  }
  function dMisal(ctx, u, t) {
    A.bowl(ctx, 520, 1120, 330, '#3a3a3a', '#7a1c0c');
    const g = ctx.createRadialGradient(480, 1100, 20, 520, 1110, 300);
    g.addColorStop(0, '#e2541e'); g.addColorStop(1, '#8a1e0a');
    A.ellipse(ctx, 520, 1112, 300, 92, g);
    A.scatter(ctx, 520, 1105, 270, 70, 24, 101, (c, x, y, r) => A.ellipse(c, x, y, 10 + r() * 16, 5 + r() * 6, 'rgba(255,180,60,0.55)'));
    A.scatter(ctx, 520, 1100, 220, 60, 30, 102, (c, x, y, r) => { c.fillStyle = '#e8e0f0'; c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillRect(-9, -6, 18, 12); c.restore(); });
    A.scatter(ctx, 520, 1100, 240, 60, 26, 103, (c, x, y, r) => A.granule(c, 'leaf', x, y, 10, r() * A.TAU, r));
    // pav
    for (const [x, y] of [[860, 1330], [960, 1300]]) { ctx.fillStyle = '#c47a32'; A.roundRect(ctx, x - 80, y - 60, 160, 110, 50); ctx.fill(); A.ellipse(ctx, x - 20, y - 30, 50, 18, 'rgba(255,220,160,0.4)'); }
    farsanTop(ctx, 520, 1110, 300, prog(u, 0.2, 1.5), 64);
    A.sprinkle(ctx, t, 27 + 0.1, 27 + 1.6, 520, 200, 560, 1070, 28, 74, 13);
    A.steam(ctx, 400, 1000, 1.6, t, 0.4); A.steam(ctx, 640, 1000, 1.6, t + 0.5, 0.4);
  }
  function dTravel(ctx, u, t) {
    // road + moving bus behind
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(0, 1000, W, 160);
    ctx.fillStyle = '#e8e8e8'; for (let x = -((t * 900) % 200); x < W; x += 200) ctx.fillRect(x, 1075, 100, 12);
    ctx.fillStyle = '#6aa04a'; ctx.fillRect(0, 1160, W, 760);
    A.bus(ctx, lerp(1400, -400, prog(u, 0, 2.3)), 1060, 620, '#c0392b');
    // steel tiffin open with farsan
    const x = 540, y = 1440;
    ctx.fillStyle = '#c9d0d5'; A.roundRect(ctx, x - 300, y - 200, 600, 230, 40); ctx.fill();
    const g = ctx.createLinearGradient(x - 300, 0, x + 300, 0);
    g.addColorStop(0, '#8a9298'); g.addColorStop(0.3, '#eef2f4'); g.addColorStop(1, '#7a8288');
    ctx.fillStyle = g; A.roundRect(ctx, x - 300, y - 210, 600, 220, 40); ctx.fill();
    A.ellipse(ctx, x, y - 210, 300, 60, '#d6dce0');
    A.ellipse(ctx, x, y - 205, 270, 48, '#5a3a20');
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 205, 270, 48, 0, 0, A.TAU); ctx.clip();
    ctx.drawImage(A.farsanSprite(560, 110, 65, { shape: 'flat', grain: 18 }), x - 280, y - 260); ctx.restore();
    farsanTop(ctx, x, y - 200, 420, 0.4 + 0.6 * prog(u, 0.2, 1.5), 66);
    A.sprinkle(ctx, t, 29.33 + 0.1, 29.33 + 1.6, x, 200, 560, 1230, 26, 75, 13);
    // lid leaning behind
    A.ellipse(ctx, 880, 1300, 70, 150, '#b9c0c5');
  }
  function dGuests(ctx, u, t) {
    A.plate(ctx, 540, 1170, 420, '#e6eaed', '#b8c0c6');
    const kat = [[300, 1110, '#f2c33a'], [420, 1060, '#e2541e'], [660, 1060, '#f4efe6'], [780, 1110, '#5aa02c']];
    for (const [x, y, c] of kat) A.bowl(ctx, x, y, 70, '#c8ced3', c);
    farsanTop(ctx, 540, 1230, 330, 0.5 + 0.5 * prog(u, 0.2, 1.4), 67);
    A.teaGlass(ctx, 200, 1460, 0.9, t); A.teaGlass(ctx, 880, 1460, 0.9, t + 0.4);
    A.sprinkle(ctx, t, 31.67 + 0.1, 31.67 + 1.5, 540, 200, 560, 1170, 26, 76, 13);
    // marigold garland across the top
    for (let i = 0; i < 24; i++) { const x = i * 47, y = 610 + Math.sin(i / 23 * Math.PI) * 60; A.circle(ctx, x, y, 22, i % 2 ? '#f39c12' : '#f1c40f'); }
  }
  function sMontage(ctx, t) {
    const lt = t - TL.MONTAGE.start;
    const i = Math.min(5, Math.floor(lt / TL.MONTAGE.cut));
    const u = lt - i * TL.MONTAGE.cut;
    const C = CUTS[i];
    ctx.save();
    // whip pan in + zoom punch
    const whip = 1 - easeOut(prog(u, 0, 0.16));
    const punch = 1 + 0.14 * (1 - easeOut(prog(u, 0, 0.3)));
    const beatU = (lt % TL.BEAT) / TL.BEAT;
    const pulse = 1 + 0.012 * Math.exp(-beatU * 6);
    ctx.translate((i % 2 ? -1 : 1) * whip * 700, 0);
    ctx.translate(540, 1000); ctx.scale(punch * pulse, punch * pulse); ctx.translate(-540, -1000);
    A.vgrad(ctx, -400, -200, W + 800, H + 400, C.bg);
    rays(ctx, 540, 1000, t, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)', 24);
    C.draw(ctx, u, t);
    ctx.restore();
    if (whip > 0.02) { // motion streaks
      ctx.save(); ctx.globalAlpha = whip * 0.6; ctx.fillStyle = '#fff';
      const r = A.rng(i + 1);
      for (let k = 0; k < 40; k++) ctx.fillRect(r() * W, r() * H, 200 + r() * 400, 3 + r() * 6);
      ctx.restore();
    }
    // label with icon
    const lk = backOut(prog(u, 0.08, 0.35));
    if (lk > 0) {
      const sz = 88, tw = T.measure(C.label, sz);
      const pw = tw + 200, ph = 150, px = 540 - pw / 2, py = 300;
      ctx.save(); ctx.translate(540, py + ph / 2); ctx.scale(lk, lk); ctx.translate(-540, -(py + ph / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      pill(ctx, px, py, pw, ph, '#fff8ea');
      ctx.shadowColor = 'transparent';
      A.circle(ctx, px + 78, py + ph / 2, 56, '#9b1418');
      A.icon(ctx, C.icon, px + 78, py + ph / 2, 62, '#fff');
      T.draw(ctx, C.label, px + 150, py + ph / 2, sz, { fill: '#7a1a0c', baseline: 'middle' });
      ctx.restore();
    }
    // brand bug
    ctx.save(); ctx.globalAlpha = 0.9;
    T.draw(ctx, S.brandFull, 540, 520, 40, { fill: '#fff', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 4, align: 'center' }); // below the label pill, inside the safe zone
    ctx.restore();
  }

  // ------------------------------------------------------------------ scene 6: ingredients 34-41 s
  const ING = [
    { name: S.ingredients[0], fill: A.powder('#f0cf6a', '#fff3c4') },
    { name: S.ingredients[1], fill: A.bits('poha', 201, '#f1dc9c') },
    { name: S.ingredients[2], fill: A.bits('dal', 202, '#e8b520') },
    { name: S.ingredients[3], fill: A.bits('masoor', 203, '#d9733a') },
    { name: S.ingredients[4], fill: A.powder('#f2a000', '#ffd34a') },
    { name: S.ingredients[5], fill: A.crystals(204) },
  ];
  function table(ctx) {
    A.vgrad(ctx, 0, 0, W, H, ['#6e3f1e', '#4a2810']);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 3;
    for (let y = 0; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, y + Math.sin(x * 0.01 + y) * 6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < W; x += 270) ctx.fillRect(x, 0, 4, H);
    A.glow(ctx, 540, 850, 900, 'rgba(255,190,110,0.35)');
  }
  function sIngredients(ctx, t) {
    const lt = t - 34;
    table(ctx);
    // scattered whole grains on the table
    const r = A.rng(5);
    for (let i = 0; i < 50; i++) A.granule(ctx, ['dal', 'poha', 'peanut'][i % 3], r() * W, 300 + r() * 1300, 12, r() * A.TAU, r);
    const cols = [200, 540, 880], rows = [640, 1040];
    ING.forEach((ing, i) => {
      const k = prog(lt, 0.25 + i * 0.55, 0.65 + i * 0.55);
      if (k <= 0) return;
      const x = cols[i % 3], y = rows[Math.floor(i / 3)];
      const s = backOut(k);
      ctx.save(); ctx.translate(x, y - (1 - easeOut(k)) * 200); ctx.scale(s, s);
      A.clayBowl(ctx, 0, 0, 140, ing.fill);
      // label tag
      const sz = fitSize(ing.name, 60, 290);
      const tw = T.measure(ing.name, sz) + 50;
      ctx.fillStyle = '#fff6e2'; A.roundRect(ctx, -tw / 2, 125, tw, 86, 22); ctx.fill();
      ctx.strokeStyle = '#9b1418'; ctx.lineWidth = 4; A.roundRect(ctx, -tw / 2 + 6, 131, tw - 12, 74, 18); ctx.stroke();
      T.draw(ctx, ing.name, 0, 168, sz, { fill: '#7a1a0c', align: 'center', baseline: 'middle' });
      ctx.restore();
    });
    // heading: brand bug top
    const hk = prog(lt, 0.1, 0.5);
    title(ctx, S.tagline, 540, 330, fitSize(S.tagline, 80, 900), { alpha: hk, fill: '#ffd98a', stroke: '#3a1a08' });
    // highlight "साधं, घरचं, अस्सल." with a warm glow
    if (lt > 5.4) A.glow(ctx, 540, 850, 700, `rgba(255,210,120,${0.25 * prog(lt, 5.4, 6)})`);
    // whip-in from the montage
    if (lt < 0.2) { ctx.fillStyle = `rgba(255,250,235,${1 - lt / 0.2})`; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------ scene 7: family 41-47 s
  function sFamily(ctx, t) {
    const lt = t - 41;
    A.vgrad(ctx, 0, 0, W, H, ['#c9773a', '#a85a28', '#6e3618']);
    // framed picture + lamp
    ctx.fillStyle = '#5a3418'; ctx.fillRect(400, 300, 280, 220);
    ctx.fillStyle = '#e8c27a'; ctx.fillRect(420, 320, 240, 180);
    A.circle(ctx, 540, 400, 50, '#d9a520'); A.line(ctx, [470, 470, 610, 470], '#9b1418', 14);
    A.line(ctx, [540, 300, 540, 250], '#3a2010', 4);
    // hanging lamp left
    A.line(ctx, [180, 0, 180, 300], '#3a2010', 5);
    A.ellipse(ctx, 180, 330, 80, 40, '#d4a02a');
    A.glow(ctx, 180, 380, 700, 'rgba(255,200,110,0.55)');
    // floor and mat
    A.vgrad(ctx, 0, 1150, W, 770, ['#7a4420', '#4a2810']);
    ctx.fillStyle = '#9b1418'; ctx.beginPath(); ctx.ellipse(540, 1420, 560, 230, 0, 0, A.TAU); ctx.fill();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(540, 1420, 520, 200, 0, 0, A.TAU); ctx.stroke();
    const laugh = i => Math.sin(t * 7 + i * 1.7) * 10;
    const reach = (i, ph) => { const k = (Math.sin(t * 1.6 + ph) + 1) / 2; return k > 0.8 ? (k - 0.8) / 0.2 : 0; };
    // back row
    A.person(ctx, 230, 1200, 0.7, { kind: 'dad', pose: 'sit', facing: 1, t, mouth: 'laugh', eyes: 'happy', bob: laugh(0), armR: [40 + reach(0, 0) * 50, 40], armL: [10, 30], blinkSeed: 5 });
    A.person(ctx, 850, 1200, 0.7, { kind: 'mom', pose: 'sit', facing: -1, t, mouth: 'laugh', eyes: 'happy', bob: laugh(1), armR: [50, 70], armL: [10, 30], blinkSeed: 6 });
    const aj = A.person(ctx, 540, 1150, 0.72, { kind: 'aaji', pose: 'sit', facing: 1, t, mouth: 'laugh', eyes: 'happy', bob: laugh(2), armR: [55 + reach(2, 2) * 40, 50], armL: [50, 60], blinkSeed: 7 });
    // plate in the middle
    A.plate(ctx, 540, 1380, 230, '#e6eaed', '#b8c0c6');
    farsanTop(ctx, 540, 1395, 280, 1, 68);
    A.teaGlass(ctx, 330, 1420, 0.7, t); A.teaGlass(ctx, 750, 1420, 0.7, t + 0.3); A.teaGlass(ctx, 430, 1490, 0.7, t + 0.6);
    // front row
    const man = A.person(ctx, 160, 1580, 0.78, { kind: 'man', pose: 'sit', facing: 1, t, mouth: 'laugh', eyes: 'happy', bob: laugh(3), armR: [70 + reach(3, 4) * 50, 30], armL: [10, 20], blinkSeed: 8 });
    A.person(ctx, 900, 1600, 0.95, { kind: 'kid', pose: 'sit', facing: -1, t, mouth: 'laugh', eyes: 'happy', bob: laugh(4), armR: [90, -20], armL: [10, 20], blinkSeed: 9 });
    heldBit(ctx, man.handR[0], man.handR[1] - 10, 0.7, 41);
    // warm steam + grade
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,160,60,0.4)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    A.vignette(ctx, 0, 'rgba(60,20,0,0.6)');
    if (lt < 0.4) { ctx.fillStyle = `rgba(250,240,220,${1 - lt / 0.4})`; ctx.fillRect(0, 0, W, H); }
    if (lt > 5.7) { ctx.fillStyle = `rgba(20,4,2,${prog(lt, 5.7, 6)})`; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------ scene 8: hero 47-55 s
  function bokeh(ctx, t, seed, n) {
    const r = A.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, rad = 10 + r() * 40, sp = 10 + r() * 30;
      A.circle(ctx, x + Math.sin(t * 0.3 + i) * 20, (y - t * sp) % H + (y - t * sp < 0 ? H : 0), rad, `rgba(255,200,110,${0.05 + r() * 0.12})`);
    }
  }
  function sHero(ctx, t) {
    const lt = t - 47;
    A.vgrad(ctx, 0, 0, W, H, ['#7a0e12', '#4a0608', '#2a0404']);
    rays(ctx, 400, 760, t, 'rgba(255,190,100,0.08)', 'rgba(255,190,100,0)', 24);
    bokeh(ctx, t, 3, 26);
    A.glow(ctx, 420, 760, 800, 'rgba(255,170,80,0.4)');
    // table surface
    A.vgrad(ctx, 0, 1150, W, 770, ['#5a2a12', '#2a1206']);
    // pot + tea
    const pk = easeOut(prog(lt, 0.2, 0.8));
    ctx.save(); ctx.globalAlpha = pk;
    A.clayPot(ctx, 830, 820 + (1 - pk) * 80, 150, { seed: 91 });
    ctx.restore();
    // pack slides in
    const k = backOut(prog(lt, 0, 0.7));
    const shine = lt < 2.5 ? lerp(-0.4, 1.4, prog(lt, 0.9, 2.1)) : lerp(-0.4, 1.4, prog(lt, 6.0, 7.2));
    P.drawPack(ctx, 390, 750 + (1 - k) * 1200, 790, { rotation: -0.05, shine });
    const tk = easeOut(prog(lt, 0.5, 0.9));
    if (tk > 0) A.teaGlass(ctx, 880, 1180 + (1 - tk) * 40, 1.0, t);
    // ५०० ग्रॅम sticker
    const sk = backOut(prog(lt, 1.0, 1.4));
    if (sk > 0) {
      ctx.save(); ctx.translate(140, 400); ctx.scale(sk, sk); ctx.rotate(-0.2);
      starburst(ctx, 0, 0, 108, 90, 14, '#f2c14e');
      T.draw(ctx, S.weight, 0, 0, fitSize(S.weight, 54, 170), { fill: '#7a0e12', align: 'center', baseline: 'middle' });
      ctx.restore();
    }
    // shops line top
    const shk = prog(lt, 1.4, 1.8);
    if (shk > 0) {
      const sz = fitSize(S.shops, 42, 860);
      ctx.save(); ctx.globalAlpha = shk;
      const tw = T.measure(S.shops, sz) + 60;
      pill(ctx, 540 - tw / 2, 268, tw, 70, 'rgba(0,0,0,0.45)');
      T.draw(ctx, S.shops, 540, 303, sz, { fill: '#ffe9c0', align: 'center', baseline: 'middle' });
      ctx.restore();
    }
    // price card
    const ck = prog(lt, 3.9, 4.3);
    if (ck > 0) {
      ctx.save(); ctx.globalAlpha = ck; ctx.translate(0, (1 - easeOut(ck)) * 60);
      if (PRICE_CONFIG.showMrp) {
        const ms = 62, mw = T.measure(PRICE_CONFIG.mrp, ms);
        T.draw(ctx, PRICE_CONFIG.mrp, 540, 1240, ms, { fill: '#ffffff', stroke: '#3a0404', strokeWidth: 5, align: 'center', baseline: 'middle' });
        const sk2 = easeOut(prog(lt, 4.3, 4.6));
        A.line(ctx, [540 - mw / 2 - 14, 1250, 540 - mw / 2 - 14 + (mw + 28) * sk2, 1250 - 14 * sk2], '#ff3b30', 7);
      }
      const os = fitSize(PRICE_CONFIG.offer, 100, 900);
      const ok = backOut(prog(lt, 4.5, 4.9));
      title(ctx, PRICE_CONFIG.offer, 540, 1350, os, { scale: ok, fill: '#ffd23a', stroke: '#3a0404', strokeWidth: 10 });
      // CTA + phone row
      const rk = prog(lt, 5.0, 5.4);
      ctx.globalAlpha = ck * rk;
      const pulse = 1 + 0.05 * Math.sin(lt * 8);
      ctx.save(); ctx.translate(290, 1455); ctx.scale(pulse, pulse);
      ctx.shadowColor = 'rgba(255,210,60,0.7)'; ctx.shadowBlur = 30;
      pill(ctx, -220, -48, 440, 96, '#ffd23a');
      ctx.shadowColor = 'transparent';
      T.draw(ctx, S.cta, 0, 0, fitSize(S.cta, 64, 380), { fill: '#7a0e12', align: 'center', baseline: 'middle' });
      ctx.restore();
      pill(ctx, 540, 1407, 470, 96, 'rgba(255,255,255,0.95)');
      A.circle(ctx, 590, 1455, 36, '#1f9d55');
      A.icon(ctx, 'phone', 590, 1455, 42, '#fff');
      ctx.fillStyle = '#2a0404'; ctx.font = '800 52px "Noto Sans"'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(S.phone, 640, 1458);
      ctx.restore();
    }
    subtitles(ctx, t);
    if (lt < 0.3) { ctx.fillStyle = `rgba(20,4,2,${1 - lt / 0.3})`; ctx.fillRect(0, 0, W, H); }
  }
  function starburst(ctx, x, y, r1, r2, n, fill) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? r2 : r1; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    A.circle(ctx, x, y, r2 - 10, '#fff3d6');
  }

  // ------------------------------------------------------------------ scene 9: end card 55-57 s
  function sEnd(ctx, t) {
    const lt = t - 55;
    A.vgrad(ctx, 0, 0, W, H, ['#9a1216', '#5a0a0c', '#2a0404']);
    rays(ctx, 540, 820, t * 2, 'rgba(255,200,80,0.12)', 'rgba(255,200,80,0)', 28);
    A.glow(ctx, 540, 820, 800, 'rgba(255,190,80,0.5)');
    // bhandara (turmeric) burst
    const r = A.rng(55);
    for (let i = 0; i < 260; i++) {
      const a = r() * A.TAU, v = 300 + r() * 1100, s = 3 + r() * 9, d = Math.max(0, lt - 0.05 - r() * 0.15);
      const drag = (1 - Math.exp(-d * 2.2)) / 2.2;
      const x = 540 + Math.cos(a) * v * drag, y = 820 + Math.sin(a) * v * drag + 120 * d * d;
      A.circle(ctx, x, y, s, `rgba(${240 + Math.floor(r() * 15)},${170 + Math.floor(r() * 50)},${20 + Math.floor(r() * 30)},${clamp(1 - d * 0.35)})`);
    }
    const k = backOut(prog(lt, 0, 0.45));
    // badge
    ctx.save(); ctx.translate(540, 760); ctx.scale(k, k);
    const bw = 760, bh = 260;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#c4161c';
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 50, -bh / 2); ctx.lineTo(bw / 2 - 50, -bh / 2); ctx.quadraticCurveTo(bw / 2 + 40, 0, bw / 2 - 50, bh / 2);
    ctx.lineTo(-bw / 2 + 50, bh / 2); ctx.quadraticCurveTo(-bw / 2 - 40, 0, -bw / 2 + 50, -bh / 2); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 8; ctx.stroke();
    T.draw(ctx, S.brand, 0, 0, fitSize(S.brand, 190, bw - 160), { fill: '#fff', align: 'center', baseline: 'middle' });
    ctx.restore();
    const pk = easeOut(prog(lt, 0.25, 0.6));
    title(ctx, S.product, 540, 1010, 150, { alpha: pk, scale: 0.8 + 0.2 * pk, fill: '#f6c56b', stroke: '#3a0404', strokeWidth: 10 });
    const ek = easeOut(prog(lt, 0.55, 0.95));
    const sz = 78, lines = T.wrap(S.end, sz, 920);
    lines.forEach((l, i) => title(ctx, l, 540, 1220 + i * T.lineHeight(sz), sz, { alpha: ek, scale: 0.9 + 0.1 * ek, fill: '#ffe9a8', stroke: '#3a0404', strokeWidth: 8 }));
    if (lt < 0.15) { ctx.fillStyle = `rgba(255,230,150,${1 - lt / 0.15})`; ctx.fillRect(0, 0, W, H); }
    if (lt > 1.75) { ctx.fillStyle = `rgba(0,0,0,${prog(lt, 1.75, 2.0) * 0.6})`; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------ dispatcher
  const DRAW = { hook: sHook, city: sCity, flashback: sFlash, present: sPresent, montage: sMontage, ingredients: sIngredients, family: sFamily, hero: sHero, end: sEnd };
  function drawScene(ctx, t) {
    const sc = TL.scene(t);
    DRAW[sc.id](ctx, t);
    if (sc.id !== 'hero') subtitles(ctx, t);
  }
  function draw(ctx, t) {
    ctx.save();
    // hook -> city crossfade
    if (t >= 3 && t < 3.35) {
      sHook(ctx, 2.999);
      ctx.globalAlpha = prog(t, 3, 3.35);
      const b = renderTo(offscreen(), sCity, t);
      ctx.drawImage(b, 0, 0);
      ctx.globalAlpha = 1;
      subtitles(ctx, t);
    } else if (t >= 7.7 && t < 8.5) {
      // dreamy ripple + blur into the flashback
      const out = t < 8;
      const k = out ? prog(t, 7.7, 8) : 1 - prog(t, 8, 8.5);
      const b = renderTo(offscreen(), out ? sCity : sFlash, t);
      ctx.drawImage(b, 0, 0); // fills the edges the ripple uncovers
      ripple(ctx, b, k, t);
      // cheap dreamy blur: blend in a downscaled copy (ctx.filter blur is very slow on the CPU canvas)
      if (!small) small = new OffscreenCanvas(135, 240);
      const sg = small.getContext('2d');
      sg.imageSmoothingQuality = 'high';
      sg.drawImage(b, 0, 0, 135, 240);
      ctx.save(); ctx.globalAlpha = k * 0.85; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small, 0, 0, W, H); ctx.restore();
      ctx.fillStyle = `rgba(255,214,140,${0.55 * k})`; ctx.fillRect(0, 0, W, H);
      subtitles(ctx, t);
    } else if (t >= 41 && t < 41.5) {
      sIngredients(ctx, 40.999);
      ctx.globalAlpha = prog(t, 41, 41.5);
      ctx.drawImage(renderTo(offscreen(), sFamily, t), 0, 0);
      ctx.globalAlpha = 1;
    } else {
      drawScene(ctx, t);
    }
    ctx.restore();
  }

  window.REEL = {
    duration: TL.DURATION,
    fps: 30,
    bitrate: 10_000_000,
    draw,
    buildAudio: sr => window.ReelAudio.build(sr),
    async init() {
      const mode = await P.init();
      console.log('pack graphic: ' + mode);
      if (window.ReelAudio.init) await window.ReelAudio.init();
    },
  };
})();
