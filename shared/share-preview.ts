import { formatCount, messages, type Lang } from "./i18n.ts";
import { formatFileSize } from "./format.ts";
import type { PublicView } from "./public-view.ts";

export function sharePreview(view: PublicView, lang: Lang = view.lang) {
  const m = messages[lang];
  if (view.kind === "password")
    return { title: m.protectedShare, description: m.unlockHint, detail: m.unlockTitle };
  if (view.kind === "text") {
    const first =
      view.text
        .split("\n")
        .find((line) => line.trim())
        ?.trim() ?? "";
    return {
      title: shorten(first || m.shareViewTitle, 60),
      description: shorten(view.text.replaceAll(/\s+/g, " ").trim(), 200),
      detail: m.shareViewTitle,
    };
  }
  const count = formatCount(m.fileCount, view.files.length);
  const size = formatFileSize(view.files.reduce((total, file) => total + file.size, 0));
  const first = view.files[0];
  if (view.files.length === 1 && first) {
    const extension = /\.([a-z0-9]{1,12})$/i.exec(first.name)?.[1]?.toUpperCase();
    const detail = `${extension || first.type || m.download} · ${size}`;
    return { title: first.name, description: `${m.download} · ${detail}`, detail };
  }
  return {
    title: count,
    description: shorten(`${size} · ${view.files.map((file) => file.name).join(" · ")}`, 200),
    detail: size,
  };
}

function shorten(text: string, limit: number): string {
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, limit - 1).join("") + "…" : text;
}
