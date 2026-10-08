import { faviconState, renderFavicon } from "./favicon-svg.js";

let link: HTMLLinkElement | undefined;
let badge = 0;
let dark = false;
let dispose: (() => void) | undefined;

function apply(): void {
  if (!link) return;
  // The static SVG handles its own theme and remains cacheable when there is no badge.
  const href =
    badge === 0
      ? "/favicon.svg"
      : "data:image/svg+xml," + encodeURIComponent(renderFavicon(badge, dark));
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

/** Takes over the static link until the page unmounts. */
export function mountFavicon(): () => void {
  const pendingBadge = badge;
  dispose?.();
  badge = pendingBadge;
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  link = existing ?? document.createElement("link");
  const mountedLink = link;
  const originalHref = link.getAttribute("href");
  if (!existing) {
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const mq = matchMedia("(prefers-color-scheme: dark)");
  dark = mq.matches;
  const onThemeChange = (e: MediaQueryListEvent): void => {
    dark = e.matches;
    apply();
  };
  mq.addEventListener("change", onThemeChange);
  apply();
  let active = true;
  const cleanup = (): void => {
    if (!active) return;
    active = false;
    mq.removeEventListener("change", onThemeChange);
    if (link !== mountedLink) return;
    if (!existing) mountedLink.remove();
    else if (originalHref === null) mountedLink.removeAttribute("href");
    else mountedLink.setAttribute("href", originalHref);
    link = undefined;
    badge = 0;
    dispose = undefined;
  };
  dispose = cleanup;
  return cleanup;
}

/** 0 restores S.; 1–9 shows the digit; 10+ shows 9+. */
export function setFaviconBadge(count: number): void {
  const next = faviconState(count);
  if (badge === next) return;
  badge = next;
  apply();
}
