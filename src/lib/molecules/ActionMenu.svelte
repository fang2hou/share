<script lang="ts">
  import type { Messages } from "#shared/i18n.js";
  import Icon from "#lib/atoms/Icon.svelte";
  import { keys } from "#lib/kbd.js";

  let {
    m,
    showEdit,
    showDownload,
    shareActive,
    onShare,
    onEdit,
    onDownload,
    onDelete,
  }: {
    m: Messages;
    showEdit: boolean;
    showDownload: boolean;
    shareActive: boolean;
    onShare: () => void;
    onEdit: () => void;
    onDownload: () => void;
    onDelete: () => Promise<boolean>;
  } = $props();

  let open = $state(false);
  let confirmDelete = $state(false);

  function toggle(): void {
    open = !open;
    confirmDelete = false;
  }

  // deletion is permanent: the first tap arms it, the second confirms
  async function remove(): Promise<void> {
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    await onDelete();
    confirmDelete = false;
    open = false;
  }
</script>

<div class="relative">
  <button
    onclick={toggle}
    aria-label={m.more}
    aria-expanded={open}
    class="squircle flex size-10 items-center justify-center rounded-xl border border-stone-200 text-stone-400 transition-all hover:border-stone-300 hover:text-stone-700 active:scale-[.97] {open
      ? 'border-stone-300 text-stone-700'
      : ''}"
  >
    <Icon name="ellipsis" size={17} />
  </button>
  {#if open}
    <div
      class="squircle absolute right-0 top-11 z-50 w-36 rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
    >
      <button
        class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {shareActive
          ? 'bg-emerald-50 font-medium text-emerald-700'
          : 'text-stone-600 hover:bg-stone-100'}"
        onclick={() => {
          onShare();
          open = false;
        }}
      >
        <Icon name="link" size={15} />
        {m.share}
        <span class="ml-auto text-[11px] font-medium tracking-wide text-stone-400"
          >{keys.share}</span
        >
      </button>
      {#if showEdit}
        <button
          class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-stone-600 transition-colors hover:bg-stone-100"
          onclick={() => {
            onEdit();
            open = false;
          }}
        >
          <Icon name="pencil" size={15} />
          {m.edit}
          <span class="ml-auto text-[11px] font-medium tracking-wide text-stone-400"
            >{keys.edit}</span
          >
        </button>
      {/if}
      {#if showDownload}
        <button
          class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-stone-600 transition-colors hover:bg-stone-100"
          onclick={() => {
            onDownload();
            open = false;
          }}
        >
          <Icon name="download" size={15} />
          {m.download}
        </button>
      {/if}
      <button
        class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {confirmDelete
          ? 'bg-red-50 font-medium text-red-600'
          : 'text-stone-600 hover:bg-stone-100'}"
        onclick={() => void remove()}
      >
        <Icon name="trash" size={15} />
        {confirmDelete ? m.confirmDelete : m.delete}
        <span
          class="ml-auto text-[11px] font-medium tracking-wide text-stone-400 {confirmDelete
            ? 'text-red-400'
            : ''}">{keys.del}</span
        >
      </button>
    </div>
    <!-- close on outside click -->
    <div class="fixed inset-0 z-40" onclick={() => (open = false)} aria-hidden="true"></div>
  {/if}
</div>
