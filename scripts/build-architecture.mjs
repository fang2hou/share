import { readFile, writeFile } from "node:fs/promises";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const source = await readFile(new URL("../media/architecture-src.svg", import.meta.url), "utf8");
await initWasm(await readFile(new URL(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))));
const fontBuffers = await Promise.all([
  ...[400, 600, 700].map((weight) =>
    readFile(
      new URL(
        `../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff2`,
        import.meta.url,
      ),
    ),
  ),
  readFile(
    new URL(
      "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      import.meta.url,
    ),
  ),
]);
const options = { font: { fontBuffers, defaultFontFamily: "IBM Plex Sans" } };
const style = source.match(/<style>[\s\S]*?<\/style>/)[0];
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
let count = 0;

// Each section uses local coordinates. Measure real glyph bounds inside its cards.
for (const section of source.split('<g transform="translate(0 724)">')) {
  const cards = [...section.matchAll(/<rect\b[^>]*>/g)]
    .map(([tag]) => ({
      x: Number(attribute(tag, "x")),
      y: Number(attribute(tag, "y")),
      width: Number(attribute(tag, "width")),
      height: Number(attribute(tag, "height")),
      fill: attribute(tag, "fill"),
    }))
    .filter((card) => card.fill === "#fff" || card.fill === "#fff7ed");
  const labels = [...section.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)].map(([tag]) => ({
    tag,
    x: Number(attribute(tag, "x")),
    y: Number(attribute(tag, "y")),
  }));
  for (const label of labels) {
    const rotated = attribute(label.tag, "transform");
    const measuredTag = label.tag.replace(/ transform="[^"]*"/, "");
    const renderer = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1286">${style}${measuredTag}</svg>`,
      options,
    );
    const bounds = renderer.getBBox();
    if (!bounds) throw new Error(`Missing font glyphs: ${label.tag}`);
    if (rotated) {
      if (bounds.width > 140) throw new Error(`Rotated label exceeds its connector: ${label.tag}`);
      bounds.free();
      renderer.free();
      count++;
      continue;
    }
    const card = cards.find(
      (candidate) =>
        label.x > candidate.x &&
        label.x < candidate.x + candidate.width &&
        label.y > candidate.y &&
        label.y < candidate.y + candidate.height,
    );
    const next = labels.find((candidate) => candidate.y === label.y && candidate.x > label.x);
    const left = card ? card.x + 20 : 40;
    const right = card ? card.x + card.width - 20 : (next?.x ?? 1100) - 20;
    if (bounds.x < left || bounds.x + bounds.width > right) {
      throw new Error(`Text exceeds its horizontal padding (${left}–${right}): ${label.tag}`);
    }
    if (card && (bounds.y < card.y + 16 || bounds.y + bounds.height > card.y + card.height - 16)) {
      throw new Error(`Text exceeds its vertical padding: ${label.tag}`);
    }
    bounds.free();
    renderer.free();
    count++;
  }
}

// Outline the exact bundled faces so GitHub images never substitute system fonts.
const renderer = new Resvg(source, options);
const accessibility = source.match(/  <title[\s\S]*?<\/desc>/)[0];
const output = renderer
  .toString()
  .replace(/-?\d+\.\d+/g, (value) => String(Math.round(Number(value) * 1000) / 1000))
  .replace(
    'xmlns="http://www.w3.org/2000/svg">',
    'xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">',
  )
  .replace(/(<svg\b[^>]*>)/, `$1\n${accessibility}`);
await writeFile(new URL("../media/architecture.svg", import.meta.url), output);
renderer.free();
console.log(`Outlined IBM Plex Sans / Mono; verified ${count} labels against layout bounds.`);
