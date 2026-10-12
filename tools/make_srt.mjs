// Writes script/subtitles_mr.srt from src/timeline.js (single source of truth for subtitle timing).
//   NODE_OPTIONS= node tools/make_srt.mjs   (render.mjs also runs this on every full render)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function makeSrt() {
  const require = createRequire(import.meta.url);
  require(path.join(ROOT, 'src/strings.js'));
  const TL = require(path.join(ROOT, 'src/timeline.js'));
  const ts = s => {
    const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  // narrator lines marked silent (CTA, end line) are burned-in graphics, so they are not repeated as captions
  const cues = TL.SUBS.filter(s => !(s.speaker === 'vo' && s.silent));
  const body = cues.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text}\n`).join('\n');
  const f = path.join(ROOT, 'script/subtitles_mr.srt');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
  // VO recording script (same data)
  const who = { vo: 'Narrator (male, 25-35, warm Marathi)', aaji: 'Aaji (elderly woman, village Marathi)', friend: 'Friend (young man, cheerful)' };
  const tight = s => s.text.length / (s.end - s.start) > 15; // above ~15 characters per second is hard to read naturally
  const rows = TL.SUBS.map((s, i) => `| ${i + 1} | ${s.start.toFixed(2)} | ${s.end.toFixed(2)} | ${(s.end - s.start).toFixed(2)} | ${who[s.speaker]} | ${s.text} | ${s.tone}${s.speaker === 'vo' && s.silent ? ' (shown as graphics, optional to voice)' : ''}${tight(s) ? ` **TIGHT: ${(s.text.length / (s.end - s.start)).toFixed(0)} chars/s, read fast or extend the window in src/timeline.js**` : ''} |`).join('\n');
  const md = `# Voice-over recording script (मार्तंड फरसाण reel)

Generated from \`src/timeline.js\` by \`tools/make_srt.mjs\`; do not edit by hand.

How to deliver: record every line below, place each one so it **starts at its start time**, and export ONE file
\`assets/vo/vo.wav\` (WAV, 48 kHz, 16 or 24 bit, mono or stereo, exactly ${TL.DURATION.toFixed(1)} s long, silence between lines).
Then run \`NODE_OPTIONS= node render.mjs\` again: the VO is mixed in at full level and the music is ducked under every line automatically.
Keep each line inside its window; if a line needs more time, change start/end in \`src/timeline.js\` (subtitles follow).

| # | Start (s) | End (s) | Window (s) | Speaker | Line | Tone / direction |
|---|---|---|---|---|---|---|
${rows}
`;
  fs.writeFileSync(path.join(ROOT, 'script/vo_recording_script.md'), md);
  return f;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log('wrote ' + path.relative(ROOT, makeSrt()));
