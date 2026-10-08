import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import { sharePreview } from "../shared/share-preview.ts";
import type { PublicView } from "../shared/public-view.ts";

let rendererReady: Promise<void> | undefined;

export async function shareImage(view: PublicView, assets: Fetcher): Promise<Response> {
  await (rendererReady ??= initWasm(wasm));
  const fonts = await Promise.all(
    ["IBMPlexSans-Bold.ttf", "NotoSansCJKsc-Regular.otf"].map(async (name) => {
      const response = await assets.fetch(new URL(`/og-fonts/${name}`, view.url));
      if (!response.ok) throw new Error("preview_font_unavailable");
      return new Uint8Array(await response.arrayBuffer());
    }),
  );
  const renderer = new Resvg(shareImageSvg(view), {
    font: { fontBuffers: fonts, defaultFontFamily: "Noto Sans CJK SC" },
  });
  try {
    const rendered = renderer.render();
    try {
      return new Response(rendered.asPng(), {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
          "x-content-type-options": "nosniff",
        },
      });
    } finally {
      rendered.free();
    }
  } finally {
    renderer.free();
  }
}

export function shareImageSvg(view: PublicView): string {
  const preview = sharePreview(view);
  const lines = wrapLines(preview.title, 44, 2);
  const names =
    view.kind === "files" && view.files.length > 1
      ? wrapLines(
          view.files
            .slice(0, 3)
            .map((file) => file.name)
            .join(" · "),
          26,
          1,
        )[0]
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#faf7f2"/>
    <text x="104" y="230" font-family="IBM Plex Sans" font-weight="700" font-size="148" letter-spacing="-6" fill="#1c1917">share<tspan fill="#ea580c">.</tspan></text>
    <g font-family="Noto Sans CJK SC" fill="#292524" font-size="44">
      ${lines.map((line, index) => `<text x="104" y="${336 + index * 62}">${escapeXml(line)}</text>`).join("")}
    </g>
    <text x="104" y="${lines.length > 1 ? 470 : 412}" font-family="Noto Sans CJK SC" font-size="30" fill="#57534e">${escapeXml(wrapLines(preview.detail, 30, 1)[0] ?? "")}</text>
    ${names ? `<text x="104" y="484" font-family="Noto Sans CJK SC" font-size="26" fill="#78716c">${escapeXml(names)}</text>` : ""}
  </svg>`;
}

function wrapLines(title: string, fontSize: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  let width = 0;
  const characters = Array.from(title.replaceAll(/[\s\p{Cc}\p{Cf}]+/gu, " ").trim());
  for (const character of characters) {
    // CJK glyphs occupy a full em; Latin is conservatively estimated at 0.65 em.
    const advance =
      character.codePointAt(0)! > 0x024f || /[MWmw@%&]/u.test(character)
        ? fontSize
        : fontSize * 0.65;
    if (width + advance > 980) {
      lines.push(line);
      if (lines.length === maxLines) {
        lines[maxLines - 1] =
          Array.from(lines[maxLines - 1]!)
            .slice(0, -2)
            .join("") + "…";
        return lines;
      }
      line = "";
      width = 0;
    }
    line += character;
    width += advance;
  }
  if (line) lines.push(line);
  return lines;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
