<script lang="ts">
  import { LANGUAGES } from "#lib/languages.js";

  let {
    value = $bindable(null),
    placeholder,
    searchPlaceholder,
    noResults,
    clearLabel,
  }: {
    /** current suffix, e.g. "cpp"; null = unset */
    value?: string | null;
    placeholder: string;
    searchPlaceholder: string;
    noResults: string;
    clearLabel: string;
  } = $props();

  const id = $props.id();
  let root = $state<HTMLDivElement | undefined>();
  let input = $state<HTMLInputElement | undefined>();
  let list = $state<HTMLUListElement | undefined>();
  let open = $state(false);
  let floating = $state(false);
  let query = $state("");
  let filtering = $state(false);
  let highlightIndex = $state(0);
  let above = $state(false);
  let listHeight = $state(256);
  let thumbHeight = $state(0);
  let thumbTop = $state(0);
  let scrollbarVisible = $state(false);
  let dragging = $state(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let dragStart: { pointerId: number; y: number; scrollTop: number } | undefined;

  function updateScrollbar(node: HTMLUListElement): void {
    const height = node.clientHeight;
    const overflow = node.scrollHeight - height;
    const trackHeight = Math.max(0, height - 8);
    const size =
      overflow > 0
        ? Math.min(trackHeight, Math.max(24, (trackHeight * height) / node.scrollHeight))
        : 0;
    thumbHeight = size;
    thumbTop = overflow > 0 ? ((trackHeight - size) * node.scrollTop) / overflow : 0;
  }

  function showScrollbar(): void {
    clearTimeout(hideTimer);
    scrollbarVisible = true;
    hideTimer = setTimeout(() => {
      if (!dragging) scrollbarVisible = false;
    }, 900);
  }

  function trackScrollbar(node: HTMLUListElement): () => void {
    const update = (): void => updateScrollbar(node);
    const onScroll = (): void => {
      update();
      showScrollbar();
    };
    const resize = new ResizeObserver(update);
    const content = new MutationObserver(update);
    resize.observe(node);
    content.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      resize.disconnect();
      content.disconnect();
      node.removeEventListener("scroll", onScroll);
      clearTimeout(hideTimer);
    };
  }

  function startDrag(e: PointerEvent): void {
    if (!list || e.button !== 0) return;
    e.preventDefault();
    dragStart = { pointerId: e.pointerId, y: e.clientY, scrollTop: list.scrollTop };
    dragging = true;
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    showScrollbar();
  }

  function moveDrag(e: PointerEvent): void {
    if (!list || !dragStart || dragStart.pointerId !== e.pointerId) return;
    const travel = list.clientHeight - 8 - thumbHeight;
    if (travel <= 0) return;
    list.scrollTop =
      dragStart.scrollTop +
      ((e.clientY - dragStart.y) * (list.scrollHeight - list.clientHeight)) / travel;
  }

  function endDrag(e: PointerEvent): void {
    if (dragStart?.pointerId !== e.pointerId) return;
    dragStart = undefined;
    dragging = false;
    showScrollbar();
  }

  const filtered = $derived(
    !filtering || query.trim() === ""
      ? LANGUAGES
      : LANGUAGES.filter(
          (l) =>
            l.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            l.suffix.includes(query.trim().toLowerCase().replace(/^\./, "")),
        ),
  );
  const activeSuffix = $derived(open ? filtered[highlightIndex]?.suffix : undefined);

  function positionPanel(): void {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const spaceBelow = bottom - rect.bottom - 12;
    const spaceAbove = rect.top - top - 12;
    above = spaceBelow < 160 && spaceAbove > spaceBelow;
    listHeight = Math.max(0, Math.min(256, (above ? spaceAbove : spaceBelow) - 10));
  }

  function openPanel(): void {
    if (open) return;
    query = value ?? "";
    filtering = false;
    highlightIndex = Math.max(
      0,
      LANGUAGES.findIndex((l) => l.suffix === value),
    );
    positionPanel();
    floating = true;
    open = true;
    input?.select();
  }

  function closePanel(): void {
    // Keep the results unchanged while the surface fades out.
    open = false;
    scrollbarVisible = false;
    clearTimeout(hideTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) floating = false;
  }

  function pick(suffix: string): void {
    value = suffix;
    input?.focus({ preventScroll: true });
    closePanel();
  }

  function clear(): void {
    value = null;
    query = "";
    filtering = false;
    highlightIndex = 0;
    input?.focus({ preventScroll: true });
  }

  function onInput(e: Event): void {
    query = (e.currentTarget as HTMLInputElement).value;
    filtering = true;
    highlightIndex = 0;
    if (!open) {
      positionPanel();
      floating = true;
      open = true;
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      highlightIndex = Math.max(0, Math.min(highlightIndex + step, filtered.length - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const entry = filtered[highlightIndex];
      if (entry) pick(entry.suffix);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    } else if (e.key === "Tab") {
      closePanel();
    }
  }

  function onOutsidePointer(e: PointerEvent): void {
    if (open && root && !root.contains(e.target as Node)) closePanel();
  }

  function onFocusout(e: FocusEvent): void {
    if (!root?.contains(e.relatedTarget as Node | null)) closePanel();
  }

  function trackViewport(): () => void {
    const viewport = window.visualViewport;
    const update = (): void => {
      if (open) positionPanel();
    };
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }

  $effect(() => {
    if (!open || !list || !activeSuffix) return;
    const option = list.querySelector<HTMLButtonElement>(`[data-suffix="${activeSuffix}"]`);
    if (!option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top });
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: bottom - list.clientHeight });
    }
  });
</script>

<svelte:window
  onpointerdown={onOutsidePointer}
  onresize={() => open && positionPanel()}
  onscroll={() => open && positionPanel()}
/>

<div
  bind:this={root}
  {@attach trackViewport}
  onfocusout={onFocusout}
  class="picker group/picker relative data-floating:z-40"
  data-open={open}
  data-above={above}
  data-floating={floating ? "" : undefined}
  style="--list-height: {listHeight}px"
>
  <input
    bind:this={input}
    value={open ? query : (value ?? "")}
    onfocus={openPanel}
    onclick={openPanel}
    oninput={onInput}
    onkeydown={onKeydown}
    role="combobox"
    aria-label={placeholder}
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-autocomplete="list"
    aria-activedescendant={activeSuffix ? `${id}-${activeSuffix}` : undefined}
    placeholder={open && !value ? searchPlaceholder : placeholder}
    autocomplete="off"
    spellcheck="false"
    class="font-mono relative z-10 h-9 w-full rounded-lg border px-2.5 pr-8 text-base text-stone-700 transition-colors duration-120 placeholder:font-sans placeholder:text-stone-400 focus:outline-none pointer-fine:text-sm motion-reduce:transition-none {open
      ? 'border-transparent bg-transparent'
      : 'border-stone-300/90 bg-white hover:border-stone-400 focus:border-stone-500'}"
  />
  <button
    type="button"
    tabindex={value ? 0 : -1}
    aria-label={value ? clearLabel : searchPlaceholder}
    aria-expanded={value ? undefined : open}
    aria-controls={value ? undefined : `${id}-list`}
    onmousedown={(e) => e.preventDefault()}
    onclick={() => {
      if (value) clear();
      else if (open) closePanel();
      else {
        input?.focus({ preventScroll: true });
        openPanel();
      }
    }}
    class="absolute top-1/2 right-1 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-2 focus-visible:outline-orange-500/40"
  >
    <svg
      class="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {#if value}
        <path d="M18 6 6 18M6 6l12 12" />
      {:else}
        <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
      {/if}
    </svg>
  </button>

  <div
    class="picker-panel pointer-events-none invisible absolute inset-x-0 top-0 z-0 pt-9 opacity-0 group-data-[open=true]/picker:pointer-events-auto group-data-[open=true]/picker:visible group-data-[open=true]/picker:opacity-100 group-data-[above=true]/picker:top-auto group-data-[above=true]/picker:bottom-0 group-data-[above=true]/picker:pt-0 group-data-[above=true]/picker:pb-9 rounded-lg border border-stone-400 bg-white shadow-lg"
    inert={!open}
    aria-hidden={!open}
    ontransitionend={(e) => {
      if (e.target === e.currentTarget && !open) floating = false;
    }}
  >
    <div class="relative">
      <ul
        bind:this={list}
        {@attach trackScrollbar}
        id="{id}-list"
        role="listbox"
        aria-label={placeholder}
        class="scrollbar-none relative max-h-(--list-height) overflow-y-auto overscroll-contain border-t border-stone-100 p-1 group-data-[above=true]/picker:border-t-0 group-data-[above=true]/picker:border-b"
      >
        {#each filtered as entry, i (entry.suffix)}
          <li role="presentation">
            <button
              type="button"
              id="{id}-{entry.suffix}"
              role="option"
              tabindex="-1"
              aria-selected={entry.suffix === value}
              data-suffix={entry.suffix}
              title="{entry.name} (.{entry.suffix})"
              onmousedown={(e) => e.preventDefault()}
              onclick={() => pick(entry.suffix)}
              onpointerenter={(e) => {
                if (e.pointerType === "mouse") highlightIndex = i;
              }}
              class="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded px-2 text-left text-sm transition-colors {entry.suffix ===
              value
                ? 'font-medium text-stone-900'
                : 'text-stone-600'} {i === highlightIndex ? 'bg-stone-100' : ''}"
            >
              <span class="truncate">{entry.name}</span>
              <span
                class="font-mono shrink-0 text-xs {entry.suffix === value
                  ? 'text-orange-600'
                  : 'text-stone-400'}">.{entry.suffix}</span
              >
            </button>
          </li>
        {:else}
          <li role="presentation" class="px-2 py-4 text-center text-sm text-stone-400">
            {noResults}
          </li>
        {/each}
      </ul>
      <button
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none absolute top-1 right-1 w-1 touch-none rounded-full border-0 bg-stone-400/35 p-0 opacity-0 transition-opacity duration-300 data-[visible=true]:pointer-events-auto data-[visible=true]:opacity-100 data-[visible=true]:duration-80 data-[dragging=true]:bg-stone-500/55 motion-reduce:transition-none"
        data-visible={open && thumbHeight > 0 && scrollbarVisible}
        data-dragging={dragging}
        style="height: {thumbHeight}px; transform: translateY({thumbTop}px)"
        onpointerdown={startDrag}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onlostpointercapture={endDrag}
      ></button>
    </div>
  </div>
</div>

<style>
  /* Delay visibility until the fade finishes so floating panels can close smoothly. */
  .picker-panel {
    transition:
      opacity 120ms ease,
      visibility 0s 120ms;
  }

  .picker[data-open="true"] .picker-panel {
    transition:
      opacity 160ms ease,
      visibility 0s;
  }

  @media (prefers-reduced-motion: reduce) {
    .picker-panel,
    .picker[data-open="true"] .picker-panel {
      transition: none;
    }
  }
</style>
