# मार्तंड फरसाण : Instagram reel (script #1)

A 57 second vertical reel (1080x1920, 30 fps) for मार्तंड फरसाण, built entirely in code: illustrated
scenes, a recreated pack, Marathi kinetic text and subtitles, and a synthesized soundtrack.

**Output:** `out/martand_farsan_reel.mp4` (H.264 High 1080x1920 30 fps ~7 Mbps average + Opus 48 kHz stereo, about 50 MB)
plus `out/soundtrack.wav` and preview stills in `out/stills/`.

## Most important next step: add a real Devanagari font

This machine has **no Devanagari font** and no internet, so every Marathi letter in this render is drawn
by a hand-built vector glyph engine (`src/deva.js`). Shaping works (matras, ि before the consonant, reph
in मार्तंड, half forms, ग्र / प्र), but several letter shapes are approximations: ह, च, ज, त, ण, ल, ळ, ड and ट
can look odd to a Marathi reader. Examples: काही can read like "कारी", and on the lines a buyer acts on,
आता फक्त ₹१०० can read like "आना फक्त" and आजच मागवा! like "आयन मागवा!".

**Do not publish the current render as is.** The price card and the call to action need the font drop-in
below before the reel goes out.

**Fix (no code changes):** copy a bold Devanagari font, for example `NotoSansDevanagari-Bold.ttf`,
`Mukta-ExtraBold.ttf` or `Baloo2-ExtraBold.ttf` (all free on Google Fonts), into `assets/fonts/` and re-render.
Every string then goes through Chromium's HarfBuzz shaper and is typographically correct.
Check it first with `NODE_OPTIONS= node render.mjs --textsheet` (see `out/stills/text_sheet_*.png`).

## How to re-render

Needs Node 22 and the preinstalled playwright-core Chromium (paths in `src/serve.mjs`). On this machine
`NODE_OPTIONS` points to a missing file, so always clear it:

```sh
cd martand-reel
NODE_OPTIONS= node render.mjs                         # full reel -> out/martand_farsan_reel.mp4 + out/soundtrack.wav (about 2 min)
NODE_OPTIONS= node verify.mjs out/martand_farsan_reel.mp4   # MP4 structure + Chromium playback/seek check
NODE_OPTIONS= node render.mjs --stills 1.5,5,11,17,25,50    # PNG stills -> out/stills/still_<t>.png
NODE_OPTIONS= node render.mjs --textsheet             # every Marathi string -> out/stills/text_sheet_*.png
NODE_OPTIONS= node tools/contact.mjs out/contact.png out/stills/still_*.png   # contact sheet of stills
NODE_OPTIONS= node tools/make_srt.mjs                 # script/subtitles_mr.srt + script/vo_recording_script.md
```

A full render also rewrites `script/subtitles_mr.srt` and `script/vo_recording_script.md` from the timeline.

## Price decision

The script said "फक्त ₹१३०". You confirmed the current offer is ₹100 for everyone, so the hero card shows
**MRP ₹१३०** struck through and **आता फक्त ₹१००**. To change it, edit `REEL_PRICE` at the top of
`src/strings.js` (Devanagari digits). To hide the struck-through MRP, set `showMrp: false` in `PRICE_CONFIG`
at the top of `src/scenes.js`. Then re-render.

## File map

| Path | What it is |
|---|---|
| `render.mjs` | Render driver (launches headless Chromium, encodes with WebCodecs, muxes MP4, writes WAV/SRT) |
| `verify.mjs` | Checks the MP4 boxes, tracks, duration and that Chromium can play and seek it |
| `src/timeline.js` | Single source of truth: scene times, every subtitle/VO line with speaker and tone, beat grid |
| `src/strings.js` | Every on-screen Marathi string and the price constant |
| `src/scenes.js` | All nine scenes, transitions, subtitles, price card (`PRICE_CONFIG`) |
| `src/art.js` | Illustration helpers: farsan granules, characters, tea, rain, city, village props, dishes, icons |
| `src/pack.js` | Vector recreation of the 500 g pack (or the real photo, see below) |
| `src/audio.js` | Synthesized soundtrack and VO mixing / ducking |
| `src/deva.js`, `src/text.js` | Devanagari vector engine and the font override |
| `src/encoder.js`, `src/mp4mux.mjs`, `src/serve.mjs`, `src/reel.html` | Encoding pipeline |
| `script/script.md` | Final script with timings |
| `script/vo_recording_script.md` | Line-by-line recording sheet (start/end, speaker, tone) |
| `script/subtitles_mr.srt` | Marathi subtitles (upload to Instagram/editor if you want captions as a separate track). The CTA and end line are left out because they are already burned into the video |
| `assets/fonts`, `assets/photos`, `assets/vo` | Drop-in folders (each has a README.txt) |

## Limitations and drop-in points

1. **Lettering:** hand-built glyphs (see the top of this file). Drop a Devanagari font into `assets/fonts/`.
2. **No voice-over:** there is no Marathi text-to-speech on this machine, so every VO and dialogue line is a
   subtitle (narrator in white, Aaji in yellow, friend in light blue; dialogue also appears in speech bubbles).
   Record the lines using `script/vo_recording_script.md`, save one 57 s file as `assets/vo/vo.wav`
   and re-render. The VO is mixed at full level and the music ducks under each line automatically
   (back-to-back lines are merged into one ducked stretch). Lines marked TIGHT in the sheet have a short window;
   read them fast or widen them in `src/timeline.js`.
3. **Pack is a recreated graphic** (badge, फरसाण title, tagline, Warli clay pot with farsan, copper band,
   500 g). Put a straight-on photo of the real pack at `assets/photos/pack_front.jpg` (or .png/.webp) and
   re-render: it replaces the drawing everywhere (toss, tear, hero shot) with no code changes.
4. **Audio codec is Opus inside MP4,** because this sandbox has no AAC encoder. Chrome plays it (checked by
   `verify.mjs`); Instagram ingest, Safari and iOS were not tested, and Instagram's upload spec asks for AAC.
   **Before uploading, remux the audio to AAC** on any normal computer (video is copied untouched):
   `ffmpeg -i out/martand_farsan_reel.mp4 -c:v copy -c:a aac -b:a 192k -movflags +faststart out/reel_aac.mp4`
   and upload `out/reel_aac.mp4`.
5. **Characters are flat illustrations,** not real footage or actors.
6. **Music is synthesized** (harmonium-style drone, bansuri-style flute, dhol, lezim, tutari-style horn),
   so it is royalty free but simpler than a studio track. `out/soundtrack.wav` can be replaced in an editor.
7. **Instagram safe zone:** important text is kept between y=250 and y=1500 so the caption and buttons do not cover it.
8. **MP4 muxer** (`src/mp4mux.mjs`) writes no `ctts` box, so it only supports streams without B-frames (the
   Chromium encoder emits I and P frames only). `render.mjs` stops with an error if chunk timestamps are not
   strictly increasing. All video is written before all audio in one `mdat`; the ffmpeg command above with
   `-movflags +faststart` produces a normally interleaved file.
