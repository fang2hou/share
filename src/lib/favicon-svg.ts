import parts from "../../media/icon-parts.json" with { type: "json" };

/** Only eleven visual states are needed: S., 1–9, and 9+. */
export function faviconState(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), 10)) : 0;
}

/** Outlined glyphs keep the icon independent of installed or loaded fonts. */
export function renderFavicon(count = 0, dark?: boolean): string {
  const badge = faviconState(count);
  const bg = dark ? parts.DARK_BG : parts.CREAM;
  const fg = dark ? parts.CREAM : parts.INK;
  const glyph =
    badge === 0 ? parts.S : parts.DIGITS[String(Math.min(badge, 9)) as keyof typeof parts.DIGITS];
  const path = (g: typeof parts.S): string =>
    `<path class="fg" transform="translate(${g.tx} ${g.ty})" d="${g.d}" fill="${fg}"/>`;
  const theme =
    dark === undefined
      ? `<style>@media (prefers-color-scheme: dark){.bg{fill:${parts.DARK_BG}}.fg{fill:${parts.CREAM}}}</style>`
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${parts.CANVAS} ${parts.CANVAS}">` +
    theme +
    `<path class="bg" d="${parts.SQUIRCLE}" fill="${bg}"/>` +
    path(glyph) +
    `<circle cx="${parts.DOT.cx}" cy="${parts.DOT.cy}" r="${parts.DOT.r}" fill="${parts.ACCENT}"/>` +
    (badge > 9 ? path(parts.PLUS) : "") +
    "</svg>"
  );
}
