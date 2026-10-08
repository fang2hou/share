# Media assets

Design sources and generated images for the share brand (favicon, dynamic
unread badge, OG card, GitHub avatar, iOS home-screen icon). Run
`node scripts/build-favicon.mjs` to regenerate the SVG favicon and badge
previews. Development and production builds run this step automatically.

## Sources (edit these, then regenerate derivatives)

- `logo.svg` — README wordmark, outlined from the bundled IBM Plex Sans Bold
  Latin font with the app's letter spacing. All lettering is SVG paths; the
  orange dot uses the brand accent. A cream rounded rectangle keeps the ink
  lettering and orange dot consistent across light and dark themes.
- `icon-parts.json` — icon geometry master: squircle shell (superellipse n=5),
  "S"/digit/"+" outlines extracted from IBM Plex Sans SC Bold, dot placement,
  and the palette. `src/lib/favicon-svg.ts` reads this file directly; the
  browser and build script share that renderer. The shipped file is `static/favicon.svg`.
- `og-src.html` — source of `static/og.png` (1200×630 card). Rasterize with
  headless Chrome at `--window-size=1200,630 --force-device-scale-factor=1`.
- `worker/share-image.ts` renders per-share file cards as 1200×630 PNGs in the
  same palette and typography; its font assets and licenses live in `static/og-fonts/`.
- `favicon.svg` — shipped favicon: squircle crop, dark-mode aware via
  `prefers-color-scheme`.
- `favicon-dark.svg` — the dark variant rendered statically (preview/fallback).
- `badge3-light.svg`, `badge9plus-light.svg`, `badge9plus-dark.svg` — unread
  badge states (digit keeps the S slot, dot stays put, big "+" upper-right).
- `full-light.svg` — square master, edge-to-edge background, no rounding.

## Generated images

- `apple-touch-180.png` — 180×180 full-bleed crop of `full-light.svg`; copied
  to `static/apple-touch-icon.png` (iOS applies its own corner mask).
- `github-1024.png` — 1024×1024 full-bleed crop for the GitHub OAuth App
  avatar (GitHub applies its own rounded/circular mask).

Palette: cream `#faf7f2`, ink `#1c1917`, accent orange `#ea580c`,
dark-mode background `#292524`.
