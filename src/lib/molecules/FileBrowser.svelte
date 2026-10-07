<script lang="ts">
  import type { StoredFile } from "#shared/protocol.js";
  import type { Messages } from "#shared/i18n.js";
  import { previewKind } from "#shared/file-preview.js";
  import { formatFileSize } from "#shared/format.js";

  let { files, base, m }: { files: StoredFile[]; base: string; m: Messages } = $props();
  let selection = $state<Record<string, boolean>>({});
  let preview = $state<StoredFile | null>(null);
  const selected = $derived(files.filter((file) => selection[file.id] !== false));
  const allSelected = $derived(selected.length === files.length);
  const kind = $derived(preview ? previewKind(preview.type) : null);

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

<div class="mt-3 overflow-hidden rounded-xl border border-stone-200">
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
      <a
        href={selected.length
          ? `${base}/zip?ids=${selected.map((f) => f.id).join(",")}`
          : undefined}
        download
        aria-disabled={selected.length === 0}
        class="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-40"
        >{m.downloadZip}</a
      >
      <button
        type="button"
        onclick={downloadEach}
        disabled={selected.length === 0}
        class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-600 disabled:opacity-40"
        >{m.downloadEach}</button
      >
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
        <div class="min-w-0 flex-1 basis-32">
          <p class="truncate text-sm font-medium text-stone-800" title={file.name}>{file.name}</p>
          <p class="text-xs text-stone-400">{formatFileSize(file.size)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {#if previewKind(file.type)}<button
              type="button"
              onclick={() => {
                preview = file;
              }}
              class="rounded-lg px-2.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
              >{m.preview}</button
            >{/if}
          <a
            href="{base}/{file.id}"
            download
            class="rounded-lg px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >{m.download}</a
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
