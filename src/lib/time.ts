import { messages, type Lang } from './i18n.js';

const rtfCache = new Map<Lang, Intl.RelativeTimeFormat>();
const dtfCache = new Map<Lang, Intl.DateTimeFormat>();

export function relativeTime(ts: number, now: number, lang: Lang): string {
	const diff = now - ts;
	if (diff < 45_000) return messages[lang].justNow;
	let rtf = rtfCache.get(lang);
	if (!rtf) {
		rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
		rtfCache.set(lang, rtf);
	}
	if (diff < 3_600_000) return rtf.format(-Math.max(1, Math.floor(diff / 60_000)), 'minute');
	if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), 'hour');
	return rtf.format(-Math.floor(diff / 86_400_000), 'day');
}

export function absoluteTime(ts: number, lang: Lang): string {
	let dtf = dtfCache.get(lang);
	if (!dtf) {
		dtf = new Intl.DateTimeFormat(lang, {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		dtfCache.set(lang, dtf);
	}
	return dtf.format(ts);
}
