# Demo GIF

Generates `images/demo.gif`, shown at the top of the main README.

The Tidy Tint diff is produced by the real `applyChanges` from `out/`. The
other diff simulates the usual whole-object approach
(`getConfiguration().update()`): comments are lost and the tool's keys move.

Requirements: Node and ImageMagick 7 (`magick`).

```sh
npm run compile
node scripts/demo-gif/build-diffs.mjs   # writes diffs.json and prints both diffs
node scripts/demo-gif/render.mjs        # writes images/demo.gif
```
