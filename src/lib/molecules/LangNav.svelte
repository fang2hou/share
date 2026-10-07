<script lang="ts">
  import { tick } from "svelte";
  import type { Lang } from "#shared/i18n.js";
  import Icon from "#lib/atoms/Icon.svelte";

  let {
    lang,
    label,
    onPick,
  }: {
    lang: Lang;
    label: string;
    onPick: (lang: Lang) => void;
  } = $props();

  const LANGS: { id: Lang; short: string; name: string }[] = [
    { id: "zh-CN", short: "简", name: "简体中文" },
    { id: "zh-TW", short: "繁", name: "繁體中文" },
    { id: "ja", short: "日", name: "日本語" },
    { id: "ko", short: "한", name: "한국어" },
    { id: "en", short: "En", name: "English" },
  ];
  const current = $derived(LANGS.find((language) => language.id === lang) ?? LANGS[0]!);
  const menuId = $props.id();
  let open = $state(false);
  let nav: HTMLElement;
  let trigger: HTMLButtonElement;

  function close(restoreFocus = false): void {
    open = false;
    if (restoreFocus) trigger.focus();
  }

  async function openFromKeyboard(event: KeyboardEvent): Promise<void> {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    open = true;
    await tick();
    const options = nav.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    options[event.key === "ArrowUp" ? options.length - 1 : 0]?.focus();
  }

  function onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = [
      ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button"),
    ];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
</script>

<svelte:window
  onclick={(event) => {
    if (open && !nav.contains(event.target as Node)) close();
  }}
  onkeydown={(event) => {
    if (open && event.key === "Escape") close(true);
  }}
/>

<nav
  {@attach (element) => {
    nav = element;
  }}
  class="relative shrink-0"
  onfocusout={(event) => {
    if (!nav.contains(event.relatedTarget as Node | null)) close();
  }}
>
  <button
    {@attach (element) => {
      trigger = element;
    }}
    type="button"
    aria-label={label}
    title={label}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    onclick={() => (open = !open)}
    onkeydown={openFromKeyboard}
    class="flex min-h-9 min-w-11 cursor-pointer items-center justify-center rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 pointer-coarse:min-h-11"
  >
    <span
      class="flex h-7 min-w-9 items-center justify-center rounded-full bg-stone-900 px-3 text-xs font-medium text-white select-none"
      >{current.short}</span
    >
  </button>
  {#if open}
    <div
      id={menuId}
      role="menu"
      tabindex="-1"
      aria-label={label}
      onkeydown={onMenuKeydown}
      class="absolute top-full right-0 z-50 mt-2 w-40 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg"
    >
      {#each LANGS as language (language.id)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={lang === language.id}
          lang={language.id}
          onclick={() => {
            onPick(language.id);
            close(true);
          }}
          class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-left text-sm select-none hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none {lang ===
          language.id
            ? 'font-semibold text-orange-600'
            : 'text-stone-600'}"
        >
          {language.name}
          {#if lang === language.id}<Icon name="check" size={15} />{/if}
        </button>
      {/each}
    </div>
  {/if}
</nav>
