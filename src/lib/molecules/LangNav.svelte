<script lang="ts">
  import type { Lang } from "#shared/i18n.js";

  let { lang, onPick }: { lang: Lang; onPick: (lang: Lang) => void } = $props();

  const LANGS: { id: Lang; short: string; full: string }[] = [
    { id: "zh-CN", short: "简", full: "简体中文" },
    { id: "zh-TW", short: "繁", full: "繁體中文" },
    { id: "ja", short: "日", full: "日本語" },
    { id: "ko", short: "한", full: "한국어" },
    { id: "en", short: "En", full: "English" },
  ];

  let nav = $state<HTMLElement | undefined>();

  // the thumb slides under whichever button is selected, following width changes
  // as the strip collapses (short label) and expands (full labels on hover)
  $effect(() => {
    if (!nav) return;
    const selected = nav.querySelector<HTMLButtonElement>(`[data-lang="${lang}"]`);
    if (!selected) return;
    const place = () => {
      nav?.style.setProperty("--thumb-left", `${selected.offsetLeft}px`);
      nav?.style.setProperty("--thumb-width", `${selected.offsetWidth}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(selected);
    observer.observe(nav);
    return () => observer.disconnect();
  });

  // while the strip is expanding or collapsing, the thumb must track the
  // button every frame; a CSS transition here lags the shrinking container
  // and the thumb visually detaches. Selection changes in the steady state
  // keep the sliding transition.
  // state (not classList) so the compiler keeps the .tracking CSS rule alive
  let tracking = $state(false);
  let settleId: number | undefined;
  function trackLive(): void {
    tracking = true;
    clearTimeout(settleId);
    settleId = setTimeout(() => (tracking = false), 350);
  }
</script>

<nav
  bind:this={nav}
  class="langnav"
  class:tracking
  onpointerenter={trackLive}
  onpointerleave={trackLive}
  onfocusin={trackLive}
  onfocusout={trackLive}
>
  <span class="thumb" aria-hidden="true"></span>
  {#each LANGS as l (l.id)}
    <button
      type="button"
      data-lang={l.id}
      onclick={() => onPick(l.id)}
      aria-pressed={lang === l.id}
      title={l.full}
      class="langbtn {lang === l.id ? 'is-selected' : ''}"
    >
      {#if lang === l.id}
        <span class="short">{l.short}</span>
      {/if}
      <span class="full">{l.full}</span>
    </button>
  {/each}
</nav>

<style>
  .langnav {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.125rem;
    /* the thumb may lag the collapsing strip; clipping keeps it inside so the
       collapse reads as one glide to the right instead of a fling past the edge */
    overflow: hidden;
    border-radius: 9999px;
    border: 1px solid rgb(231 229 228 / 0.8);
    background: #fff;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .thumb {
    position: absolute;
    top: 0.125rem;
    bottom: 0.125rem;
    left: var(--thumb-left, 0.25rem);
    width: var(--thumb-width, 0px);
    border-radius: 9999px;
    background: rgb(28 25 23);
    transition:
      left 0.25s ease-out,
      width 0.25s ease-out;
  }

  .langnav.tracking .thumb {
    transition: none;
  }

  .langbtn {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.75rem;
    padding-inline: 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    line-height: 1;
    font-weight: 500;
    white-space: nowrap;
    color: rgb(120 113 108);
    transition:
      color 0.2s ease,
      max-width 0.25s ease-out,
      padding-inline 0.25s ease-out,
      opacity 0.2s ease-out,
      visibility 0s;
  }

  .langbtn:hover {
    color: rgb(41 37 36);
  }

  .langbtn.is-selected {
    color: #fff;
  }

  /* clipped container eats outer focus rings; draw the ring inside instead */
  .langbtn:focus-visible {
    outline: 2px solid rgb(249 115 22);
    outline-offset: -2px;
  }

  /* collapsed: only the selected language shows, as its short label; hidden
     buttons stay visible until the collapse animation has finished */
  .langnav:not(:hover):not(:focus-within) .langbtn:not(.is-selected) {
    max-width: 0;
    padding-inline: 0;
    opacity: 0;
    visibility: hidden;
    transition:
      color 0.2s ease,
      max-width 0.25s ease-out,
      padding-inline 0.25s ease-out,
      opacity 0.2s ease-out,
      visibility 0s linear 0.25s;
  }

  /* selected label cross-fades short -> full as the strip expands */
  .langbtn > .short,
  .langbtn > .full {
    transition:
      max-width 0.25s ease-out,
      opacity 0.15s ease-out;
  }

  .langbtn > .short {
    max-width: 3em;
  }

  .langbtn > .full {
    max-width: 0;
    opacity: 0;
  }

  .langnav:hover .langbtn > .full,
  .langnav:focus-within .langbtn > .full {
    max-width: 7em;
    opacity: 1;
    transition-delay: 0.05s;
  }

  .langnav:hover .langbtn > .short,
  .langnav:focus-within .langbtn > .short {
    max-width: 0;
    opacity: 0;
  }

  /* devices without hover: the strip can never expand on demand, so show all
     languages with full labels at all times (the header wraps on narrow screens) */
  @media (hover: none) {
    .langbtn > .short {
      display: none;
    }

    .langbtn > .full {
      max-width: 7em;
      opacity: 1;
    }

    .langnav:not(:hover):not(:focus-within) .langbtn:not(.is-selected) {
      max-width: 7em;
      padding-inline: 0.75rem;
      opacity: 1;
      visibility: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb,
    .langbtn,
    .langbtn > .short,
    .langbtn > .full {
      transition-duration: 0.01ms;
    }
  }
</style>
