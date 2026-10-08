import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { renderFavicon } from "../src/lib/favicon-svg.ts";

test("shipped favicon and badge previews stay synchronized with the runtime renderer", async () => {
  const fixtures = [
    ["static/favicon.svg", 0, undefined],
    ["media/favicon.svg", 0, undefined],
    ["media/favicon-dark.svg", 0, true],
    ["media/badge3-light.svg", 3, false],
    ["media/badge9plus-light.svg", 10, false],
    ["media/badge9plus-dark.svg", 10, true],
  ];
  for (const [file, count, dark] of fixtures) {
    assert.equal(
      await readFile(new URL(`../${file}`, import.meta.url), "utf8"),
      renderFavicon(count, dark),
      file,
    );
  }
});

test("badge thresholds and invalid counts always produce a valid visual state", () => {
  for (const count of [-1, NaN, Infinity, -Infinity, 0.9]) {
    assert.equal(renderFavicon(count), renderFavicon(0));
  }
  assert.equal(renderFavicon(1.9), renderFavicon(1));
  assert.notEqual(renderFavicon(0), renderFavicon(1));
  for (let count = 1; count < 10; count++) {
    assert.notEqual(renderFavicon(count), renderFavicon(count + 1));
  }
  assert.equal(renderFavicon(10), renderFavicon(99));
  assert.equal(renderFavicon(10), renderFavicon(Number.MAX_SAFE_INTEGER));
});

test("unbadged SVG adapts to browser theme; explicit badge themes do not depend on SVG media queries", () => {
  assert.match(renderFavicon(), /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(renderFavicon(3, false), /<style>/);
  assert.doesNotMatch(renderFavicon(3, true), /<style>/);
  assert.notEqual(renderFavicon(3, true), renderFavicon(3, false));
  assert.equal((renderFavicon(3, true).match(/<circle /g) ?? []).length, 1);
  assert.equal((renderFavicon(10, true).match(/<circle /g) ?? []).length, 1);
});

test("prerendered SPA shell declares exactly one favicon before JavaScript starts", async () => {
  const html = await readFile(new URL("../build/index.html", import.meta.url), "utf8");
  assert.equal((html.match(/rel="icon"/g) ?? []).length, 1);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg"/);
});
