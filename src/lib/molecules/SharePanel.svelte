<script lang="ts">
  import { onDestroy } from "svelte";
  import Icon from "#shared/ui/Icon.svelte";
  import { interpolate, type Messages } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import { copyText } from "#lib/clipboard.js";

  let {
    item,
    m,
    onShare,
    onClose,
  }: {
    item: Item;
    m: Messages;
    onClose: () => void;
    onShare: (
      active: boolean,
      maxDownloads: number | null,
      password?: string | null,
    ) => Promise<boolean>;
  } = $props();

  let access = $state<"password" | "link" | null>(null);
  let limitInput = $state<number | string | null>(null);
  let password = $state("");
  let savedPassword = $state<string | null>(null);
  let showPassword = $state(false);
  let busy = $state(false);
  let failed = $state(false);
  let copied = $state(false);
  let copiedTimer: number | undefined;
  const mode = $derived(
    access ?? (item.share?.active && !item.share.passwordProtected ? "link" : "password"),
  );
  const limit = $derived(limitInput ?? item.share?.maxDownloads ?? "");
  const shareUrl = $derived(
    item.share?.url
      ? location.origin + item.share.url + (item.kind === "file" ? "?view=1" : "")
      : "",
  );
  const exhausted = $derived(
    item.share?.maxDownloads !== null &&
      item.share?.maxDownloads !== undefined &&
      item.share.downloads >= item.share.maxDownloads,
  );
  const canKeepPassword = $derived(item.share?.active === true && item.share.passwordProtected);

  function generatePassword(): void {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    password = [...crypto.getRandomValues(new Uint8Array(12))]
      .map((b) => alphabet[b & 31])
      .join("");
    showPassword = true;
  }

  async function copy(value: string): Promise<void> {
    if (!(await copyText(value))) return;
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied = false;
    }, 1500);
  }

  async function enable(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const max = limit === "" ? null : Number(limit);
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 1_000_000)) return;
    const nextPassword = mode === "link" ? null : password || undefined;
    if (mode === "password" && !nextPassword && !canKeepPassword) return;
    busy = true;
    failed = false;
    try {
      failed = !(await onShare(true, max, nextPassword));
      if (!failed) {
        if (nextPassword !== undefined) savedPassword = nextPassword;
      }
    } finally {
      busy = false;
    }
  }

  async function disable(): Promise<void> {
    busy = true;
    failed = false;
    try {
      failed = !(await onShare(false, null));
      if (!failed) {
        password = "";
        savedPassword = null;
        access = null;
        limitInput = null;
      }
    } finally {
      busy = false;
    }
  }

  onDestroy(() => clearTimeout(copiedTimer));
</script>

<section
  aria-label={m.share}
  class="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:p-4"
>
  <div class="mb-4 flex items-center justify-between gap-3">
    <h3 class="text-sm font-semibold text-stone-800">{m.share}</h3>
    <button
      type="button"
      onclick={onClose}
      aria-label={m.closeShare}
      title={m.closeShare}
      class="flex size-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-orange-500"
      ><Icon name="x" size={17} /></button
    >
  </div>
  {#if item.share?.active}
    <div class="mb-3 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700"
          >{item.share.passwordProtected ? m.protectedShare : m.openShare}</span
        >
        <button
          type="button"
          onclick={() => void disable()}
          disabled={busy}
          class="rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:text-red-600 disabled:opacity-40"
          >{m.shareOff}</button
        >
      </div>
      <div class="flex items-center gap-2">
        <input
          readonly
          value={shareUrl}
          aria-label={m.shareLink}
          class="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
        />
        <button
          type="button"
          onclick={() => void copy(shareUrl)}
          class="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white"
          >{copied ? m.copied : m.copy}</button
        >
      </div>
      {#if item.share.passwordProtected && savedPassword}
        {@const invitation = interpolate(m.invitation, { url: shareUrl, password: savedPassword })}
        <button
          type="button"
          onclick={() => void copy(invitation)}
          class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
          >{m.copyInvitation}</button
        >
      {/if}
      <p class="text-xs {exhausted ? 'font-medium text-red-600' : 'text-stone-400'}">
        {interpolate(m.accessUsage, {
          used: item.share.downloads,
          max: item.share.maxDownloads ?? m.unlimited,
        })}
      </p>
    </div>
  {/if}
  <form onsubmit={enable} class="space-y-3">
    <fieldset disabled={busy} class="space-y-3">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label
          class="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-xs font-medium {mode ===
          'password'
            ? 'border-orange-400 text-stone-900'
            : 'border-stone-200 text-stone-500'}"
          ><input
            type="radio"
            name="access-{item.id}"
            checked={mode === "password"}
            onchange={() => {
              access = "password";
            }}
            class="accent-orange-600"
          />{m.protectedShare}</label
        >
        <label
          class="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-xs font-medium {mode ===
          'link'
            ? 'border-orange-400 text-stone-900'
            : 'border-stone-200 text-stone-500'}"
          ><input
            type="radio"
            name="access-{item.id}"
            checked={mode === "link"}
            onchange={() => {
              access = "link";
            }}
            class="accent-orange-600"
          />{m.openShare}</label
        >
      </div>
      <div
        class="grid items-start gap-3 sm:gap-4 grid-cols-1 min-[440px]:grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)]"
      >
        <div class="w-26 sm:w-32">
          <label for="limit-{item.id}" class="mb-2.5 block text-xs font-medium text-stone-600"
            >{m.limitLabel}</label
          >
          <input
            id="limit-{item.id}"
            value={limit}
            oninput={(e) => (limitInput = e.currentTarget.value)}
            type="number"
            min="1"
            max="1000000"
            step="1"
            placeholder={m.unlimited}
            class="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 hover:border-stone-400 focus:border-stone-500 focus:outline-none"
          />
        </div>
        {#if mode === "password"}
          <div class="min-w-0">
            <label for="password-{item.id}" class="mb-2.5 block text-xs font-medium text-stone-600"
              >{m.sharePassword}</label
            >
            <div class="relative">
              <input
                id="password-{item.id}"
                bind:value={password}
                type={showPassword ? "text" : "password"}
                required={!canKeepPassword}
                minlength="6"
                maxlength="128"
                placeholder={canKeepPassword ? m.keepPassword : m.passwordHint}
                autocomplete="new-password"
                class="code-font h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white pl-3 pr-[4.5rem] text-sm hover:border-stone-400 focus:border-stone-500 focus:outline-none"
              />
              <div class="absolute inset-y-0 right-1 flex items-center">
                <button
                  type="button"
                  onclick={generatePassword}
                  aria-label={m.generatePassword}
                  title={m.generatePassword}
                  class="flex size-8 items-center justify-center rounded-md text-stone-600 opacity-50 hover:bg-stone-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-orange-500"
                  ><Icon name="key" size={16} /></button
                >
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  aria-label={showPassword ? m.hidePassword : m.showPassword}
                  title={showPassword ? m.hidePassword : m.showPassword}
                  aria-pressed={showPassword}
                  class="flex size-8 items-center justify-center rounded-md text-stone-600 opacity-50 hover:bg-stone-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-orange-500"
                  ><Icon name={showPassword ? "eyeOff" : "eye"} size={16} /></button
                >
              </div>
            </div>
          </div>
        {/if}
      </div>
      <div class="flex justify-end pt-1">
        <button
          type="submit"
          class="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >{item.share?.active ? m.save : m.shareOn}</button
        >
      </div>
    </fieldset>
  </form>
  {#if failed}<p role="alert" class="mt-2 text-xs text-red-600">{m.shareFailed}</p>{/if}
</section>
