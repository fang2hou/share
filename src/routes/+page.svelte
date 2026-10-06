<script lang="ts">
  import { onMount } from "svelte";
  import Composer from "#lib/Composer.svelte";
  import Icon from "#lib/Icon.svelte";
  import ItemCard from "#lib/ItemCard.svelte";
  import UploadCard from "#lib/UploadCard.svelte";
  import { buildUploadPayload } from "#lib/files.js";
  import { messages, pickLang, type Lang } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import { SpaceStore } from "#lib/space.svelte.js";
  import { dayKey, dayKeyOffset, dayLabel } from "#lib/time.js";

  const LANGS: { id: Lang; label: string }[] = [
    { id: "zh-CN", label: "简体中文" },
    { id: "ja", label: "日本語" },
    { id: "en", label: "English" },
  ];

  function initialLang(): Lang {
    const saved = localStorage.getItem("ts_lang");
    if (saved === "zh-CN" || saved === "ja" || saved === "en") return saved;
    return pickLang(navigator.languages);
  }

  let lang = $state(initialLang());
  const m = $derived(messages[lang]);
  $effect(() => {
    document.documentElement.lang = lang;
  });

  function setLang(next: Lang): void {
    lang = next;
    localStorage.setItem("ts_lang", next);
  }

  const space = new SpaceStore();

  let now = $state(Date.now());
  let notice = $state("");
  let clearNoticeId: number | undefined;
  let dragging = $state(0);
  let mode = $state<"text" | "file">(localStorage.getItem("ts_mode") === "file" ? "file" : "text");
  /** per-day expand overrides; absence = default (today/yesterday open, older closed) */
  let dayOverrides = $state<Record<string, boolean>>({});

  function setMode(next: "text" | "file"): void {
    mode = next;
    localStorage.setItem("ts_mode", next);
  }

  const today = $derived(dayKeyOffset(now, 0));
  const yesterday = $derived(dayKeyOffset(now, 1));

  const visible: Item[] = $derived([...space.pending, ...space.items]);
  const dotClass = $derived(
    space.status === "live"
      ? "bg-emerald-500"
      : space.status === "reconnecting"
        ? "bg-amber-500"
        : "bg-stone-300",
  );

  type DayGroup = { key: string; label: string; items: Item[]; expanded: boolean };

  // newest first; today and yesterday stay open, older days collapse by default
  const groups = $derived.by(() => {
    const byDay = new Map<string, Item[]>();
    for (const item of visible) {
      const key = dayKey(item.createdAt);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(item);
      else byDay.set(key, [item]);
    }
    const result: DayGroup[] = [];
    for (const [key, items] of byDay) {
      const first = items[0];
      if (first === undefined) continue;
      const override = dayOverrides[key];
      const expanded = override ?? (key === today || key === yesterday);
      result.push({ key, label: dayLabel(first.createdAt, lang), items, expanded });
    }
    return result;
  });

  function toggleDay(key: string): void {
    dayOverrides[key] = !(dayOverrides[key] ?? (key === today || key === yesterday));
  }

  function showNotice(text: string): void {
    notice = text;
    clearTimeout(clearNoticeId);
    clearNoticeId = setTimeout(() => (notice = ""), 4_000);
  }

  async function handleFiles(list: File[]): Promise<void> {
    const payload = await buildUploadPayload(list);
    if ("error" in payload) {
      if (payload.error === "too_large") showNotice(m.fileTooLarge);
      return;
    }
    const ok = await space.uploadFile(payload.file);
    if (!ok) showNotice(m.uploadFailed);
  }

  async function handleDelete(id: string): Promise<boolean> {
    const ok = await space.removeItem(id);
    if (!ok) showNotice(m.deleteFailed);
    return ok;
  }

  function dragHasFiles(e: DragEvent): boolean {
    return [...(e.dataTransfer?.types ?? [])].includes("Files");
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "visible") now = Date.now();
  }

  function onDragEnter(e: DragEvent): void {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragging++;
  }

  function onDragOver(e: DragEvent): void {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
  }

  function onDragLeave(e: DragEvent): void {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragging = Math.max(0, dragging - 1);
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    dragging = 0;
    void handleFiles([...(e.dataTransfer?.files ?? [])]);
  }

  function onPaste(e: ClipboardEvent): void {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length > 0) void handleFiles(files);
  }

  onMount(() => {
    space.connect();
    const tickId = setInterval(() => (now = Date.now()), 15_000);
    return () => {
      clearInterval(tickId);
      clearTimeout(clearNoticeId);
      space.destroy();
    };
  });
</script>

<svelte:window
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  onpaste={onPaste}
/>
<svelte:document onvisibilitychange={onVisibilityChange} />

<main class="mx-auto max-w-3xl space-y-4 px-4 py-6">
  <header class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="size-2 rounded-full {dotClass}" title={space.status}></span>
      <div
        class="relative flex items-center rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm"
        role="group"
        aria-label="{m.modeText} / {m.modeFiles}"
      >
        <span
          class="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-stone-900 transition-transform duration-200 ease-out"
          style="transform: translateX({mode === 'file' ? '100%' : '0%'})"
          aria-hidden="true"
        ></span>
        <button
          onclick={() => setMode("text")}
          aria-pressed={mode === "text"}
          title={m.modeText}
          class="relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200 {mode ===
          'text'
            ? 'text-white'
            : 'text-stone-400 hover:text-stone-700'}"
        >
          <Icon name="type" size={14} />
        </button>
        <button
          onclick={() => setMode("file")}
          aria-pressed={mode === "file"}
          title={m.modeFiles}
          class="relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200 {mode ===
          'file'
            ? 'text-white'
            : 'text-stone-400 hover:text-stone-700'}"
        >
          <Icon name="paperclip" size={14} />
        </button>
      </div>
    </div>
    <nav
      class="flex rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm"
      aria-label="Language / 语言 / 言語"
    >
      {#each LANGS as l (l.id)}
        <button
          onclick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          class="rounded-full px-3 py-1 text-xs font-medium transition-colors {lang === l.id
            ? 'bg-stone-900 text-white'
            : 'text-stone-500 hover:text-stone-900'}"
        >
          {l.label}
        </button>
      {/each}
    </nav>
  </header>

  <Composer
    {m}
    {mode}
    onSubmit={(text) => space.create(text)}
    onError={() => showNotice(m.sendFailed)}
    onFiles={(files) => void handleFiles(files)}
  />
  <p aria-live="polite" class="min-h-5 text-sm">
    {#if notice}
      <span class="font-medium text-red-600">{notice}</span>
    {:else if space.status === "reconnecting"}
      <span class="font-medium text-amber-600">{m.reconnecting}</span>
    {/if}
  </p>

  {#each space.uploads as u (u.id)}
    <UploadCard name={u.name} size={u.size} progress={u.progress} {m} />
  {/each}

  {#if visible.length === 0 && space.uploads.length === 0}
    <p
      class="rounded-2xl border border-dashed border-stone-300 py-16 text-center text-sm text-stone-400"
    >
      {m.empty}
    </p>
  {/if}

  {#each groups as group (group.key)}
    <section class="space-y-3">
      <button
        onclick={() => toggleDay(group.key)}
        aria-expanded={group.expanded}
        class="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-stone-100"
      >
        <svg
          class="size-4 shrink-0 text-stone-400 transition-transform {group.expanded
            ? 'rotate-90'
            : ''}"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span class="text-sm font-semibold text-stone-600">{group.label}</span>
        <span class="text-xs text-stone-400">{group.items.length} {m.items}</span>
      </button>
      {#if group.expanded}
        {#each group.items as item (item.id)}
          <ItemCard
            {item}
            {now}
            {lang}
            {m}
            pending={space.pending.some((p) => p.id === item.id)}
            onSave={(text) => space.update(item.id, text)}
            onShare={(active, maxDownloads) => space.setShare(item.id, active, maxDownloads)}
            onDelete={() => handleDelete(item.id)}
          />
        {/each}
      {/if}
    </section>
  {/each}

  {#if space.hasMore}
    <button
      onclick={() => void space.loadOlder()}
      class="w-full rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-900"
    >
      {m.loadOlder}
    </button>
  {/if}
</main>

{#if dragging > 0}
  <div
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-orange-500/10 backdrop-blur-[2px]"
  >
    <div
      class="rounded-3xl border-2 border-dashed border-orange-400 bg-white/90 px-10 py-8 shadow-lg"
    >
      <p class="text-lg font-semibold text-stone-800">{m.dropHere}</p>
    </div>
  </div>
{/if}
