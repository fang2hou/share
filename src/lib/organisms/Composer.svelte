<script lang="ts">
  import { onMount } from "svelte";
  import type { Messages } from "#shared/i18n.js";
  import type { FileStage } from "#lib/stage.svelte.js";
  import { formatFileSize } from "#lib/format.js";
  import Icon from "#lib/atoms/Icon.svelte";

  let {
    m,
    mode,
    hasKeyboard,
    stage,
    onSubmit,
    onError,
    onUpload,
  }: {
    m: Messages;
    mode: "text" | "file";
    hasKeyboard: boolean;
    stage: FileStage;
    onSubmit: (text: string) => Promise<boolean>;
    onError: () => void;
    onUpload: () => Promise<boolean>;
  } = $props();

  let value = $state("");
  let area = $state<HTMLTextAreaElement | undefined>();
  let hideScrollId: number | undefined;

  const canSend = $derived(value.trim().length > 0);

  async function submit(): Promise<void> {
    const text = value.trim();
    if (text.length === 0) return;
    value = "";
    const ok = await onSubmit(text);
    if (!ok) {
      value = value.length === 0 ? text : text + "\n" + value;
      onError();
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

{#if mode === "text"}
  <div
    class="vt-composer squircle rounded-2xl border border-stone-300/90 bg-white shadow-sm transition focus-within:border-stone-500 focus-within:ring-4 focus-within:ring-orange-500/15"
  >
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      bind:this={area}
      bind:value
      onkeydown={onKeydown}
      oninput={markScrolling}
      onscroll={markScrolling}
      autofocus
      placeholder={hasKeyboard ? m.placeholder : m.placeholderPlain}
      class="scroll-autohide block max-h-[min(30lh,70dvh)] min-h-[2lh] w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 text-lg leading-relaxed field-sizing-content focus:outline-none"
    ></textarea>
    <div class="flex items-center justify-end px-2 pb-2">
      <button
        type="button"
        onclick={() => void submit()}
        disabled={!canSend}
        class="squircle flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon name="send" size={16} />
        {m.send}
      </button>
    </div>
  </div>
{:else}
  <div class="vt-composer space-y-3">
    <label
      class="squircle flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-6 text-stone-400 transition-colors hover:border-orange-400 hover:text-stone-600"
    >
      <Icon name="paperclip" size={28} />
      <span class="text-sm font-medium">{m.dropHint}</span>
      <input type="file" multiple class="sr-only" onchange={onPick} />
    </label>

    {#if stage.files.length > 0}
      <ul
        class="squircle divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm"
      >
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

      {#if stage.files.length > 1}
        <label
          class="squircle flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
        >
          <span class="shrink-0 text-xs font-medium text-stone-500">{m.zipNameLabel}</span>
          <input
            bind:value={stage.zipName}
            type="text"
            spellcheck="false"
            autocomplete="off"
            class="w-full min-w-0 flex-1 rounded-lg bg-stone-50 px-2.5 py-1.5 text-sm text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </label>
      {/if}

      <div class="flex flex-wrap items-center justify-between gap-2 px-1">
        <p class="text-xs text-stone-400">
          {stage.files.length}
          {m.filesUnit} · {formatFileSize(stage.totalBytes)}
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => stage.clear()}
            disabled={stage.busy}
            class="squircle h-10 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40"
          >
            {m.clearFiles}
          </button>
          <button
            type="button"
            onclick={() => void onUpload()}
            disabled={stage.busy || stage.files.length === 0}
            class="squircle flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="send" size={16} />
            {m.upload}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
