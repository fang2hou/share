import { writeFile } from "node:fs/promises";
import { renderFavicon } from "../src/lib/favicon-svg.ts";

// Both the browser and this build use media/icon-parts.json through the same renderer.
await Promise.all([
  writeFile(new URL("../static/favicon.svg", import.meta.url), renderFavicon()),
  writeFile(new URL("../media/favicon.svg", import.meta.url), renderFavicon()),
  writeFile(new URL("../media/favicon-dark.svg", import.meta.url), renderFavicon(0, true)),
  writeFile(new URL("../media/badge3-light.svg", import.meta.url), renderFavicon(3, false)),
  writeFile(new URL("../media/badge9plus-light.svg", import.meta.url), renderFavicon(10, false)),
  writeFile(new URL("../media/badge9plus-dark.svg", import.meta.url), renderFavicon(10, true)),
]);
