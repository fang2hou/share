import { hydrate } from "svelte";
import "../../src/app.css";
import PublicPage from "./PublicPage.svelte";
import type { PublicView } from "../public-view.js";
const bootstrap = document.getElementById("public-view-data");
const target = document.getElementById("public-view");
if (bootstrap && target) {
  hydrate(PublicPage, {
    target,
    props: { view: JSON.parse(bootstrap.textContent ?? "") as PublicView },
  });
}
