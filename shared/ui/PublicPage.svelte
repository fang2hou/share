<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { PublicView } from "../public-view.js";
  import { messages } from "../i18n.js";
  import ReadyFrame from "./ReadyFrame.svelte";
  import AppHeader from "./AppHeader.svelte";
  import FileBrowser from "./FileBrowser.svelte";
  import Icon from "./Icon.svelte";

  let { view }: { view: PublicView } = $props();
  let lang = $state(untrack(() => view.lang));
  const m = $derived(messages[lang]);
  let password = $state("");
  let reveal = $state(false);
  let busy = $state(false);
  let failed = $state(false);
  let copied = $state(false);
  let copyFailed = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  const text = $derived(view.kind === "text" ? view.text : "");
  const first = $derived(text.split("\n").find((line) => line.trim()) ?? "");
  const title = $derived(
    view.kind === "password"
      ? m.protectedShare
      : view.kind === "text"
        ? first.length > 60
          ? first.slice(0, 57) + "…"
          : first || m.shareViewTitle
        : view.files.length === 1
          ? view.files[0]!.name
          : m.shareViewTitle,
  );
  async function unlock(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    failed = false;
    try {
      const response = await fetch(view.path + "/unlock", {
        method: "POST",
        body: new URLSearchParams({ password }),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("unlock_failed");
      location.replace(view.path + "?view=1");
    } catch {
      failed = true;
      busy = false;
    }
  }
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      copyFailed = false;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1800);
    } catch {
      copyFailed = true;
    }
  }
  onDestroy(() => clearTimeout(timer));
</script>

<svelte:head>
  <title>Share · {title}</title>
  <meta name="robots" content="noindex" />
  <meta name="theme-color" content="#faf7f2" />
  <link rel="icon" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  {#if view.kind === "text"}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={text.replaceAll(/\s+/g, " ").trim().slice(0, 200)} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="share" />
    <meta property="og:url" content={view.url} />
    <meta property="og:image" content={new URL(view.url).origin + "/og.png"} />
    <meta name="twitter:card" content="summary_large_image" />
  {/if}
</svelte:head>
<ReadyFrame {lang}>
  <div
    class="mx-auto max-w-3xl space-y-6 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:py-14 sm:pb-20"
  >
    <AppHeader {lang} onPickLanguage={(next) => (lang = next)} />
    <main class="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <h1 class="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
        {view.kind === "password" ? m.unlockTitle : m.shareViewTitle}
      </h1>
      {#if view.kind === "password"}
        <p class="mt-3 text-sm text-stone-500">{m.unlockHint}</p>
        <form action={view.path + "/unlock"} method="post" onsubmit={unlock} class="mt-6 space-y-4">
          <div>
            <label for="password" class="mb-2.5 block text-xs font-medium text-stone-600"
              >{m.sharePassword}</label
            >
            <div class="relative">
              <input
                id="password"
                name="password"
                bind:value={password}
                type={reveal ? "text" : "password"}
                required
                minlength="6"
                maxlength="128"
                autocomplete="current-password"
                class="code-font h-11 w-full rounded-lg border border-stone-300 bg-white pl-3 pr-12 text-sm hover:border-stone-400 focus:border-stone-500 focus:outline-none"
              />
              <button
                type="button"
                onclick={() => (reveal = !reveal)}
                aria-label={reveal ? m.hidePassword : m.showPassword}
                title={reveal ? m.hidePassword : m.showPassword}
                aria-pressed={reveal}
                class="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-stone-600 opacity-50 hover:opacity-100 focus-visible:opacity-100"
                ><Icon name={reveal ? "eyeOff" : "eye"} size={16} /></button
              >
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            class="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
            >{m.unlock}</button
          >
          {#if failed}<p role="alert" class="text-sm text-red-600">{m.unlockFailed}</p>{/if}
        </form>
      {:else if view.kind === "files"}
        <FileBrowser files={view.files} base={view.path + "/files"} {m} zipBase={view.path} />
      {:else}
        <pre
          class="code-font mt-4 overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm whitespace-pre-wrap break-words">{view.text}</pre>
        <button
          onclick={copy}
          class="mt-4 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >{copied ? m.copied : m.copy}</button
        >
        {#if copyFailed}<p role="alert" class="mt-2 text-sm text-red-600">{m.copyFailed}</p>{/if}
      {/if}
    </main>
  </div>
</ReadyFrame>
