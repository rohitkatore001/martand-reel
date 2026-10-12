Drop ONE Devanagari font file here (.ttf, .otf, .woff or .woff2), for example:
  NotoSansDevanagari-Bold.ttf, Mukta-ExtraBold.ttf, Baloo2-ExtraBold.ttf or YatraOne-Regular.ttf

When a font file is present, every Marathi string is drawn with that font (Chromium shapes it
with HarfBuzz, so all conjuncts and matras are typographically correct). With no font here the
built-in vector glyph engine (src/deva.js) is used instead. No code changes are needed; just
re-run:
  NODE_OPTIONS= node render.mjs --textsheet   (check out/stills/text_sheet_*.png)
  NODE_OPTIONS= node render.mjs               (re-render the reel)
If several files are present, the first one in alphabetical order is used.
