// Single source of truth for timing: scene boundaries, subtitle / VO spans and music beat grid.
// Used by scenes.js (drawing), audio.js (music cues, VO ducking) and tools/make_srt.mjs
// (script/subtitles_mr.srt). Strings come from strings.js (REEL_STRINGS).
(function (root) {
  const S = root.REEL_STRINGS;
  const DURATION = 57;
  // montage: 6 cuts between 20 s and 34 s, each exactly 5 beats of the dhol groove
  const MONTAGE = { start: 20, end: 34, cuts: 6 };
  MONTAGE.cut = (MONTAGE.end - MONTAGE.start) / MONTAGE.cuts; // 2.333 s
  const BEAT = MONTAGE.cut / 5; // 0.4667 s -> 128.6 BPM
  const SCENES = [
    { id: 'hook', start: 0, end: 3, note: 'black, extreme close-up hand crunching farsan' },
    { id: 'city', start: 3, end: 8, note: 'evening Pune flat, rain, young man with tea' },
    { id: 'flashback', start: 8, end: 15, note: 'village house, Aaji opens the dabba, kid grabs a handful' },
    { id: 'present', start: 15, end: 20, note: 'friend tosses the packet, tear, bite, echo, brand title' },
    { id: 'montage', start: 20, end: 34, note: '6 fast cuts: tea, poha, bhel, misal, travel, guests' },
    { id: 'ingredients', start: 34, end: 41, note: 'six clay bowls of ingredients' },
    { id: 'family', start: 41, end: 47, note: 'family sharing farsan and tea' },
    { id: 'hero', start: 47, end: 55, note: 'hero pack shot, price, phone, CTA' },
    { id: 'end', start: 55, end: 57, note: 'logo end card, Yelkot Yelkot Jai Malhar' },
  ];
  // speaker: vo = narrator voice-over, aaji = grandmother, friend = friend from the village
  const m = i => MONTAGE.start + i * MONTAGE.cut;
  const SUBS = [
    { start: 3.25, end: 4.9, speaker: 'vo', text: S.vo1a, tone: 'soft, nostalgic' },
    { start: 4.9, end: 7.0, speaker: 'vo', text: S.vo1b, tone: 'soft, longing' },
    { start: 7.0, end: 8.0, speaker: 'vo', text: S.vo1c, tone: 'soft, a small sigh' },
    { start: 8.9, end: 11.9, speaker: 'vo', text: S.vo2, tone: 'warm, smiling memory' },
    { start: 12.2, end: 14.8, speaker: 'aaji', text: S.aaji1, tone: 'loving scold, village accent', silent: true },
    { start: 15.35, end: 16.9, speaker: 'friend', text: S.friend, tone: 'cheerful, casual', silent: true },
    { start: 17.7, end: 18.8, speaker: 'aaji', text: S.aajiEcho, tone: 'faint echo, whisper, reverb', silent: true },
    { start: m(0) + 0.1, end: m(1), speaker: 'vo', text: S.m1, tone: 'energetic, on the beat' },
    { start: m(1), end: m(2), speaker: 'vo', text: S.m2, tone: 'energetic' },
    { start: m(2), end: m(3), speaker: 'vo', text: S.m3, tone: 'fast, playful' },
    { start: m(3), end: m(4), speaker: 'vo', text: S.m4, tone: 'energetic' },
    { start: m(4), end: m(5), speaker: 'vo', text: S.m5, tone: 'energetic' },
    { start: m(5), end: MONTAGE.end, speaker: 'vo', text: S.m6, tone: 'proud, welcoming' },
    { start: 34.4, end: 37.6, speaker: 'vo', text: S.vo3a, tone: 'clear, honest' },
    { start: 37.6, end: 39.4, speaker: 'vo', text: S.vo3b, tone: 'clear' },
    { start: 39.4, end: 41.0, speaker: 'vo', text: S.vo3c, tone: 'proud, slow' },
    { start: 42.0, end: 46.4, speaker: 'vo', text: S.vo4, tone: 'emotional, warm, slow' },
    { start: 47.6, end: 50.8, speaker: 'vo', text: S.vo5, tone: 'bold brand line' },
    { start: 51.4, end: 54.6, speaker: 'vo', text: S.cta, tone: 'inviting call to action', silent: true },
    { start: 55.2, end: 57.0, speaker: 'vo', text: S.end, tone: 'devotional cheer, loud', silent: true },
  ];
  // silent: line is shown as on-screen graphics (speech bubble, echo text, CTA, end card) instead of the subtitle bar.
  // It is still listed in the VO recording script. Silent narrator lines (CTA, end line) are left out of the SRT
  // because they are already burned in; silent dialogue lines stay in the SRT as spoken captions.
  const TL = { DURATION, SCENES, SUBS, MONTAGE, BEAT };
  TL.scene = t => SCENES.find(s => t >= s.start && t < s.end) || SCENES[SCENES.length - 1];
  root.TIMELINE = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
