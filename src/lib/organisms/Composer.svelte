<script lang="ts">
  import { onMount } from "svelte";
  import { formatCount, type Messages } from "#shared/i18n.js";
  import type { FileStage } from "#lib/stage.svelte.js";
  import { formatFileSize } from "#shared/format.js";
  import Icon from "#shared/ui/Icon.svelte";
  import LangPicker from "#lib/molecules/LangPicker.svelte";
  import { keys } from "#lib/kbd.js";

  let {
    m,
    mode,
    hasKeyboard,
    stage,
    onSubmit,
    onError,
    onUpload,
    onUploadOne,
  }: {
    m: Messages;
    mode: "text" | "file";
    hasKeyboard: boolean;
    stage: FileStage;
    onSubmit: (text: string, meta: { filename?: string; suffix?: string }) => Promise<boolean>;
    onError: () => void;
    onUpload: () => Promise<boolean>;
    onUploadOne: (id: string) => Promise<boolean>;
  } = $props();

  let value = $state("");
  let filename = $state("");
  let suffix = $state<string | null>(null);
  let area = $state<HTMLTextAreaElement | undefined>();
  let hideScrollId: number | undefined;

  const canSend = $derived(value.trim().length > 0);

  async function submit(): Promise<void> {
    const text = value.trim();
    if (text.length === 0) return;
    const meta = {
      filename: filename.trim().length > 0 ? filename.trim() : undefined,
      suffix: suffix ?? undefined,
    };
    value = "";
    const ok = await onSubmit(text, meta);
    if (!ok) {
      value = value.length === 0 ? text : text + "\n" + value;
      onError();
    } else {
      filename = "";
      suffix = null;
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  function onPick(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length > 0) stage.add(files);
  }

  // tint the native scrollbar while scrolling; back to invisible 1s after the last activity
  function markScrolling(): void {
    area?.classList.add("scrolling");
    clearTimeout(hideScrollId);
    hideScrollId = setTimeout(() => area?.classList.remove("scrolling"), 1_000);
  }

  onMount(() => () => clearTimeout(hideScrollId));
</script>

<div class="[view-transition-name:composer] relative z-20">
  {#if mode === "text"}
    <div class="space-y-2.5">
      <div
        class="rounded-lg border border-stone-300/90 bg-white transition-colors hover:border-stone-400 focus-within:border-stone-500 pointer-fine:rounded-2xl pointer-fine:squircle"
      >
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          bind:this={area}
          bind:value
          onkeydown={onKeydown}
          oninput={markScrolling}
          onscroll={markScrolling}
          autofocus
          placeholder={m.placeholder}
          class="scroll-autohide block max-h-[min(30lh,70dvh)] min-h-[2lh] w-full resize-none overflow-y-auto bg-transparent px-5 py-4 text-lg leading-relaxed field-sizing-content focus:outline-none"
        ></textarea>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          bind:value={filename}
          maxlength={64}
          placeholder={m.filenamePlaceholder}
          class="font-mono h-9 min-w-32 flex-1 rounded-lg border border-stone-300/90 bg-white px-2.5 text-base pointer-fine:text-sm text-stone-700 placeholder:font-sans placeholder:text-stone-400 hover:border-stone-400 focus:border-stone-500 focus:outline-none"
        />
        <!-- the dot reads filename + suffix as one file name -->
        <span
          class="relative top-0.5 text-xl leading-none font-bold text-stone-600"
          aria-hidden="true">.</span
        >
        <div class="w-36 shrink-0 sm:w-44">
          <LangPicker
            bind:value={suffix}
            placeholder={m.suffixPlaceholder}
            searchPlaceholder={m.searchSuffix}
            noResults={m.noSuffixMatches}
            clearLabel={m.clearSuffix}
          />
        </div>
        <button
          type="button"
          onclick={() => void submit()}
          disabled={!canSend}
          class="group ml-auto flex h-11 w-full items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:w-auto"
        >
          <!-- hover reveals the send shortcut; the flexible filename input
               yields the width so nothing else in the row moves -->
          <span
            class="max-w-0 overflow-hidden pr-0 text-[11px] font-semibold tracking-wide whitespace-nowrap text-orange-100 opacity-0 transition-all duration-200 group-hover:max-w-8 group-hover:pr-1.5 group-hover:opacity-100"
          >
            {keys.save}
          </span>
          {m.send}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      <label
        class="squircle flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-6 text-stone-400 transition-colors hover:border-orange-400 hover:text-stone-600"
      >
        <Icon name="paperclip" size={28} />
        <span class="text-sm font-medium">{m.dropHint}</span>
        <input type="file" multiple class="sr-only" onchange={onPick} />
      </label>

      {#if stage.files.length > 0}
        <ul class="squircle divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {#each stage.files as f (f.id)}
            <li class="flex items-center gap-3 px-3 py-2.5">
              {#if f.preview}
                <img src={f.preview} alt="" class="size-10 shrink-0 rounded-lg object-cover" />
              {:else}
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400"
                >
                  <Icon name="fileText" size={20} />
                </span>
              {/if}
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-stone-800">{f.file.name}</span>
                <span class="block text-xs text-stone-400">{formatFileSize(f.file.size)}</span>
              </span>
              <button
                type="button"
                onclick={() => void onUploadOne(f.id)}
                disabled={stage.busy || stage.uploadingIds.includes(f.id)}
                class="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                >{stage.uploadingIds.includes(f.id) ? m.uploading : m.uploadOne}</button
              >
              <button
                type="button"
                disabled={stage.busy || stage.uploadingIds.includes(f.id)}
                onclick={() => stage.remove(f.id)}
                aria-label={m.removeFile}
                title={m.removeFile}
                class="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          {/each}
        </ul>

        <p class="px-1 text-xs leading-relaxed text-stone-500">{m.multiUploadHint}</p>

        <div class="flex flex-wrap items-center justify-between gap-2 px-1">
          <p class="text-xs text-stone-400">
            {formatCount(m.fileCount, stage.files.length)} · {formatFileSize(stage.totalBytes)}
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => stage.clear()}
              disabled={stage.busy || stage.uploadingIds.length > 0}
              class="squircle h-10 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40"
            >
              {m.clearFiles}
            </button>
            <button
              type="button"
              onclick={() => void onUpload()}
              disabled={stage.busy || stage.uploadingIds.length > 0 || stage.files.length === 0}
              class="flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {m.upload}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
