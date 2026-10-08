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
- `architecture-src.svg` — editable README architecture diagram covering the
  Cloudflare Worker, per-user SQLite Durable Objects, Workers Static Assets,
  R2, GitHub OAuth, realtime connections, and the Discord request flow for
  public Svelte SSR and dynamic file OG images rendered with resvg WASM.
  It uses the app's cream rounded background, orange accents, rounded connectors,
  IBM Plex Sans, and IBM Plex Mono. Run `node scripts/build-architecture.mjs` to
  verify text bounds and regenerate `architecture.svg` with outlined lettering
  from the project's bundled fonts, so GitHub displays the exact same faces.
  Arrowheads are explicit paths, not auto-oriented SVG markers, so outlining
  preserves their direction. Connector tips sit 6px outside the card borders.
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

- `screenshot.png` — actual local application in English, captured at 2× pixel
  density with IBM Plex fonts loaded. Shows a three-file collection (PNG, CSV,
  JSON), a plain-text note, and a highlighted TypeScript snippet. The cream
  background has rounded corners with transparent outer pixels.
- `apple-touch-180.png` — 180×180 full-bleed crop of `full-light.svg`; copied
  to `static/apple-touch-icon.png` (iOS applies its own corner mask).
- `github-1024.png` — 1024×1024 full-bleed crop for the GitHub OAuth App
  avatar (GitHub applies its own rounded/circular mask).

Palette: cream `#faf7f2`, ink `#1c1917`, accent orange `#ea580c`,
dark-mode background `#292524`.
