<script lang="ts">
  import type { Lang } from "#shared/i18n.js";

  let { lang, onPick }: { lang: Lang; onPick: (lang: Lang) => void } = $props();

  const LANGS: { id: Lang; label: string }[] = [
    { id: "zh-CN", label: "简体中文" },
    { id: "ja", label: "日本語" },
    { id: "en", label: "English" },
  ];
</script>

<nav
  class="flex rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm"
  aria-label="Language / 语言 / 言語"
>
  {#each LANGS as l (l.id)}
    <button
      onclick={() => onPick(l.id)}
      aria-pressed={lang === l.id}
      class="rounded-full px-3 py-1 text-xs font-medium transition-colors {lang === l.id
        ? 'bg-stone-900 text-white'
        : 'text-stone-500 hover:text-stone-900'}"
    >
      {l.label}
    </button>
  {/each}
</nav>
