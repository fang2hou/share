<script module lang="ts">
  export type CardApi = {
    copy(): void;
    edit(): void;
    share(): void;
    del(): void;
  };
</script>

<script lang="ts">
  import { formatCount, interpolate, type Lang, type Messages } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import Icon from "#shared/ui/Icon.svelte";
  import CardMeta from "#lib/molecules/CardMeta.svelte";
  import ActionMenu from "#lib/molecules/ActionMenu.svelte";
  import LangPicker from "#lib/molecules/LangPicker.svelte";
  import { fileTypeFromName } from "#shared/file-preview.js";
  import FileBrowser from "#shared/ui/FileBrowser.svelte";
  import SharePanel from "#lib/molecules/SharePanel.svelte";
  import { formatFileSize } from "#shared/format.js";
  import { spaceCjk } from "#lib/cjk.js";
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
    onSave: (text: string, meta: { filename?: string; suffix?: string }) => Promise<boolean>;
    onShare: (
      active: boolean,
      maxDownloads: number | null,
      password?: string | null,
    ) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
    register?: (id: string, api: CardApi) => () => void;
    confirmDelete?: boolean;
    onDismissConfirm?: () => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");
  let saveFailed = $state(false);
  let copyState = $state<"idle" | "ok" | "fail">("idle");
  let resetCopyId: number | undefined;
  let draftFilename = $state("");
  let draftSuffix = $state<string | null>(null);
  let highlighted = $state("");
  let shareOpen = $state(false);

  const cardFiles = $derived(
    item.kind === "file"
      ? (item.files ?? [
          {
            id: item.id,
            name: item.fileName ?? "download",
            size: item.fileSize ?? 0,
            type: fileTypeFromName(item.fileName ?? ""),
          },
        ])
      : [],
  );
  const isCollection = $derived(cardFiles.length > 1);
  const codeLang = $derived(findLanguage(item.kind === "text" ? item.suffix : null));
  let saving = $state(false);

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
    draftFilename = item.filename ?? "";
    draftSuffix = item.suffix ?? null;
    saveFailed = false;
    editing = true;
  }

  async function save(): Promise<void> {
    const text = draft.trim();
    if (text.length === 0) return;
    const meta = {
      filename: draftFilename.trim().length > 0 ? draftFilename.trim() : undefined,
      suffix: draftSuffix ?? undefined,
    };
    if (text === item.text && meta.filename === item.filename && meta.suffix === item.suffix) {
      editing = false;
      return;
    }
    saving = true;
    const ok = await onSave(text, meta);
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
  style:view-transition-name={`item-${item.id}`}
  class="squircle relative hover:z-1 hover:border-stone-300 hover:bg-[#fdfcfa] has-[[data-floating]]:z-1 [--file-list-radius:7px] rounded-2xl border border-stone-200/80 bg-white p-4 transition {pending
    ? 'opacity-60'
    : ''}"
>
  {#if editing}
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      bind:value={draft}
      onkeydown={onKeydown}
      autofocus
      class="min-h-20 w-full rounded-lg border border-stone-300/90 bg-white p-3 text-base leading-relaxed field-sizing-content transition placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-500 focus:outline-none pointer-fine:rounded-xl pointer-fine:squircle"
    ></textarea>
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <input
        bind:value={draftFilename}
        maxlength={64}
        placeholder={m.filenamePlaceholder}
        class="font-mono h-9 min-w-32 flex-1 rounded-lg border border-stone-300/90 bg-white px-2.5 text-base pointer-fine:text-sm text-stone-700 placeholder:font-sans placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-500 focus:outline-none"
      />
      <span
        class="relative top-0.5 text-xl leading-none font-bold text-stone-600"
        aria-hidden="true">.</span
      >
      <div class="w-36 shrink-0 sm:w-44">
        <LangPicker
          bind:value={draftSuffix}
          placeholder={m.suffixPlaceholder}
          searchPlaceholder={m.searchSuffix}
          noResults={m.noSuffixMatches}
          clearLabel={m.clearSuffix}
        />
      </div>
    </div>
    <p class="kbd-hint mt-2 text-xs text-stone-400">
      {interpolate(m.editHint, { saveKeys: keys.save, escKeys: keys.esc })}
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
    <!-- header row: time on the left, more-actions then the primary action on the right -->
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <CardMeta {now} {lang} createdAt={item.createdAt} />
      </div>
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
      {#if item.kind === "file"}
        <a
          href={isCollection
            ? `/api/files/${item.id}/zip`
            : `/api/files/${item.id}/${cardFiles[0]?.id ?? item.id}`}
          download
          aria-label={isCollection ? m.downloadZip : m.download}
          title={isCollection ? m.downloadZip : m.download}
          class="squircle flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white transition-all hover:bg-stone-700 active:scale-[.97]"
        >
          <Icon name="download" size={17} />
        </a>
      {:else}
        <button
          onclick={() => void copy()}
          aria-label={copyState === "ok" ? m.copied : m.copy}
          title={copyState === "ok" ? m.copied : m.copy}
          class="squircle flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-all active:scale-[.97] {copyState ===
          'ok'
            ? 'bg-emerald-600'
            : copyState === 'fail'
              ? 'bg-red-600'
              : 'bg-stone-900 hover:bg-stone-700'}"
        >
          <Icon name={copyState === "ok" ? "check" : "copy"} size={17} />
        </button>
      {/if}
    </div>

    {#if item.kind === "file"}
      {#if isCollection}
        <p class="mt-2 flex items-center gap-2 text-base text-stone-800">
          <Icon name="fileText" size={18} /><span class="font-medium"
            >{formatCount(m.fileCount, cardFiles.length)}</span
          ><span class="text-sm text-stone-400">{formatFileSize(item.fileSize ?? 0)}</span>
        </p>
      {/if}
      <FileBrowser files={cardFiles} base="/api/files/{item.id}" {m} />
    {:else if codeLang}
      <div class="mt-3 overflow-hidden rounded-lg border border-stone-200">
        <div
          class="flex items-center justify-between border-b border-stone-200 bg-stone-100/70 py-1 pr-2.5 pl-3"
        >
          <span class="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
            {codeLang.name}
          </span>
          {#if item.filename}
            <span class="font-mono truncate text-xs text-stone-400">
              {item.filename}{item.suffix ? `.${item.suffix}` : ""}
            </span>
          {/if}
        </div>
        {#if highlighted}
          {@html highlighted}
        {:else}
          <pre
            class="font-mono m-0 overflow-x-auto bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-800">{item.text}</pre>
        {/if}
      </div>
    {:else}
      <p class="mt-2 text-base leading-relaxed break-words whitespace-pre-wrap text-stone-800">
        {spaceCjk(item.text)}
      </p>
    {/if}
  {/if}

  {#if !editing && !pending && shareOpen}
    <SharePanel {item} {m} {onShare} onClose={() => (shareOpen = false)} />
  {/if}

  {#if confirmDelete}
    <div
      role="presentation"
      class="squircle absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/85 backdrop-blur-[2px]"
      onclick={onDismissConfirm}
      onkeydown={(e) => e.key === "Escape" && onDismissConfirm()}
    >
      <p class="px-4 text-center text-base font-medium text-red-600">
        {interpolate(m.confirmDeleteKeys, { keys: keys.del })}
      </p>
      <p class="kbd-hint text-xs text-stone-400">{keys.esc} · {m.cancel}</p>
    </div>
  {/if}
</article>
