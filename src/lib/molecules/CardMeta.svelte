<script lang="ts">
  import type { Lang } from "#shared/i18n.js";
  import { absoluteTime, relativeTime } from "#lib/time.js";

  let { createdAt, now, lang }: { createdAt: number; now: number; lang: Lang } = $props();
</script>

<div class="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
  <span class="text-base font-bold tracking-tight text-stone-900 sm:text-xl"
    >{relativeTime(createdAt, now, lang)}</span
  >
  <span class="text-xs text-stone-400 tabular-nums">{absoluteTime(createdAt, lang)}</span>
</div>
