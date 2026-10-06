<script lang="ts">
  import type { Messages } from "#shared/i18n.js";
  import type { Item } from "#shared/protocol.js";
  import { copyText } from "#lib/clipboard.js";

  let {
    item,
    m,
    onShare,
  }: {
    item: Item;
    m: Messages;
    onShare: (active: boolean, maxDownloads: number | null) => Promise<boolean>;
  } = $props();

  let limitInput = $state<number | string>("");
  let busy = $state(false);
  let linkCopied = $state(false);
  let resetLinkCopiedId: number | undefined;

  const shareUrl = $derived(item.share?.url ? location.origin + item.share.url : "");
  const shareCount = $derived(
    item.share
      ? `${item.share.downloads} / ${item.share.maxDownloads === null ? m.unlimited : item.share.maxDownloads}`
      : "",
  );
  const exhausted = $derived(
    item.share?.active === true &&
      item.share.maxDownloads !== null &&
      item.share.downloads >= item.share.maxDownloads,
  );

  async function copyLink(): Promise<void> {
    if (await copyText(shareUrl)) {
      linkCopied = true;
      clearTimeout(resetLinkCopiedId);
      resetLinkCopiedId = setTimeout(() => (linkCopied = false), 1_500);
    }
    // on failure the url stays selectable in the input
  }

  async function enable(): Promise<void> {
    // svelte coerces number inputs, so the bound value arrives as number or ""
    const max = limitInput === "" ? null : Number(limitInput);
    if (max !== null && (!Number.isInteger(max) || max < 1)) return;
    busy = true;
    await onShare(true, max);
    busy = false;
  }

  async function disable(): Promise<void> {
    busy = true;
    await onShare(false, null);
    busy = false;
  }
</script>

<div class="mt-3 border-t border-stone-100 pt-3">
  <div class="rounded-xl bg-stone-50 p-3">
    {#if item.share?.active}
      <div class="flex flex-wrap items-center gap-2">
        <input
          readonly
          value={shareUrl}
          class="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700"
          aria-label={m.share}
        />
        <button
          onclick={() => void copyLink()}
          class="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700"
        >
          {linkCopied ? m.copied : m.copy}
        </button>
        <button
          onclick={() => void disable()}
          disabled={busy}
          class="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {m.shareOff}
        </button>
      </div>
      <p class="mt-2 text-xs {exhausted ? 'font-medium text-red-600' : 'text-stone-400'}">
        {m.limitLabel}: {shareCount}
      </p>
    {:else}
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-xs text-stone-500">
          {m.limitLabel}
          <input
            bind:value={limitInput}
            type="number"
            min="1"
            placeholder={m.unlimited}
            class="w-24 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-stone-500 focus:outline-none"
          />
        </label>
        <button
          onclick={() => void enable()}
          disabled={busy}
          class="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {m.shareOn}
        </button>
      </div>
    {/if}
  </div>
</div>
