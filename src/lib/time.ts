import { messages, type Lang } from "#shared/i18n.js";
import { spaceCjk } from "./cjk.js";

const rtfCache = new Map<Lang, Intl.RelativeTimeFormat>();
const dtfCache = new Map<Lang, Intl.DateTimeFormat>();

export function relativeTime(ts: number, now: number, lang: Lang): string {
  const diff = now - ts;
  if (diff < 45_000) return messages[lang].justNow;
  let rtf = rtfCache.get(lang);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    rtfCache.set(lang, rtf);
  }
  // zh rtf yields "3分钟前"-style tight runs; display them pangu-spaced
  const label = (s: string): string => (lang.startsWith("zh") ? spaceCjk(s) : s);
  if (diff < 3_600_000) return label(rtf.format(-Math.max(1, Math.floor(diff / 60_000)), "minute"));
  if (diff < 86_400_000) return label(rtf.format(-Math.floor(diff / 3_600_000), "hour"));
  return label(rtf.format(-Math.floor(diff / 86_400_000), "day"));
}

export function absoluteTime(ts: number, lang: Lang): string {
  let dtf = dtfCache.get(lang);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(lang, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(lang, dtf);
  }
  return dtf.format(ts);
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelCache = new Map<Lang, Intl.DateTimeFormat>();
const zhWeekCache = new Intl.DateTimeFormat("zh-CN", { weekday: "narrow" });

// local calendar day key (YYYY-MM-DD) — grouping boundary is the viewer's own timezone
export function dayKey(ts: number): string {
  return dayKeyFmt.format(ts);
}

export function dayLabel(ts: number, lang: Lang): string {
  // ICU gives ja/ko a parenthesized weekday (10月7日（水）) but zh none at all;
  // assemble it ourselves so all CJK locales read the same way
  if (lang === "zh-CN" || lang === "zh-TW") {
    let dtf = dayLabelCache.get(lang);
    if (!dtf) {
      dtf = new Intl.DateTimeFormat(lang, { month: "long", day: "numeric" });
      dayLabelCache.set(lang, dtf);
    }
    return `${dtf.format(ts)}（${zhWeekCache.format(ts)}）`;
  }
  let dtf = dayLabelCache.get(lang);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(lang, { month: "long", day: "numeric", weekday: "short" });
    dayLabelCache.set(lang, dtf);
  }
  return dtf.format(ts);
}

export function dayKeyOffset(now: number, days: number): string {
  return dayKey(now - days * 86_400_000);
}
