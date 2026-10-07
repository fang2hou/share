<script lang="ts">
  import type { Messages } from "#shared/i18n.js";
  import Icon from "#shared/ui/Icon.svelte";
  import { formatFileSize } from "#shared/format.js";

  let { name, size, progress, m }: { name: string; size: number; progress: number; m: Messages } =
    $props();

  const sizeLabel = $derived(formatFileSize(size));
</script>

<article class="squircle flex gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 opacity-80">
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline gap-2">
      <span class="text-xl font-bold tracking-tight text-stone-400 tabular-nums">{progress}%</span>
      <span class="truncate text-sm text-stone-500">{m.uploading}</span>
    </div>
    <p class="mt-2 flex items-center gap-2 text-base leading-relaxed break-all text-stone-800">
      <Icon name="fileText" size={18} />
      <span class="font-medium">{name}</span>
      <span class="text-sm text-stone-400">{sizeLabel}</span>
    </p>
    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200">
      <div
        class="h-full rounded-full bg-orange-500 transition-[width] duration-150"
        style="width: {progress}%"
      ></div>
    </div>
  </div>
</article>
