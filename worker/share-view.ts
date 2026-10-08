import type { Item, StoredFile } from "../shared/protocol.ts";
import type { Lang } from "../shared/i18n.ts";
import type { PublicView } from "../shared/public-view.ts";
import { fileTypeFromName } from "../shared/file-preview.ts";
import { renderPublic, publicAssets } from "./generated/public-page.js";

function page(view: PublicView): Response {
  const { body, head } = renderPublic(view);
  const bootstrap = JSON.stringify(view).replaceAll("<", "\\u003c");
  return new Response(
    `<!doctype html><html lang="${view.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head}${publicAssets}</head><body><div id="public-view">${body}</div><script id="public-view-data" type="application/json">${bootstrap}</script></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'none'; script-src 'self'; style-src 'unsafe-inline' 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; media-src 'self'; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}
export function passwordView(lang: Lang, url: string): Response {
  const location = new URL(url);
  return page({
    kind: "password",
    lang,
    path: location.pathname,
    url: location.origin + location.pathname,
    image: location.origin + "/og.png",
  });
}
export function fileView(lang: Lang, files: StoredFile[], url: string, image: string): Response {
  const location = new URL(url);
  return page({
    kind: "files",
    lang,
    path: location.pathname,
    url: location.origin + location.pathname,
    image,
    files,
  });
}
export function textView(lang: Lang, item: Item, url: string): Response {
  const location = new URL(url);
  return page({
    kind: "text",
    lang,
    path: location.pathname,
    text: item.text,
    url: location.origin + location.pathname,
    image: location.origin + "/og.png",
  });
}

export function publicFiles(item: Item): StoredFile[] {
  return (
    item.files ?? [
      {
        id: item.id,
        name: item.fileName ?? "download",
        size: item.fileSize ?? 0,
        type: fileTypeFromName(item.fileName ?? ""),
      },
    ]
  );
}
