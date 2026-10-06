<script lang="ts">
  import Icon from "#lib/atoms/Icon.svelte";

  let {
    mode,
    onPick,
    labelText,
    labelFiles,
  }: {
    mode: "text" | "file";
    onPick: (mode: "text" | "file") => void;
    labelText: string;
    labelFiles: string;
  } = $props();
</script>

<div
  class="relative flex items-center rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm"
  role="group"
  aria-label="{labelText} / {labelFiles}"
>
  <span
    class="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-stone-900 transition-transform duration-200 ease-out"
    style="transform: translateX({mode === 'file' ? '100%' : '0%'})"
    aria-hidden="true"
  ></span>
  <button
    onclick={() => onPick("text")}
    aria-pressed={mode === "text"}
    title={labelText}
    class="relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200 {mode ===
    'text'
      ? 'text-white'
      : 'text-stone-400 hover:text-stone-700'}"
  >
    <Icon name="type" size={14} />
  </button>
  <button
    onclick={() => onPick("file")}
    aria-pressed={mode === "file"}
    title={labelFiles}
    class="relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200 {mode ===
    'file'
      ? 'text-white'
      : 'text-stone-400 hover:text-stone-700'}"
  >
    <Icon name="paperclip" size={14} />
  </button>
</div>
