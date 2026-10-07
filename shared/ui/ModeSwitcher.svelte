<script lang="ts">
  import Icon from "#shared/ui/Icon.svelte";

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
  class="relative flex items-center rounded-xl border border-stone-200/80 bg-white p-1 shadow-sm"
  role="group"
  aria-label="{labelText} / {labelFiles}"
>
  <span
    class="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-stone-200 transition-transform duration-200 ease-out"
    style="transform: translateX({mode === 'file' ? '100%' : '0%'})"
    aria-hidden="true"
  ></span>
  <button
    onclick={() => onPick("text")}
    aria-pressed={mode === "text"}
    title={labelText}
    class="relative z-10 header-control header-mode-control flex items-center justify-center rounded-lg transition-colors duration-200 {mode ===
    'text'
      ? 'text-stone-900'
      : 'text-stone-400 hover:text-stone-700'}"
  >
    <Icon name="type" size={14} />
  </button>
  <button
    onclick={() => onPick("file")}
    aria-pressed={mode === "file"}
    title={labelFiles}
    class="relative z-10 header-control header-mode-control flex items-center justify-center rounded-lg transition-colors duration-200 {mode ===
    'file'
      ? 'text-stone-900'
      : 'text-stone-400 hover:text-stone-700'}"
  >
    <Icon name="paperclip" size={14} />
  </button>
</div>
