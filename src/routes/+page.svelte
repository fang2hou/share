<script lang="ts">
  import { flushSync, onMount } from "svelte";
  import Composer from "#lib/organisms/Composer.svelte";
  import ItemCard from "#lib/organisms/ItemCard.svelte";
  import type { CardApi } from "#lib/organisms/ItemCard.svelte";
  import UploadCard from "#lib/organisms/UploadCard.svelte";
  import { suppressContextMenu } from "#shared/ui/chrome.js";
  import AppHeader from "#shared/ui/AppHeader.svelte";
  import { FileStage } from "#lib/stage.svelte.js";
  import { formatCount, messages, pickLang, type Lang } from "#shared/i18n.js";
  import { MAX_FILE_BYTES, MAX_COLLECTION_FILES, type Item } from "#shared/protocol.js";
  import { SpaceStore } from "#lib/space.svelte.js";
  import { mountFavicon, setFaviconBadge } from "#lib/favicon.js";
  import { dayKey, dayKeyOffset, dayLabel } from "#lib/time.js";

  function initialLang(): Lang {
    const saved = localStorage.getItem("ts_lang");
    if (saved !== null && Object.hasOwn(messages, saved)) return saved as Lang;
    return pickLang(navigator.languages);
  }

  let lang = $state(initialLang());
  const m = $derived(messages[lang]);
  function setLang(next: Lang): void {
    lang = next;
  }

  const space = new SpaceStore({ onRemote: () => bumpUnread() });
  const stage = new FileStage();
  // physical-keyboard proxy: only these devices see Shift+Enter / Esc hints
  const hasKeyboard = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Unread means new remote content received while this page was unattended.
  let unread = 0;
  function applyUnread(): void {
    setFaviconBadge(unread);
    document.title = unread > 0 ? `share. (+${unread})` : "share.";
  }
  function bumpUnread(): void {
    if (document.visibilityState === "visible" && document.hasFocus()) return;
    unread = Math.min(unread + 1, 99);
    applyUnread();
  }

  let now = $state(Date.now());
  let notice = $state("");
  let clearNoticeId: number | undefined;
  let dragging = $state(0);
  let mode = $state<"text" | "file">(localStorage.getItem("ts_mode") === "file" ? "file" : "text");
  /** per-day expand overrides; absence = default (today/yesterday open, older closed) */
  let dayOverrides = $state<Record<string, boolean>>({});

  function setMode(next: "text" | "file"): void {
    if (next === mode) return;
    localStorage.setItem("ts_mode", next);
    if (typeof document.startViewTransition !== "function") {
      mode = next;
      return;
    }
    // direction-aware swap: the composer slides the way the toggle thumb went;
    // the anim flag scopes the slide to this transition only, so unrelated
    // view transitions (list sink) leave the composer perfectly still
    document.documentElement.dataset.modeFrom = mode;
    document.documentElement.dataset.modeAnim = "";
    const t = document.startViewTransition(() =>
      flushSync(() => {
        mode = next;
      }),
    );
    t.finished.finally(() => delete document.documentElement.dataset.modeAnim);
  }

  const today = $derived(dayKeyOffset(now, 0));
  const yesterday = $derived(dayKeyOffset(now, 1));

  const visible: Item[] = $derived([...space.pending, ...space.items]);

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

  async function uploadOne(id: string): Promise<boolean> {
    const entry = stage.files.find((f) => f.id === id);
    if (!entry || stage.busy || stage.uploadingIds.includes(id)) return false;
    if (entry.file.size > MAX_FILE_BYTES) {
      showNotice(m.fileTooLarge);
      return false;
    }
    stage.uploadingIds.push(id);
    try {
      entry.collectionId ??= stage.collectionId ?? crypto.randomUUID();
      const ok = await space.uploadFile(entry.file, entry.id, entry.collectionId);
      if (ok) stage.remove(id);
      else showNotice(m.uploadFailed);
      return ok;
    } finally {
      stage.uploadingIds = stage.uploadingIds.filter((f) => f !== id);
    }
  }

  async function uploadStaged(): Promise<boolean> {
    if (stage.busy || stage.uploadingIds.length || stage.files.length === 0) return false;
    if (stage.files.some((f) => f.file.size > MAX_FILE_BYTES)) {
      showNotice(m.fileTooLarge);
      return false;
    }
    if (stage.files.length > MAX_COLLECTION_FILES) {
      showNotice(m.tooManyFiles);
      return false;
    }
    stage.busy = true;
    // Retain the collection and file IDs after a failure so retrying cannot duplicate uploads.
    const collectionId: string = stage.collectionId ?? crypto.randomUUID();
    stage.collectionId = collectionId;
    try {
      for (const entry of stage.files.slice()) {
        entry.collectionId ??= collectionId;
        if (!(await space.uploadFile(entry.file, entry.id, entry.collectionId))) {
          showNotice(m.uploadFailed);
          return false;
        }
        stage.remove(entry.id);
        stage.collectionId = collectionId;
      }
      if (stage.files.length === 0) stage.clear();
      return true;
    } finally {
      stage.busy = false;
    }
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
    if (document.visibilityState !== "visible") return;
    now = Date.now();
    acknowledgeUnread();
  }

  function acknowledgeUnread(): void {
    if (document.visibilityState !== "visible" || !document.hasFocus() || unread === 0) return;
    unread = 0;
    applyUnread();
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
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length > 0) {
      stage.add(files);
      setMode("file");
    }
  }

  function onPaste(e: ClipboardEvent): void {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length > 0) {
      stage.add(files);
      setMode("file");
    }
  }

  // ---- hover shortcuts: the card under the pointer (or focus) is the target
  const cardApis = new Map<string, CardApi>();
  let hoveredId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let confirmDeleteTimer: number | undefined;

  function registerCard(id: string, api: CardApi): () => void {
    cardApis.set(id, api);
    return () => {
      cardApis.delete(id);
    };
  }

  function cardIdFromEvent(e: Event): string | null {
    const el = (e.target as HTMLElement | null)?.closest?.("article[data-card-id]");
    return el?.getAttribute("data-card-id") ?? null;
  }

  function onCardPointerOver(e: PointerEvent): void {
    const id = cardIdFromEvent(e);
    if (id) hoveredId = id;
  }

  function onCardPointerOut(e: PointerEvent): void {
    const id = cardIdFromEvent(e);
    if (id && cardIdFromEvent({ ...e, target: e.relatedTarget }) !== id) hoveredId = null;
  }

  function onCardFocusIn(e: FocusEvent): void {
    const id = cardIdFromEvent(e);
    if (id) hoveredId = id;
  }

  function clearConfirmDelete(): void {
    confirmDeleteId = null;
    clearTimeout(confirmDeleteTimer);
  }

  function isTypingTarget(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    if (!el) return false;
    return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }

  function onShortcutKeydown(e: KeyboardEvent): void {
    if (confirmDeleteId !== null && e.key === "Escape") {
      e.preventDefault();
      clearConfirmDelete();
      return;
    }
    if (hoveredId === null || isTypingTarget(e.target)) return;
    const withMod = e.metaKey || e.ctrlKey;
    if (!withMod || e.altKey) return;
    const key = e.key.toLowerCase();
    const isCopy = key === "c" && !e.shiftKey;
    const isShare = key === "c" && e.shiftKey;
    const isEdit = key === "e";
    const isDel = key === "d";
    if (!isCopy && !isShare && !isEdit && !isDel) return;
    // a real selection wins over the shortcut copy
    if (isCopy && (window.getSelection()?.toString() ?? "").length > 0) return;
    const api = cardApis.get(hoveredId);
    if (!api) return;
    e.preventDefault();
    if (isDel) {
      if (confirmDeleteId === hoveredId) {
        clearConfirmDelete();
        void handleDelete(hoveredId);
      } else {
        confirmDeleteId = hoveredId;
        clearTimeout(confirmDeleteTimer);
        confirmDeleteTimer = setTimeout(clearConfirmDelete, 4_000);
      }
      return;
    }
    if (isCopy) api.copy();
    else if (isEdit) api.edit();
    else api.share();
  }

  onMount(() => {
    const cleanupFavicon = mountFavicon();
    applyUnread();
    space.connect();
    const tickId = setInterval(() => (now = Date.now()), 15_000);
    return () => {
      cleanupFavicon();
      clearInterval(tickId);
      clearTimeout(clearNoticeId);
      stage.dispose();
      space.destroy();
    };
  });
</script>

<svelte:window
  onfocus={acknowledgeUnread}
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  onpaste={onPaste}
  onkeydown={onShortcutKeydown}
/>
<svelte:document onvisibilitychange={onVisibilityChange} />

<main
  onpointerover={onCardPointerOver}
  onpointerout={onCardPointerOut}
  onfocusin={onCardFocusIn}
  class="mx-auto max-w-3xl space-y-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:py-14 sm:pb-20"
>
  <AppHeader
    {lang}
    onPickLanguage={setLang}
    status={space.status}
    {mode}
    onPickMode={setMode}
    {notice}
  />
  <Composer
    {m}
    {mode}
    {hasKeyboard}
    {stage}
    onSubmit={(text, meta) => space.create(text, meta)}
    onError={() => showNotice(m.sendFailed)}
    onUpload={uploadStaged}
    onUploadOne={uploadOne}
  />
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
        {@attach suppressContextMenu}
        style:view-transition-name={`day-${group.key}`}
        class="ui-chrome flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-stone-100"
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
        <span class="text-xs text-stone-400">{formatCount(m.itemCount, group.items.length)}</span>
      </button>
      {#if group.expanded}
        {#each group.items as item (item.id)}
          <ItemCard
            {item}
            {now}
            {lang}
            {m}
            pending={space.pending.some((p) => p.id === item.id)}
            onSave={(text, meta) => space.update(item.id, text, meta)}
            onShare={(active, maxDownloads, password) =>
              space.setShare(item.id, active, maxDownloads, password)}
            onDelete={() => handleDelete(item.id)}
            register={registerCard}
            confirmDelete={confirmDeleteId === item.id}
            onDismissConfirm={clearConfirmDelete}
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
