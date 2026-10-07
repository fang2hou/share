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

  let root = $state<HTMLDivElement | undefined>();
  let search = $state<HTMLInputElement | undefined>();
  let open = $state(false);
  // panel stays mounted after first open; animation is pure CSS class toggling
  let everOpened = $state(false);
  let query = $state("");
  let highlightIndex = $state(0);

  const display = $derived(LANGUAGES.find((l) => l.suffix === value) ?? null);
  const filtered = $derived(
    query.trim() === ""
      ? LANGUAGES
      : LANGUAGES.filter(
          (l) =>
            l.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            l.suffix.includes(query.trim().toLowerCase()),
        ),
  );

  function openPanel(): void {
    if (open) return;
    open = true;
    everOpened = true;
    query = "";
    highlightIndex = Math.max(
      0,
      filtered.findIndex((l) => l.suffix === value),
    );
  }

  $effect(() => {
    // focus the search box as soon as the open panel mounts it
    if (open && search) search.focus();
  });
  function closePanel(): void {
    open = false;
    query = "";
  }

  function pick(suffix: string): void {
    value = suffix === value ? null : suffix;
    closePanel();
  }

  function onSearchKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = filtered[highlightIndex];
      if (entry) pick(entry.suffix);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
    }
  }

  // click outside closes the panel; the trigger keeps its position
  $effect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (open && root && !root.contains(e.target as Node)) closePanel();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  });
</script>

<div class="relative" bind:this={root}>
  <button
    type="button"
    onclick={openPanel}
    class="code-font flex h-9 w-full items-center justify-between gap-1 rounded-lg border border-stone-300/90 bg-white px-2.5 text-left text-sm text-stone-700 transition-colors hover:border-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-orange-500/15 focus:outline-none {open
      ? 'opacity-0'
      : ''}"
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="truncate pr-4">
      {display ? `${display.suffix} · ${display.name}` : placeholder}
    </span>
  </button>
  {#if value && !open}
    <button
      type="button"
      class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
      aria-label={clearLabel}
      onclick={(e) => {
        e.stopPropagation();
        value = null;
      }}
    >
      <svg
        class="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  {/if}

  {#if everOpened}
    <div
      class="squircle absolute top-0 left-0 z-40 w-72 origin-top rounded-xl border border-stone-200 bg-white shadow-lg transition-[opacity,transform] duration-150 ease-out {open
        ? 'scale-100 opacity-100'
        : 'pointer-events-none scale-[0.98] -translate-y-1 opacity-0'}"
      role="listbox"
    >
      <div class="border-b border-stone-100 p-2">
        <input
          bind:this={search}
          bind:value={query}
          onkeydown={onSearchKeydown}
          placeholder={searchPlaceholder}
          class="h-8 w-full rounded bg-stone-100 px-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
        />
      </div>
      <ul class="max-h-64 overflow-y-auto p-1">
        {#each filtered as entry, i (entry.suffix)}
          <li>
            <button
              type="button"
              role="option"
              aria-selected={entry.suffix === value}
              class="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors {entry.suffix ===
              value
                ? 'bg-stone-100 font-medium text-stone-900'
                : 'text-stone-600 hover:bg-stone-100'} {i === highlightIndex ? 'bg-stone-100' : ''}"
              onclick={() => pick(entry.suffix)}
              onpointerenter={() => (highlightIndex = i)}
            >
              <span class="truncate">{entry.name}</span>
              <span class="code-font ml-3 shrink-0 text-xs text-stone-400">.{entry.suffix}</span>
            </button>
          </li>
        {:else}
          <li class="px-3 py-4 text-center text-sm text-stone-400">{noResults}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
