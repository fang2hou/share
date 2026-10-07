<script lang="ts">
  import { onMount, tick, untrack, type Snippet } from "svelte";
  import { messages, type Lang } from "../i18n.js";
  import { loadLangFonts } from "./fonts.js";

  let { children, lang = "en" }: { children: Snippet; lang?: Lang } = $props();
  let displayLang = $state(untrack(() => lang));
  let ready = $state(false);
  let fallback = $state(false);

  onMount(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout>;
    async function prepare(): Promise<void> {
      // Header effects restore the locale before waiting for its font slices.
      await tick();
      const current = document.documentElement.lang;
      const locale = Object.hasOwn(messages, current) ? (current as Lang) : lang;
      displayLang = locale;
      const fonts = (async () => {
        await loadLangFonts(locale);
        await Promise.all([
          ...[400, 500, 600, 700].map((weight) =>
            document.fonts.load(`${weight} 16px "IBM Plex Sans"`, "share"),
          ),
          document.fonts.load('400 16px "IBM Plex Mono"', "filename"),
        ]);
        await document.fonts.ready;
        if (!document.fonts.check('700 16px "IBM Plex Sans"', "share"))
          throw new Error("font_unavailable");
        return true;
      })().catch(() => false);
      const deadline = new Promise<false>(
        (resolve) => (timeout = setTimeout(() => resolve(false), 1800)),
      );
      const loaded = await Promise.race([fonts, deadline]);
      clearTimeout(timeout);
      if (disposed) return;
      // A stalled font must not swap in after the fallback page becomes visible.
      fallback = !loaded;
      await tick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!disposed) {
        ready = true;
        await tick();
        if (document.activeElement === document.body)
          document.querySelector<HTMLElement>("[autofocus]")?.focus({ preventScroll: true });
      }
    }
    void prepare();
    return () => {
      disposed = true;
      clearTimeout(timeout);
    };
  });
</script>

<svelte:head>
  <noscript
    ><style>
      .ready-frame-content {
        visibility: visible !important;
      }
      .ready-frame-loader {
        display: none !important;
      }
    </style></noscript
  >
</svelte:head>
<div class="ready-frame-content" class:ready class:font-fallback={fallback}>
  {@render children()}
</div>
{#if !ready}
  <div class="ready-frame-loader" role="status" aria-label={messages[displayLang].loading}>
    <span></span><span></span><span></span>
  </div>
{/if}

<style>
  .ready-frame-content {
    visibility: hidden;
  }
  .ready-frame-content.ready {
    visibility: visible;
  }
  .font-fallback {
    font-family: system-ui, sans-serif;
  }
  .font-fallback :global(.code-font) {
    font-family: ui-monospace, monospace;
  }
  .ready-frame-loader {
    opacity: 0;
    animation: reveal-loader 0s 120ms forwards;
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    pointer-events: none;
  }
  .ready-frame-loader span {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: #78716c;
    animation: pulse 900ms ease-in-out infinite;
  }
  .ready-frame-loader span:nth-child(2) {
    animation-delay: 150ms;
  }
  .ready-frame-loader span:nth-child(3) {
    animation-delay: 300ms;
  }
  @keyframes reveal-loader {
    to {
      opacity: 1;
    }
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ready-frame-loader span {
      animation: none;
    }
  }
</style>
