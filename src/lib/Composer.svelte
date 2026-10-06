<script lang="ts">
  import { onMount } from "svelte";
  import type { Messages } from "#shared/i18n.js";
  import Icon from "#lib/Icon.svelte";

  let {
    m,
    mode,
    onSubmit,
    onError,
    onFiles,
  }: {
    m: Messages;
    mode: "text" | "file";
    onSubmit: (text: string) => Promise<boolean>;
    onError: () => void;
    onFiles: (files: File[]) => void;
  } = $props();

  let value = $state("");
  let area = $state<HTMLTextAreaElement | undefined>();
  let hideScrollId: number | undefined;

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
    if (files.length > 0) onFiles(files);
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
    class="rounded-2xl border border-stone-300/90 bg-white shadow-sm transition focus-within:border-stone-500 focus-within:ring-4 focus-within:ring-orange-500/15"
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
      class="scroll-autohide block max-h-[min(30lh,70vh)] min-h-[2lh] w-full resize-none overflow-y-auto bg-transparent px-5 py-4 text-lg leading-relaxed field-sizing-content focus:outline-none"
    ></textarea>
  </div>
{:else}
  <label
    class="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white shadow-sm py-8 text-stone-400 transition-colors hover:border-orange-400 hover:text-stone-600"
  >
    <Icon name="paperclip" size={28} />
    <span class="text-sm font-medium">{m.dropHint}</span>
    <input type="file" multiple class="sr-only" onchange={onPick} />
  </label>
{/if}
