<script lang="ts">
  import Tooltip from "./Tooltip.svelte";
  import Icon from "#shared/ui/Icon.svelte";
  import type { StoredFile } from "#shared/protocol.js";
  import type { Messages } from "#shared/i18n.js";
  import {
    previewKind,
    TEXT_PREVIEW_CHUNK_BYTES,
    textPreviewRange,
    decodeTextPreview,
  } from "#shared/file-preview.js";
  import { formatFileSize } from "#shared/format.js";

  let {
    files,
    base,
    zipBase = base,
    m,
  }: { files: StoredFile[]; base: string; zipBase?: string; m: Messages } = $props();
  let selection = $state<Record<string, boolean>>({});
  let preview = $state<StoredFile | null>(null);
  let previewPage = $state(0);
  let previewText = $state("");
  let previewFailed = $state(false);
  let previewLoading = $state(false);
  const selected = $derived(files.filter((file) => selection[file.id] !== false));
  const allSelected = $derived(selected.length === files.length);
  const kind = $derived(preview ? previewKind(preview.type, preview.size) : null);

  $effect(() => {
    if (!preview || kind !== "text") return;
    const page = previewPage;
    const range = textPreviewRange(page, preview.size);
    const controller = new AbortController();
    previewText = "";
    previewFailed = false;
    previewLoading = true;
    void fetch(`${base}/${preview.id}?preview=1`, {
      signal: controller.signal,
      headers: { Range: `bytes=${range.start}-${range.end}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview_failed");
        const text = decodeTextPreview(await response.arrayBuffer(), page);
        if (!controller.signal.aborted) previewText = text;
      })
      .catch(() => {
        if (!controller.signal.aborted) previewFailed = true;
      })
      .finally(() => {
        if (!controller.signal.aborted) previewLoading = false;
      });
    return () => controller.abort();
  });

  function downloadEach(): void {
    for (const file of selected) {
      const anchor = document.createElement("a");
      anchor.href = `${base}/${file.id}`;
      anchor.download = file.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    }
  }
</script>

<div class="mt-3 overflow-hidden rounded-[var(--file-list-radius,0.75rem)] border border-stone-200">
  {#if files.length > 1}
    <div class="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
      <label class="mr-auto flex items-center gap-2 text-xs font-medium text-stone-600 select-none">
        <input
          type="checkbox"
          checked={allSelected}
          indeterminate={selected.length > 0 && !allSelected}
          onchange={(e) => {
            selection = Object.fromEntries(files.map((f) => [f.id, e.currentTarget.checked]));
          }}
          class="accent-orange-600"
        />
        {m.selectAll} <span class="text-stone-400">{selected.length}/{files.length}</span>
      </label>
      <div class="grid grid-cols-[repeat(2,auto)] items-center gap-1">
        <Tooltip label={m.downloadZip}>
          {#snippet children(attach, description)}
            <a
              href={selected.length
                ? `${zipBase}/zip?ids=${selected.map((f) => f.id).join(",")}`
                : undefined}
              download
              aria-label={m.downloadZip}
              aria-describedby={description}
              {@attach attach}
              aria-disabled={selected.length === 0}
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white hover:bg-stone-100 pointer-coarse:size-11 text-xs font-semibold text-stone-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
              ><Icon name="archive" size={18} /></a
            >
          {/snippet}
        </Tooltip>
        <Tooltip label={m.downloadEach}>
          {#snippet children(attach, description)}
            <button
              type="button"
              aria-label={m.downloadEach}
              aria-describedby={description}
              {@attach attach}
              onclick={downloadEach}
              disabled={selected.length === 0}
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white hover:bg-stone-100 pointer-coarse:size-11 text-xs font-medium text-stone-600 disabled:opacity-40"
              ><Icon name="downloadEach" size={18} /></button
            >
          {/snippet}
        </Tooltip>
      </div>
    </div>
  {/if}
  <ul class="divide-y divide-stone-100">
    {#each files as file (file.id)}
      <li class="flex flex-wrap items-center gap-2 px-3 py-2.5">
        {#if files.length > 1}<input
            type="checkbox"
            aria-label={file.name}
            checked={selection[file.id] !== false}
            onchange={(e) => {
              selection[file.id] = e.currentTarget.checked;
            }}
            class="accent-orange-600"
          />{/if}
        <div class="min-w-0 flex-1 basis-0">
          <p class="truncate text-sm font-medium text-stone-800" title={file.name}>{file.name}</p>
          <p class="text-xs text-stone-400">{formatFileSize(file.size)}</p>
        </div>
        <div class="grid grid-cols-[repeat(2,auto)] items-center gap-1">
          {#if previewKind(file.type, file.size)}<button
              type="button"
              aria-label={m.preview}
              title={m.preview}
              onclick={() => {
                previewPage = 0;
                preview = file;
              }}
              class="flex size-9 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11 text-xs font-medium text-stone-500 hover:bg-stone-100"
              ><Icon name="eye" size={18} /></button
            >{/if}
          <a
            href="{base}/{file.id}"
            download
            aria-label={m.download}
            title={m.download}
            class="col-start-2 flex size-9 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11 text-xs font-medium text-stone-700 hover:bg-stone-100"
            ><Icon name="download" size={18} /></a
          >
        </div>
      </li>
    {/each}
  </ul>
</div>

{#if preview}
  <dialog
    {@attach (element) => element.showModal()}
    onclose={() => {
      preview = null;
    }}
    class="m-auto max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] rounded-2xl border border-stone-200 bg-white p-4 text-stone-800 shadow-xl backdrop:bg-stone-900/35"
  >
    <div class="mb-3 flex items-center gap-3">
      <p class="min-w-0 flex-1 truncate text-sm font-medium">{preview.name}</p>
      <form method="dialog">
        <button class="rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium"
          >{m.closePreview}</button
        >
      </form>
    </div>
    {#if kind === "image"}
      <img
        src="{base}/{preview.id}?preview=1"
        alt={preview.name}
        class="mx-auto max-h-[70dvh] max-w-full rounded-lg object-contain"
      />
    {:else if kind === "audio"}
      <audio src="{base}/{preview.id}?preview=1" controls class="w-full"></audio>
    {:else if kind === "video"}
      <video src="{base}/{preview.id}?preview=1" controls class="max-h-[70dvh] w-full"
        ><track kind="captions" /></video
      >
    {:else if kind === "text"}
      {#if previewLoading}<p class="text-sm text-stone-500">{m.previewLoading}</p>
      {:else if previewFailed}<p role="alert" class="text-sm text-red-600">{m.previewFailed}</p>
      {:else}<pre
          class="font-mono max-h-[65dvh] overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm whitespace-pre-wrap break-words">{previewText}</pre>{/if}
      {#if preview.size > TEXT_PREVIEW_CHUNK_BYTES}
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            onclick={() => previewPage--}
            disabled={previewPage === 0}
            class="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium hover:bg-stone-100 disabled:opacity-40"
            >{m.previewPrevious}</button
          >
          <span class="text-xs text-stone-500" aria-live="polite">
            {previewPage + 1} / {Math.ceil(preview.size / TEXT_PREVIEW_CHUNK_BYTES)}
          </span>
          <button
            onclick={() => previewPage++}
            disabled={(previewPage + 1) * TEXT_PREVIEW_CHUNK_BYTES >= preview.size}
            class="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium hover:bg-stone-100 disabled:opacity-40"
            >{m.previewNext}</button
          >
        </div>
        <p class="mt-2 text-xs text-stone-500">{m.previewTruncated}</p>
      {/if}
    {:else}
      <iframe
        src="{base}/{preview.id}?preview=1"
        title={preview.name}
        sandbox=""
        class="h-[65dvh] w-full rounded-lg border border-stone-200"
      ></iframe>
    {/if}
  </dialog>
{/if}
