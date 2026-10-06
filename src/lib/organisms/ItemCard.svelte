<script lang="ts">
  import type { Lang, Messages } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import Icon from "#lib/atoms/Icon.svelte";
  import CardMeta from "#lib/molecules/CardMeta.svelte";
  import ActionMenu from "#lib/molecules/ActionMenu.svelte";
  import SharePanel from "#lib/molecules/SharePanel.svelte";
  import { formatFileSize } from "#lib/format.js";
  import { copyText } from "#lib/clipboard.js";

  let {
    item,
    now,
    lang,
    m,
    pending,
    onSave,
    onShare,
    onDelete,
  }: {
    item: Item;
    now: number;
    lang: Lang;
    m: Messages;
    pending: boolean;
    onSave: (text: string) => Promise<boolean>;
    onShare: (active: boolean, maxDownloads: number | null) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let saveFailed = $state(false);
  let copyState = $state<"idle" | "ok" | "fail">("idle");
  let resetCopyId: number | undefined;
  let shareOpen = $state(false);

  function startEdit(): void {
    draft = item.text;
    saveFailed = false;
    editing = true;
  }

  async function save(): Promise<void> {
    const text = draft.trim();
    if (text.length === 0) return;
    if (text === item.text) {
      editing = false;
      return;
    }
    saving = true;
    const ok = await onSave(text);
    saving = false;
    if (ok) editing = false;
    else saveFailed = true;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!saving) void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      editing = false;
    }
  }

  async function copy(): Promise<void> {
    copyState = (await copyText(item.text)) ? "ok" : "fail";
    clearTimeout(resetCopyId);
    resetCopyId = setTimeout(() => (copyState = "idle"), 1_500);
  }
</script>

<article
  class="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-opacity {pending
    ? 'opacity-60'
    : ''}"
>
  <div class="flex gap-3">
    <div class="min-w-0 flex-1">
      {#if item.kind === "file"}
        <CardMeta {now} {lang} createdAt={item.createdAt} />
        <p class="mt-2 flex min-w-0 items-center gap-2 text-base leading-relaxed text-stone-800">
          <Icon name="fileText" size={18} />
          <span class="truncate font-medium">{item.fileName}</span>
          {#if item.fileSize !== undefined}
            <span class="shrink-0 text-sm text-stone-400">{formatFileSize(item.fileSize)}</span>
          {/if}
        </p>
      {:else if editing}
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          bind:value={draft}
          onkeydown={onKeydown}
          autofocus
          class="min-h-20 w-full rounded-xl border border-stone-300/90 bg-white p-3 text-base leading-relaxed field-sizing-content transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-orange-500/15 focus:outline-none"
        ></textarea>
        <p class="kbd-hint mt-2 text-xs text-stone-400">
          {m.editHint}
          {#if saveFailed}<span class="font-medium text-red-600">{m.saveFailed}</span>{/if}
        </p>
        <div class="mt-2 flex gap-2">
          <button
            onclick={() => void save()}
            disabled={saving}
            class="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {m.save}
          </button>
          <button
            onclick={() => (editing = false)}
            class="rounded-lg px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
          >
            {m.cancel}
          </button>
        </div>
      {:else}
        <CardMeta {now} {lang} createdAt={item.createdAt} />
        <p class="mt-2 text-base leading-relaxed break-words whitespace-pre-wrap text-stone-800">
          {item.text}
        </p>
      {/if}
    </div>

    {#if !editing}
      {#if !pending}
        <div class="flex shrink-0 items-start">
          <ActionMenu
            {m}
            showEdit={item.kind === "text"}
            shareActive={item.share?.active === true}
            onShare={() => (shareOpen = !shareOpen)}
            onEdit={startEdit}
            {onDelete}
          />
        </div>
      {/if}

      <!-- full-height rail inset 4px from the card edge: card 16px - 4px gap
           = 12px button radius, concentric with the card corners -->
      {#if item.kind === "file"}
        <a
          href="/api/files/{item.id}"
          download
          aria-label={m.download}
          title={m.download}
          class="-my-3 -mr-3 flex w-14 shrink-0 items-center justify-center self-stretch rounded-xl bg-stone-900 text-white transition-all hover:bg-stone-700 active:scale-[.98]"
        >
          <Icon name="download" size={17} />
        </a>
      {:else}
        <button
          onclick={() => void copy()}
          aria-label={copyState === "ok" ? m.copied : m.copy}
          title={copyState === "ok" ? m.copied : m.copy}
          class="-my-3 -mr-3 flex w-14 shrink-0 items-center justify-center self-stretch rounded-xl text-white transition-all active:scale-[.98] {copyState ===
          'ok'
            ? 'bg-emerald-600'
            : copyState === 'fail'
              ? 'bg-red-600'
              : 'bg-stone-900 hover:bg-stone-700'}"
        >
          <Icon name={copyState === "ok" ? "check" : "copy"} size={17} />
        </button>
      {/if}
    {/if}
  </div>

  {#if !editing && !pending && shareOpen}
    <SharePanel {item} {m} {onShare} />
  {/if}
</article>
