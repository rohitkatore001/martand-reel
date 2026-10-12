/*
 * deva.js - a tiny self-contained Devanagari (Marathi) text engine.
 *
 * The machine this reel was built on has no Devanagari font and no network, so every
 * Marathi letter is drawn from hand-authored stroke skeletons (SVG path syntax) on a
 * fixed grid and stroked with a thick round pen, giving a clean bold monoline style.
 *
 * Grid (font units, 1000 = font size):
 *   y = 0     shirorekha (headline) centre line
 *   y = 560   bottom of the letter body (baseline)
 *   y < 0     top marks (matra hooks, e-matra, anusvara, reph, candra)
 *   y > 560   bottom marks (u / uu / ru matras, virama, rakar)
 *
 * Mini shaper: syllable clustering, i-matra reordering, reph, rakar, half forms,
 * explicit-virama fallback for letters without a half form, matra/mark positioning,
 * continuous headline per word. Latin/ASCII runs (digits, +91, MRP) are drawn with
 * ctx.fillText using Noto Sans Bold.
 *
 * API (all sizes in px; x,y in canvas px):
 *   Deva.measure(text, size)                      -> width in px
 *   Deva.draw(ctx, text, x, y, size, opts)        -> width in px
 *       opts: { fill, stroke, strokeWidth (px outline), align: 'left'|'center'|'right',
 *               baseline: 'headline'|'middle'|'bottom', weight (pen multiplier, default 1),
 *               latinFont }
 *   Deva.wrap(text, size, maxWidth)              -> [lines]
 *   Deva.lineHeight(size)                         -> recommended line advance in px
 * Works in browsers (Path2D) and is loadable in Node for layout checks (measure/wrap/shape).
 */
(function (root) {
  'use strict';

  const PEN = 84;          // stroke width in font units
  const BODY = 560;        // headline to baseline
  const SPACE = 300;       // word space
  const LATIN_SCALE = 0.80; // Latin font px = size * LATIN_SCALE (caps ~ body height)

  // ---------------------------------------------------------------- glyphs
  // a: advance, s: x of the right vertical stem (null if none), d: body path (stem excluded),
  // h: optional explicit half form {a, d}; hl: headline segments; bx/tx: anchors for marks;
  // noHalf: use explicit virama in conjuncts; bot: lowest y of letter (for bottom marks).
  const G = {
    // ---- consonants
    'क': { a: 560, s: null, bx: 280, tx: 300,
      d: 'M280 0 L280 560 M280 300 C230 200 80 200 80 310 C80 410 200 420 280 320 M280 320 C330 240 480 240 480 340 C480 430 410 470 340 445',
      h: { a: 440, d: 'M280 0 L280 560 M280 300 C230 200 80 200 80 310 C80 410 200 420 280 320 M280 320 C320 270 390 262 440 275' } },
    'ख': { a: 640, s: 550,
      d: 'M100 0 L100 110 C100 200 225 205 235 290 C245 390 130 420 100 360 M550 230 C450 140 265 170 255 290 C250 410 400 440 550 340' },
    'ग': { a: 470, s: 390, d: 'M140 0 L140 340 C140 410 100 430 60 400' },
    'घ': { a: 540, s: 450,
      d: 'M100 0 L100 170 C100 250 220 260 220 190 C220 130 120 140 110 230 C100 350 170 420 280 410 C360 400 420 360 450 330' },
    'ङ': { a: 500, s: null, bx: 240, tx: 260,
      d: 'M150 0 L150 110 C150 200 390 190 390 340 C390 480 270 540 180 500 C120 470 130 400 190 410 M440 300 L441 300' },
    'च': { a: 520, s: 430, d: 'M430 330 L230 330 C170 330 170 180 120 180 C70 180 70 280 80 400' },
    'छ': { a: 520, s: null, bx: 260, tx: 300, noHalf: true,
      d: 'M160 0 L160 110 C160 190 380 180 390 300 C400 420 300 470 220 450 C140 430 130 330 210 310 C260 300 300 330 300 370' },
    'ज': { a: 580, s: 490, d: 'M100 0 C300 0 310 230 120 250 L210 400 L490 400 M210 400 C170 450 150 500 180 540' },
    'झ': { a: 600, s: 510,
      d: 'M120 0 L120 90 C120 170 320 160 320 260 C320 350 230 380 170 360 M320 260 L510 260 M200 380 C230 440 280 480 340 480' },
    'ञ': { a: 560, s: 470, d: 'M400 300 L180 300 C120 300 90 250 100 190 M180 300 C140 330 120 400 160 460 M300 300 L300 420' },
    'ट': { a: 560, s: null, bx: 280, tx: 300, noHalf: true, d: 'M270 0 L270 200 C400 170 490 260 480 370 C470 480 380 545 270 540 C190 537 140 515 110 490' },
    'ठ': { a: 480, s: null, bx: 240, tx: 280, noHalf: true,
      d: 'M220 0 L220 110 C100 110 70 230 70 330 C70 460 160 540 250 540 C350 540 410 450 410 330 C410 200 330 110 220 110' },
    'ड': { a: 560, s: null, bx: 280, tx: 300, noHalf: true, d: 'M270 0 L270 200 C400 170 490 260 480 370 C470 480 380 545 270 540 C170 535 110 480 120 420 C130 370 200 370 210 420' },
    'ढ': { a: 480, s: null, bx: 250, tx: 280, noHalf: true,
      d: 'M150 0 L150 110 C150 200 390 190 390 330 C390 460 270 510 190 490 C130 470 140 400 200 410 M290 500 C320 570 380 600 430 580' },
    'ण': { a: 680, s: 600, d: 'M70 0 C290 0 290 210 70 210 L250 520 M200 280 L600 280 M400 280 L400 560' }, // र-like bowl + crossbar + middle leg
    'त': { a: 470, s: 390, d: 'M390 280 L200 280 C120 280 90 350 110 420 C130 480 200 500 250 470' },
    'थ': { a: 540, s: 450, hl: [[230, 540]],
      d: 'M120 140 C120 50 240 50 240 120 C240 180 150 200 120 160 L120 290 C120 390 200 420 300 400 C360 390 420 360 450 330' },
    'द': { a: 470, s: null, bx: 230, tx: 280, noHalf: true,
      d: 'M160 0 L160 100 C160 180 380 170 380 280 C380 380 260 410 180 380 M250 400 C300 450 360 510 420 560' },
    'ध': { a: 540, s: 450, hl: [[250, 540]],
      d: 'M120 130 C120 40 250 40 245 120 C240 190 150 200 120 160 C140 260 300 300 450 320' },
    'न': { a: 480, s: 400, d: 'M400 290 L200 290 C140 290 110 330 110 390 C110 440 80 470 50 460' },
    'प': { a: 480, s: 400, d: 'M110 0 L110 250 C110 340 170 380 260 370 C330 360 380 330 400 300' },
    'फ': { a: 640, s: null, bx: 400, tx: 400,
      d: 'M400 0 L400 560 M110 0 L110 250 C110 340 170 380 260 370 C330 360 380 330 400 300 M400 300 C460 230 570 250 570 340 C570 420 490 450 450 420',
      h: { a: 470, d: 'M400 0 L400 560 M110 0 L110 250 C110 340 170 380 260 370 C330 360 380 330 400 300 M400 300 C430 270 460 265 480 270' } },
    'ब': { a: 500, s: 410, d: 'M100 0 L100 300 C100 430 270 450 410 330 M100 20 C200 70 330 170 410 250' },
    'भ': { a: 560, s: 470, hl: [[240, 560]],
      d: 'M110 120 C110 40 230 40 225 110 C220 165 130 160 110 120 L110 300 C110 370 200 380 250 320 L470 320' },
    'म': { a: 560, s: 470, d: 'M110 0 L110 330 C110 460 300 470 310 340 C315 250 210 230 175 290 C150 330 190 360 240 360 L470 360' },
    'य': { a: 540, s: 450, d: 'M150 190 C90 190 80 120 130 100 C170 85 200 130 180 170 L120 260 C110 350 180 390 280 380 C350 370 420 340 450 310' },
    'र': { a: 420, s: null, bx: 330, tx: 220, noHalf: true, hl: [[40, 300]], d: 'M100 0 C390 0 390 300 100 300 L370 560' },
    'ल': { a: 600, s: 510, d: 'M110 0 C110 90 270 90 270 170 C270 250 120 250 120 170 M120 230 C40 300 70 490 200 490 C290 490 320 440 330 390 L510 390' },
    'ळ': { a: 600, s: null, bx: 300, tx: 320, d: 'M110 0 C110 90 270 90 270 170 C270 250 120 250 120 170 M120 230 C40 300 70 490 200 490 C330 490 420 420 460 330 C490 250 500 170 480 110' },
    'व': { a: 500, s: 410, d: 'M410 230 C300 120 100 160 100 300 C100 430 270 450 410 330' },
    'श': { a: 540, s: 450, hl: [[240, 540]],
      d: 'M110 150 C110 60 250 60 250 150 C250 230 130 240 120 330 C230 340 330 340 450 330 M220 335 C190 420 170 480 150 540' },
    'ष': { a: 480, s: 400, d: 'M110 0 L110 250 C110 340 170 380 260 370 C330 360 380 330 400 300 M110 110 L320 360' },
    'स': { a: 600, s: 510,
      d: 'M120 0 L120 100 C120 190 330 180 330 300 C330 420 220 460 150 430 C100 400 110 340 170 350 M330 300 L510 300' },
    'ह': { a: 480, s: null, bx: 230, tx: 280, noHalf: true, d: 'M110 0 C350 0 360 250 160 260 M210 260 L150 450 C140 535 250 545 310 490' },

    // ---- independent vowels (others are composed below)
    'अ': { a: 600, s: 510, d: 'M90 70 C230 30 280 170 150 230 C280 230 300 400 160 460 C120 480 90 460 80 430 M190 260 L510 260' },
    'इ': { a: 460, s: null, bx: 230, tx: 240,
      d: 'M150 0 L150 80 C150 180 320 150 320 280 C320 380 220 400 160 370 M220 390 C300 450 300 560 200 620' },
    'उ': { a: 460, s: null, bx: 230, tx: 260,
      d: 'M110 40 C300 40 300 280 130 290 C330 300 380 520 240 560 C160 580 120 540 120 520' },
    'ए': { a: 440, s: null, bx: 220, tx: 300,
      d: 'M330 0 L110 230 C60 290 120 360 250 340 L330 330 M270 345 C290 410 290 470 270 520' },
    'ऋ': { a: 520, s: null, bx: 260, tx: 300,
      d: 'M110 0 L110 100 C110 190 290 190 290 290 C290 400 140 430 100 390 M300 300 L460 300 M380 300 L380 560' },

    // ---- signs drawn as glyphs
    'ा': { a: 170, s: null, bx: 70, tx: 70, stem: 70, d: 'M70 0 L70 560' },
    '्': null, // handled by shaper
    // Devanagari digits (no headline)
    '०': { a: 460, hl: [], d: 'M230 110 C340 110 390 210 390 320 C390 430 330 520 230 520 C130 520 70 430 70 320 C70 210 120 110 230 110' },
    '१': { a: 460, hl: [], d: 'M240 330 C110 330 90 140 220 110 C350 90 380 260 290 340 C230 400 250 470 360 540' },
    '२': { a: 460, hl: [], d: 'M100 160 C120 70 330 60 340 170 C350 270 210 300 130 300 C230 300 330 370 400 530' },
    '३': { a: 460, hl: [], d: 'M100 120 C150 40 330 60 320 160 C310 230 230 250 170 250 C300 250 350 330 320 400 C300 450 250 470 200 470 C280 480 340 510 400 560' },
    '४': { a: 460, hl: [], d: 'M240 300 C110 230 110 90 220 90 C320 90 330 210 240 300 C170 380 170 520 270 520 C360 520 390 430 340 380' },
    '५': { a: 460, hl: [], d: 'M100 80 L100 260 C100 330 230 330 340 300 M340 80 L340 330 C340 440 260 530 150 510' },
    '६': { a: 460, hl: [], d: 'M330 90 C200 60 110 150 170 220 C230 280 360 270 360 380 C360 490 230 530 120 470' },
    '७': { a: 460, hl: [], d: 'M80 110 C140 300 210 520 280 520 C350 520 390 330 390 90' },
    '८': { a: 460, hl: [], d: 'M70 530 C140 300 190 110 230 110 C280 110 330 300 400 530' },
    '९': { a: 460, hl: [], d: 'M300 230 C300 100 110 100 110 230 C110 340 280 340 300 240 C320 380 270 470 160 540' },
    '₹': { a: 480, hl: [], d: 'M80 50 L410 50 M80 170 L410 170 M150 50 C420 50 420 300 150 300 L400 560' },
    // punctuation (breaks the headline)
    '।': { a: 220, hl: [], d: 'M110 -30 L110 560' },
    '॥': { a: 320, hl: [], d: 'M100 -30 L100 560 M220 -30 L220 560' },
    ',': { a: 200, hl: [], d: 'M110 510 C120 570 100 620 70 650' },
    '.': { a: 220, hl: [], d: 'M110 520 L111 520' },
    '!': { a: 240, hl: [], d: 'M120 30 L120 370 M120 520 L121 520' },
    '?': { a: 400, hl: [], d: 'M80 150 C80 40 310 30 310 160 C310 260 190 270 190 380 M190 520 L191 520' },
    '…': { a: 520, hl: [], d: 'M100 520 L101 520 M260 520 L261 520 M420 520 L421 520' },
    '-': { a: 320, hl: [], d: 'M70 300 L250 300' },
    '–': { a: 420, hl: [], d: 'M70 300 L350 300' },
    '—': { a: 420, hl: [], d: 'M70 300 L350 300' },
    ':': { a: 220, hl: [], d: 'M110 230 L111 230 M110 520 L111 520' },
    ';': { a: 220, hl: [], d: 'M110 230 L111 230 M110 510 C120 570 100 620 70 650' },
    '\'': { a: 180, hl: [], d: 'M90 -40 L90 120' },
    '‘': { a: 200, hl: [], d: 'M120 -40 C70 0 70 60 100 120' },
    '’': { a: 200, hl: [], d: 'M80 -40 C130 0 130 60 100 120' },
    '"': { a: 260, hl: [], d: 'M80 -40 L80 120 M180 -40 L180 120' },
    '“': { a: 300, hl: [], d: 'M120 -40 C70 0 70 60 100 120 M220 -40 C170 0 170 60 200 120' },
    '”': { a: 300, hl: [], d: 'M80 -40 C130 0 130 60 100 120 M180 -40 C230 0 230 60 200 120' },
    '(': { a: 240, hl: [], d: 'M170 -60 C40 120 40 480 170 660' },
    ')': { a: 240, hl: [], d: 'M70 -60 C200 120 200 480 70 660' },
    '/': { a: 300, hl: [], d: 'M240 -40 L60 620' },
  };

  // compositions for vowels that are written as base + sign in Marathi
  const COMPOSE = {
    'आ': ['अ', 'ा'], 'ओ': ['अ', 'ो'], 'औ': ['अ', 'ौ'], 'ऑ': ['अ', 'ॉ'], 'ॲ': ['अ', 'ॅ'],
    'ऐ': ['ए', 'े'], 'ई': ['इ', 'ई'], 'ऊ': ['उ', 'ऊ'], 'ऍ': ['ए', 'ॅ'],
  };

  const VIRAMA = '\u094D', ZWJ = '\u200D', ZWNJ = '\u200C', NUKTA = '\u093C';
  const MATRAS = 'ािीुूृॄेैोौॅॉॆॊ';
  const MODS = 'ंँः';
  const isCons = c => (c >= '\u0915' && c <= '\u0939') || c === 'ळ' || (c >= '\u0958' && c <= '\u095F');
  const isDevaChar = c => (c >= '\u0900' && c <= '\u097F') || c === '₹' || c === ZWJ || c === ZWNJ ||
    (G[c] && G[c].hl && G[c].hl.length === 0 && !/[0-9A-Za-z]/.test(c));

  // nukta forms map to base letters (dot drawn separately)
  const NUKTA_BASE = { 'क़': 'क', 'ख़': 'ख', 'ग़': 'ग', 'ज़': 'ज', 'ड़': 'ड', 'ढ़': 'ढ', 'फ़': 'फ', 'य़': 'य' };

  function gl(c) {
    const g = G[c];
    if (!g) return null;
    if (!g._n) {
      g.hl = g.hl || [[0, g.a]];
      if (g.s != null) { g.bx = g.bx != null ? g.bx : g.s; g.tx = g.tx != null ? g.tx : g.s; }
      g.bx = g.bx != null ? g.bx : g.a / 2;
      g.tx = g.tx != null ? g.tx : g.a * 0.6;
      g.full = g.s != null ? `${g.d} M${g.s} 0 L${g.s} ${BODY}` : g.d;
      g._n = true;
    }
    return g;
  }

  // ---------------------------------------------------------------- shaping
  // Splits a Devanagari run into syllables.
  function syllables(chars) {
    const out = [];
    let i = 0;
    while (i < chars.length) {
      let c = chars[i];
      if (c === ZWJ || c === ZWNJ || c === NUKTA) { i++; continue; }
      if (NUKTA_BASE[c]) c = NUKTA_BASE[c];
      const syl = { cons: [], base: null, matra: null, mods: [], reph: false, finalVirama: false, nukta: false };
      if (isCons(c)) {
        syl.cons.push(c); i++;
        if (chars[i] === NUKTA) { syl.nukta = true; i++; }
        while (chars[i] === VIRAMA) {
          let j = i + 1;
          if (chars[j] === ZWJ || chars[j] === ZWNJ) j++;
          let n = chars[j];
          if (n && NUKTA_BASE[n]) n = NUKTA_BASE[n];
          if (n && isCons(n)) { syl.cons.push(n); i = j + 1; if (chars[i] === NUKTA) i++; }
          else { syl.finalVirama = true; i++; break; }
        }
      } else if (COMPOSE[c]) {
        syl.base = COMPOSE[c][0];
        syl.matra = COMPOSE[c][1];
        i++;
      } else {
        syl.base = c; i++;
      }
      if (!syl.matra && chars[i] && MATRAS.includes(chars[i])) { syl.matra = chars[i]; i++; }
      while (chars[i] && MODS.includes(chars[i])) { syl.mods.push(chars[i]); i++; }
      if (chars[i] === VIRAMA) { syl.finalVirama = true; i++; }
      // reph: र + virama + consonant
      if (syl.cons.length > 1 && syl.cons[0] === 'र') { syl.reph = true; syl.cons.shift(); }
      out.push(syl);
    }
    return out;
  }

  // Path generators for marks (absolute coordinates in syllable space).
  const M = {
    iHook: (x0, T) => `M${x0} ${BODY} L${x0} 0 C${x0} -150 ${x0 + 0.2 * (T - x0)} -245 ${(x0 + T) / 2} -245 C${T - 0.15 * (T - x0)} -245 ${T} -175 ${T} -45`,
    iiHook: (x0, L) => `M${x0} ${BODY} L${x0} 0 C${x0} -150 ${x0 - 0.2 * (x0 - L)} -245 ${(x0 + L) / 2} -245 C${L + 0.15 * (x0 - L)} -245 ${L} -175 ${L} -45`,
    e: x => `M${x} -20 C${x - 40} -110 ${x - 110} -185 ${x - 180} -225`,
    candra: x => `M${x - 200} -210 C${x - 185} -80 ${x - 15} -80 ${x} -210`,
    dot: (x, y) => `M${x - 2} ${y} L${x + 2} ${y}`,
    reph: x => `M${x - 70} -30 C${x - 90} -150 ${x - 20} -235 ${x + 95} -205`,
    virama: (x, y0) => `M${x + 20} ${y0 + 40} L${x - 100} ${y0 + 170}`,
    u: (x, y0) => `M${x} ${y0} L${x} ${y0 + 40} C${x - 30} ${y0 + 110} ${x - 170} ${y0 + 110} ${x - 160} ${y0 + 190} C${x - 150} ${y0 + 260} ${x - 20} ${y0 + 250} ${x + 50} ${y0 + 210}`,
    uu: (x, y0) => `M${x} ${y0} L${x} ${y0 + 40} C${x + 150} ${y0 + 40} ${x + 180} ${y0 + 130} ${x + 120} ${y0 + 190} C${x + 70} ${y0 + 240} ${x - 30} ${y0 + 240} ${x - 70} ${y0 + 200}`,
    ru: (x, y0) => `M${x} ${y0 + 20} C${x - 40} ${y0 + 90} ${x - 120} ${y0 + 140} ${x - 170} ${y0 + 110} M${x - 20} ${y0 + 60} C${x + 30} ${y0 + 110} ${x + 70} ${y0 + 130} ${x + 110} ${y0 + 120}`,
    rakarStem: s => `M${s} 370 L${s - 160} 500`,
    rakarCaret: x => `M${x - 110} 700 L${x} 610 L${x + 110} 700`,
  };

  // Lay out one syllable at origin 0. Returns {a, paths:[str], hl:[[x0,x1]]}
  function laySyllable(syl) {
    const paths = [], hl = [];
    let x = 0;
    const put = (g, d, adv) => {
      const off = x;
      paths.push(shift(d, off));
      for (const [a, b] of g.hl) hl.push([a + off, Math.min(b, adv) + off]);
      x += adv;
      return off;
    };
    const matra = syl.matra;
    const preI = matra === 'ि';
    const I_W = 150;
    if (preI) x += I_W;

    let last = null, lastOff = 0, lastHasRakar = false;
    let lowY = BODY; // bottom of drawn body for bottom marks
    let cons = syl.cons.slice();
    let rakar = false;
    if (cons.length > 1 && cons[cons.length - 1] === 'र') { rakar = true; cons.pop(); }

    if (cons.length) {
      for (let k = 0; k < cons.length; k++) {
        const g = gl(cons[k]) || gl('क');
        const isLast = k === cons.length - 1;
        if (isLast) {
          lastOff = put(g, g.full, g.a);
          last = g;
        } else if (g.h) {
          put(g, g.h.d, g.h.a);
        } else if (g.s != null && !g.noHalf) {
          put(g, g.d, g.s + 20);
        } else {
          // explicit virama fallback
          const off = put(g, g.full, g.a);
          paths.push(M.virama(off + g.bx, BODY));
          x += 30;
        }
      }
      if (syl.nukta) paths.push(M.dot(lastOff + last.bx - 40, BODY + 110));
      if (rakar) {
        if (last.s != null) paths.push(shift(M.rakarStem(last.s), lastOff));
        else { paths.push(M.rakarCaret(lastOff + last.bx)); lastHasRakar = true; }
      }
    } else if (syl.base) {
      const g = gl(syl.base);
      if (!g) return null;
      lastOff = put(g, g.full, g.a);
      last = g;
    }

    const stemAbs = lastOff + (last.s != null ? last.s : last.tx);
    let topX = stemAbs;           // where top marks go
    const botX = lastOff + last.bx;
    const botY = last.s != null ? BODY : BODY + 40;

    switch (matra) {
      case 'ा': case 'ो': case 'ौ': case 'ॉ': {
        const aa = gl('ा');
        const off = put(aa, aa.full, aa.a);
        topX = off + 70;
        if (matra === 'ो') paths.push(M.e(topX));
        if (matra === 'ौ') { paths.push(M.e(topX)); paths.push(M.e(topX - 120)); }
        if (matra === 'ॉ') paths.push(M.candra(topX));
        break;
      }
      case 'ि': {
        paths.unshift(M.iHook(70, stemAbs));
        hl.push([0, I_W]);
        break;
      }
      case 'ी': {
        const aa = gl('ा');
        const off = put(aa, '', aa.a);
        paths.push(M.iiHook(off + 70, lastOff + Math.min(110, last.a * 0.3)));
        topX = off + 70;
        break;
      }
      case 'ई': { // independent ई = इ + reph-like hook
        paths.push(M.reph(topX));
        break;
      }
      case 'ऊ': {
        paths.push(`M${lastOff + 330} 470 C${lastOff + 420} 420 ${lastOff + 470} 520 ${lastOff + 420} 590`);
        break;
      }
      case 'ु':
        if (last === G['र']) paths.push(M.u(lastOff + 370, BODY)); // रु: hook hangs from the end of the leg
        else paths.push(M.u(botX, botY));
        break;
      case 'ू':
        paths.push(M.uu(botX, botY));
        break;
      case 'ृ': case 'ॄ':
        paths.push(M.ru(botX, botY));
        break;
      case 'े': case 'ॆ': paths.push(M.e(topX)); break;
      case 'ै': paths.push(M.e(topX)); paths.push(M.e(topX - 120)); break;
      case 'ॅ': paths.push(M.candra(topX)); break;
      case 'ॊ': break;
      default: break;
    }

    if (syl.reph) paths.push(M.reph(topX));
    const hasE = matra === 'े' || matra === 'ै' || matra === 'ो' || matra === 'ौ';
    for (const m of syl.mods) {
      if (m === 'ं') {
        const iLike = matra === 'ि' || matra === 'ी';
        const dx = syl.reph ? topX - 175 : hasE ? topX + 45 : iLike ? topX + 85 : topX - 40;
        const dy = -170;
        if (iLike) x += 60; // keep the dot clear of the next letter
        paths.push(M.dot(dx, dy));
      } else if (m === 'ँ') {
        paths.push(M.candra(topX + 40));
        paths.push(M.dot(topX - 60, -170));
      } else if (m === 'ः') {
        paths.push(M.dot(x + 70, 180)); paths.push(M.dot(x + 70, 470));
        x += 160;
      }
    }
    if (syl.finalVirama && syl.cons.length) paths.push(M.virama(botX, botY));
    return { a: x, paths, hl };
  }

  // translate an SVG path string by dx (absolute commands M L C Q only)
  function shift(d, dx) {
    if (!dx || !d) return d;
    let k = 0;
    return d.replace(/[MLCQ]|-?\d+(\.\d+)?/g, t => {
      if (/[MLCQ]/.test(t)) { k = 0; return t; }
      const v = parseFloat(t);
      return String((k++ % 2 === 0) ? +(v + dx).toFixed(2) : v);
    });
  }

  // ---------------------------------------------------------------- runs
  // Splits text into runs: {type:'deva'|'latin'|'space', text}
  function runs(text) {
    const out = [];
    const chars = Array.from(text.normalize('NFC'));
    // NFC composes nukta letters; decompose those back for the shaper
    let cur = null;
    for (const c of chars) {
      const t = c === ' ' || c === '\u00A0' ? 'space' : (isDevaChar(c) ? 'deva' : 'latin');
      if (!cur || cur.type !== t) { cur = { type: t, chars: [] }; out.push(cur); }
      cur.chars.push(c);
    }
    // punctuation glued to Latin text stays Latin (e.g. "+91 62625"), punctuation between
    // Devanagari letters stays Devanagari.
    return out;
  }

  const _layCache = new Map();
  function layDeva(chars) {
    const key = chars.join('');
    let r = _layCache.get(key);
    if (r) return r;
    const paths = [], hl = [];
    let x = 0;
    for (const syl of syllables(chars)) {
      const s = laySyllable(syl);
      if (!s) continue;
      for (const p of s.paths) paths.push(shift(p, x));
      for (const [a, b] of s.hl) hl.push([a + x, b + x]);
      x += s.a;
    }
    // merge headline segments
    hl.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const seg of hl) {
      const m = merged[merged.length - 1];
      if (m && seg[0] <= m[1] + 1) m[1] = Math.max(m[1], seg[1]);
      else merged.push(seg.slice());
    }
    for (const [a, b] of merged) paths.push(`M${a + 30} 0 L${b - 30} 0`);
    r = { a: x, d: paths.join(' ') };
    _layCache.set(key, r);
    return r;
  }

  // ---------------------------------------------------------------- measuring
  let _mctx = null;
  function latinCtx() {
    if (_mctx) return _mctx;
    if (typeof OffscreenCanvas !== 'undefined') _mctx = new OffscreenCanvas(8, 8).getContext('2d');
    else if (typeof document !== 'undefined') _mctx = document.createElement('canvas').getContext('2d');
    return _mctx;
  }
  const DEFAULT_LATIN = '"Noto Sans", "Lato", sans-serif';
  function latinFont(size, fam) { return `700 ${(size * LATIN_SCALE).toFixed(2)}px ${fam || DEFAULT_LATIN}`; }
  function latinWidth(str, size, fam) {
    const c = latinCtx();
    if (!c) return str.length * size * LATIN_SCALE * 0.6;
    c.font = latinFont(size, fam);
    return c.measureText(str).width;
  }

  function layout(text, size, fam) {
    const u = size / 1000;
    const items = [];
    let x = 0;
    for (const r of runs(text)) {
      if (r.type === 'space') { x += SPACE * u * r.chars.length; continue; }
      if (r.type === 'deva') {
        const l = layDeva(r.chars);
        items.push({ type: 'deva', x, d: l.d, w: l.a * u });
        x += l.a * u;
      } else {
        const s = r.chars.join('');
        const w = latinWidth(s, size, fam);
        items.push({ type: 'latin', x: x + 30 * u, text: s, w });
        x += w + 60 * u;
      }
    }
    return { w: x, items };
  }

  function measure(text, size, opts) { return layout(text, size, opts && opts.latinFont).w; }

  const _pathCache = new Map();
  function path2d(d) {
    let p = _pathCache.get(d);
    if (!p) { p = new Path2D(d); _pathCache.set(d, p); if (_pathCache.size > 4000) _pathCache.clear(); }
    return p;
  }

  function draw(ctx, text, x, y, size, opts) {
    opts = opts || {};
    const u = size / 1000;
    const L = layout(text, size, opts.latinFont);
    const align = opts.align || 'left';
    let x0 = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
    const base = opts.baseline || 'headline';
    const yh = base === 'middle' ? y - BODY * u / 2 : base === 'bottom' ? y - BODY * u : y;
    const pen = PEN * (opts.weight || 1);
    const fill = opts.fill || '#000';
    const passes = [];
    if (opts.stroke && opts.strokeWidth) passes.push({ color: opts.stroke, extra: opts.strokeWidth * 2 });
    passes.push({ color: fill, extra: 0 });
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of passes) {
      for (const it of L.items) {
        if (it.type === 'deva') {
          ctx.save();
          ctx.translate(x0 + it.x, yh);
          ctx.scale(u, u);
          ctx.lineWidth = pen + pass.extra / u;
          ctx.strokeStyle = pass.color;
          ctx.stroke(path2d(it.d));
          ctx.restore();
        } else {
          ctx.font = latinFont(size, opts.latinFont);
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          const by = yh + (BODY + 10) * u;
          if (pass.extra) {
            ctx.lineWidth = pass.extra;
            ctx.strokeStyle = pass.color;
            ctx.strokeText(it.text, x0 + it.x, by);
          } else {
            ctx.fillStyle = pass.color;
            ctx.fillText(it.text, x0 + it.x, by);
          }
        }
      }
    }
    ctx.restore();
    return L.w;
  }

  function wrap(text, size, maxWidth, opts) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (!cur || measure(t, size, opts) <= maxWidth) cur = t;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function lineHeight(size) { return size * 1.18; }

  // characters this engine knows how to draw (for coverage checks)
  function covers(text) {
    const missing = new Set();
    for (const r of runs(text)) {
      if (r.type !== 'deva') continue;
      for (const c of r.chars) {
        if (c === VIRAMA || c === ZWJ || c === ZWNJ || c === NUKTA || MATRAS.includes(c) || MODS.includes(c) || COMPOSE[c] || NUKTA_BASE[c]) continue;
        if (!G[c]) missing.add(c);
      }
    }
    return [...missing];
  }

  // development hook: replace a glyph definition (used by the glyph-tuning sheet only)
  function _setGlyph(ch, def) { G[ch] = def; _layCache.clear(); }
  const Deva = { measure, draw, wrap, lineHeight, covers, syllables, layout, units: { PEN, BODY, SPACE }, backend: 'vector', _G: G, _setGlyph };
  if (typeof module !== 'undefined' && module.exports) module.exports = Deva;
  root.Deva = Deva;
})(typeof globalThis !== 'undefined' ? globalThis : this);
