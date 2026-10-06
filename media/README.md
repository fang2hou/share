# Media assets

Design sources and generated images for the share brand (favicon, dynamic
unread badge, OG card, GitHub avatar, iOS home-screen icon). Build scripts are
not kept here; everything below is the durable source of truth.

## Sources (edit these, then regenerate derivatives)

- `icon-parts.json` — icon geometry master: squircle shell (superellipse n=5),
  "S"/digit/"+" outlines extracted from IBM Plex Sans SC Bold, dot placement,
  and the palette. `src/lib/favicon.ts` and `src/lib/assets/favicon.svg` are
  baked from this file.
- `og-src.html` — source of `static/og.png` (1200×630 card). Rasterize with
  headless Chrome at `--window-size=1200,630 --force-device-scale-factor=1`.
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
