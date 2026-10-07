import { render } from "svelte/server";
import PublicPage from "./PublicPage.svelte";
import type { PublicView } from "../public-view.js";
export function renderPublic(view: PublicView): { body: string; head: string } {
  const result = render(PublicPage, { props: { view } });
  return { body: result.body, head: result.head };
}
