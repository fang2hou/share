import type { Lang } from "#shared/i18n.js";

const loaded = new Map<Lang, Promise<void>>();

/**
 * CJK glyph fonts load on demand, one language at a time; the slices use
 * unicode-range so the browser fetches only the pieces actually rendered.
 * zh-CN/zh-TW/en need nothing: IBM publishes no SC/TC webfont, so the font
 * stack keeps locally installed IBM Plex Sans SC/TC and falls back to system
 * CJK fonts; latin ships in the initial CSS.
 */
export async function loadLangFonts(lang: Lang): Promise<void> {
  const existing = loaded.get(lang);
  if (existing) return existing;
  const loading = (async () => {
    try {
      if (lang === "ja") {
        await Promise.all([
          import("@fontsource/ibm-plex-sans-jp/400.css"),
          import("@fontsource/ibm-plex-sans-jp/500.css"),
          import("@fontsource/ibm-plex-sans-jp/600.css"),
        ]);
      } else if (lang === "ko") {
        await Promise.all([
          import("@fontsource/ibm-plex-sans-kr/400.css"),
          import("@fontsource/ibm-plex-sans-kr/500.css"),
          import("@fontsource/ibm-plex-sans-kr/600.css"),
        ]);
      }
    } catch {
      // fonts are cosmetic; never block the app
    }
  })();
  loaded.set(lang, loading);
  return loading;
}
