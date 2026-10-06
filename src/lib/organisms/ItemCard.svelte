<script module lang="ts">
  export type CardApi = {
    copy(): void;
    edit(): void;
    share(): void;
    del(): void;
  };
</script>

<script lang="ts">
  import type { Lang, Messages } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import Icon from "#lib/atoms/Icon.svelte";
  import CardMeta from "#lib/molecules/CardMeta.svelte";
  import ActionMenu from "#lib/molecules/ActionMenu.svelte";
  import SharePanel from "#lib/molecules/SharePanel.svelte";
  import { formatFileSize } from "#lib/format.js";
  import { copyText } from "#lib/clipboard.js";
  import { keys } from "#lib/kbd.js";
  import { findLanguage } from "#lib/languages.js";
  import { highlightCode } from "#lib/highlight.js";

  let {
    item,
    now,
    lang,
    m,
    pending,
    onSave,
    onShare,
    onDelete,
    register,
    confirmDelete = false,
    onDismissConfirm = () => {},
  }: {
    item: Item;
    now: number;
    lang: Lang;
    m: Messages;
    pending: boolean;
    onSave: (text: string) => Promise<boolean>;
    onShare: (active: boolean, maxDownloads: number | null) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
    register?: (id: string, api: CardApi) => () => void;
    confirmDelete?: boolean;
    onDismissConfirm?: () => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let saveFailed = $state(false);
  let copyState = $state<"idle" | "ok" | "fail">("idle");
  let resetCopyId: number | undefined;
  let shareOpen = $state(false);
  let highlighted = $state("");

  const codeLang = $derived(findLanguage(item.kind === "text" ? item.suffix : null));

  // (re)highlight whenever the text or language changes; plain text while loading
  $effect(() => {
    const lang = codeLang;
    const text = item.text;
    if (!lang) return;
    let alive = true;
    void highlightCode(text, lang).then((html) => {
      if (alive) highlighted = html;
    });
    return () => {
      alive = false;
    };
  });

  function download(): void {
    if (!item.filename) return;
    const name = item.suffix ? `${item.filename}.${item.suffix}` : item.filename;
    const blob = new Blob([item.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  // page-level hover shortcuts call into the card through this API
  $effect(() => {
    return (
      register?.(item.id, {
        copy: () => void copy(),
        edit: () => {
          if (!pending && item.kind === "text") startEdit();
        },
        share: () => {
          if (!pending) shareOpen = !shareOpen;
        },
        del: () => {
          if (!pending) void onDelete();
        },
      }) ?? undefined
    );
  });
</script>

<article
  data-card-id={item.id}
  class="squircle relative rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-opacity {pending
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
          class="squircle min-h-20 w-full rounded-xl border border-stone-300/90 bg-white p-3 text-base leading-relaxed field-sizing-content transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-orange-500/15 focus:outline-none"
        ></textarea>
        <p class="kbd-hint mt-2 text-xs text-stone-400">
          {m.editHint.replaceAll("{saveKeys}", keys.save).replaceAll("{escKeys}", keys.esc)}
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
        {#if codeLang}
          <div class="mt-2 overflow-hidden rounded-lg border border-stone-200">
            <div
              class="flex items-center justify-between border-b border-stone-200 bg-stone-100/70 py-1 pr-2.5 pl-3"
            >
              <span class="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                {codeLang.name}
              </span>
              {#if item.filename}
                <span class="code-font truncate text-xs text-stone-400">
                  {item.filename}{item.suffix ? `.${item.suffix}` : ""}
                </span>
              {/if}
            </div>
            <pre
              class="code-font scroll-autohide hljs overflow-x-auto bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-800">{#if highlighted}{@html highlighted}{:else}{item.text}{/if}</pre>
          </div>
        {:else}
          <p class="mt-2 text-base leading-relaxed break-words whitespace-pre-wrap text-stone-800">
            {item.text}
          </p>
        {/if}
      {/if}
    </div>

    {#if !editing}
      <div class="flex shrink-0 flex-col items-center gap-1.5">
        {#if item.kind === "file"}
          <a
            href="/api/files/{item.id}"
            download
            aria-label={m.download}
            title={m.download}
            class="squircle flex size-10 items-center justify-center rounded-xl bg-stone-900 text-white transition-all hover:bg-stone-700 active:scale-[.97]"
          >
            <Icon name="download" size={17} />
          </a>
        {:else}
          <button
            onclick={() => void copy()}
            aria-label={copyState === "ok" ? m.copied : m.copy}
            title={copyState === "ok" ? m.copied : m.copy}
            class="squircle flex size-10 items-center justify-center rounded-xl text-white transition-all active:scale-[.97] {copyState ===
            'ok'
              ? 'bg-emerald-600'
              : copyState === 'fail'
                ? 'bg-red-600'
                : 'bg-stone-900 hover:bg-stone-700'}"
          >
            <Icon name={copyState === "ok" ? "check" : "copy"} size={17} />
          </button>
        {/if}

        {#if !pending}
          <ActionMenu
            {m}
            showEdit={item.kind === "text"}
            showDownload={item.kind === "text" && !!item.filename}
            shareActive={item.share?.active === true}
            onShare={() => (shareOpen = !shareOpen)}
            onEdit={startEdit}
            onDownload={download}
            {onDelete}
          />
        {/if}
      </div>
    {/if}
  </div>

  {#if !editing && !pending && shareOpen}
    <SharePanel {item} {m} {onShare} />
  {/if}

  {#if confirmDelete}
    <div
      role="presentation"
      class="squircle absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/85 backdrop-blur-[2px]"
      onclick={onDismissConfirm}
      onkeydown={(e) => e.key === "Escape" && onDismissConfirm()}
    >
      <p class="px-4 text-center text-base font-medium text-red-600">
        {m.confirmDeleteKeys.replaceAll("{keys}", keys.del)}
      </p>
      <p class="kbd-hint text-xs text-stone-400">{keys.esc} · {m.cancel}</p>
    </div>
  {/if}
</article>
