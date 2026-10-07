<script lang="ts">
  import { onMount } from "svelte";
  import { messages, type Lang } from "../i18n.js";
  import { loadLangFonts } from "./fonts.js";
  import Logo from "./Logo.svelte";
  import LangNav from "./LangNav.svelte";
  import ModeSwitcher from "./ModeSwitcher.svelte";

  let {
    lang,
    onPickLanguage,
    status = "live",
    mode,
    onPickMode,
    notice = "",
  }: {
    lang: Lang;
    onPickLanguage: (lang: Lang) => void;
    status?: "connecting" | "live" | "reconnecting";
    mode?: "text" | "file";
    onPickMode?: (mode: "text" | "file") => void;
    notice?: string;
  } = $props();
  const m = $derived(messages[lang]);
  $effect(() => {
    document.documentElement.lang = lang;
    void loadLangFonts(lang);
  });
  function persist(next: Lang): void {
    try {
      localStorage.setItem("ts_lang", next);
    } catch {
      /* Preferences are optional. */
    }
    document.cookie = `ts_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    onPickLanguage(next);
  }
  onMount(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("ts_lang");
    } catch {
      /* Use the server-selected locale. */
    }
    persist(saved && Object.hasOwn(messages, saved) ? (saved as Lang) : lang);
  });
</script>

<svelte:window
  onstorage={(event) => {
    if (event.key === "ts_lang" && event.newValue && Object.hasOwn(messages, event.newValue))
      onPickLanguage(event.newValue as Lang);
  }}
/>
<header class="app-header flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
  <div class="flex items-center gap-3">
    <Logo {status} />
    {#if mode && onPickMode}<ModeSwitcher
        {mode}
        onPick={onPickMode}
        labelText={m.modeText}
        labelFiles={m.modeFiles}
      />{/if}
  </div>
  <div aria-live="polite" aria-atomic="true" class="contents">
    {#if notice}
      <p
        class="order-last flex min-h-[calc(var(--header-control-height)+0.625rem)] min-w-0 basis-full items-center rounded-xl border border-red-200/70 bg-red-50 px-3 py-2 text-xs font-medium leading-snug text-red-700 sm:order-none sm:flex-1 sm:basis-0"
      >
        {notice}
      </p>
    {/if}
  </div>
  <div class="ml-auto shrink-0">
    <LangNav {lang} label={m.changeLanguage} onPick={persist} />
  </div>
</header>
