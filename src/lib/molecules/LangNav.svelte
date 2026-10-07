<script lang="ts">
  import type { Lang } from "#shared/i18n.js";
  import Icon from "#lib/atoms/Icon.svelte";

  let {
    lang,
    label,
    onPick,
  }: {
    lang: Lang;
    label: string;
    onPick: (lang: Lang) => void;
  } = $props();

  const LANGS: { id: Lang; short: string; full: string }[] = [
    { id: "zh-CN", short: "简", full: "简体中文" },
    { id: "zh-TW", short: "繁", full: "繁體中文" },
    { id: "ja", short: "日", full: "日本語" },
    { id: "ko", short: "한", full: "한국어" },
    { id: "en", short: "En", full: "English" },
  ];

  const current = $derived(LANGS.find((l) => l.id === lang) ?? LANGS[0]!);

  let nav = $state<HTMLElement | undefined>();

  /* touch: the strip is a dropdown opened by tapping the trigger;
     hover devices expand on hover exactly as before */
  let open = $state(false);

  function toggle(): void {
    open = !open;
  }

  function pick(next: Lang): void {
    onPick(next);
    open = false;
  }

  function onWindowClick(e: MouseEvent): void {
    if (open && nav && !nav.contains(e.target as Node)) open = false;
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") open = false;
  }

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

  // clicking a language leaves the button focused, and :focus-within keeps the
  // strip expanded after the pointer leaves. Drop pointer-acquired focus about
  // a second after hover-out so the strip shrinks on its own; keyboard focus
  // (tabbing) is never blurred.
  let focusFromPointer = false;
  let collapseId: number | undefined;

  function onEnter(): void {
    trackLive();
    clearTimeout(collapseId);
  }

  function onLeave(): void {
    trackLive();
    clearTimeout(collapseId);
    collapseId = setTimeout(() => {
      if (!focusFromPointer) return;
      focusFromPointer = false;
      (nav?.querySelector(":focus") as HTMLElement | null)?.blur();
    }, 1_000);
  }

  $effect(() => {
    return () => {
      clearTimeout(collapseId);
    };
  });
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<nav
  bind:this={nav}
  class="langnav"
  class:tracking
  class:open
  onpointerenter={onEnter}
  onpointerleave={onLeave}
  onpointerdown={() => (focusFromPointer = true)}
  onfocusin={trackLive}
  onfocusout={trackLive}
>
  <button
    type="button"
    class="langtrigger"
    onclick={toggle}
    aria-expanded={open}
    aria-haspopup="true"
    title={label}
  >
    <span class="langtrigger-label">{current.short}</span>
    <Icon name="chevronDown" size={14} />
  </button>
  <div class="strip">
    <span class="thumb" aria-hidden="true"></span>
    {#each LANGS as l (l.id)}
      <button
        type="button"
        data-lang={l.id}
        onclick={() => pick(l.id)}
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
  </div>
</nav>

<style>
  .langnav {
    position: relative;
    padding: 0.125rem;
    /* the thumb may lag the collapsing strip; clipping keeps it inside so the
       collapse reads as one glide to the right instead of a fling past the edge */
    overflow: hidden;
    border-radius: 9999px;
    border: 1px solid rgb(231 229 228 / 0.8);
    background: #fff;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  /* touch-only trigger: hidden wherever hover can expand the strip */
  .langtrigger {
    display: none;
  }

  .strip {
    display: flex;
    align-items: center;
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

  /* devices without hover: hover cannot expand the strip, and an always-open
     strip pushes the header to two rows. Collapse to a trigger pill; the strip
     becomes a dropdown overlay anchored to it. */
  @media (hover: none) {
    .langnav {
      padding: 0;
      border: 0;
      background: none;
      box-shadow: none;
      overflow: visible;
    }

    .langnav.tracking .thumb {
      transition: none;
    }

    .langtrigger {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      height: 2.25rem;
      padding-inline: 0.875rem;
      border-radius: 9999px;
      border: 1px solid rgb(231 229 228 / 0.8);
      background: #fff;
      box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      font-size: 0.75rem;
      font-weight: 600;
      color: rgb(68 64 60);
      transition: border-color 0.2s ease;
    }

    .langtrigger:focus-visible {
      outline: 2px solid rgb(249 115 22);
      outline-offset: 2px;
    }

    .langtrigger :global(svg) {
      color: rgb(168 162 158);
      transition: transform 0.2s ease-out;
    }

    .langnav.open .langtrigger :global(svg) {
      transform: rotate(180deg);
    }

    .thumb {
      display: none;
    }

    .strip {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 40;
      flex-direction: column;
      align-items: stretch;
      min-width: 9rem;
      padding: 0.375rem;
      border-radius: 0.75rem;
      border: 1px solid rgb(231 229 228 / 0.9);
      background: #fff;
      box-shadow:
        0 4px 6px -1px rgb(0 0 0 / 0.08),
        0 10px 15px -3px rgb(0 0 0 / 0.1);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-0.25rem);
      pointer-events: none;
      transition:
        opacity 0.15s ease-out,
        transform 0.15s ease-out,
        visibility 0s linear 0.15s;
    }

    .langnav.open .strip {
      opacity: 1;
      visibility: visible;
      transform: none;
      pointer-events: auto;
      transition-delay: 0s;
    }

    .langbtn {
      justify-content: flex-start;
      height: 2.25rem;
      max-width: none;
      padding-inline: 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      opacity: 1;
      visibility: visible;
    }

    .langbtn > .short {
      display: none;
    }

    .langbtn > .full {
      max-width: none;
      opacity: 1;
    }

    .langbtn.is-selected {
      color: rgb(234 88 12);
      font-weight: 600;
    }

    /* neutralize the desktop collapse rule inside the dropdown */
    .langnav:not(:hover):not(:focus-within) .langbtn:not(.is-selected) {
      max-width: none;
      padding-inline: 0.75rem;
      opacity: 1;
      visibility: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb,
    .langbtn,
    .langbtn > .short,
    .langbtn > .full,
    .strip,
    .langtrigger :global(svg) {
      transition-duration: 0.01ms;
    }
  }
</style>
