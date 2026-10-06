<script lang="ts">
	import type { Lang, Messages } from '#lib/i18n.js';
	import type { Item } from '#lib/protocol.js';
	import { absoluteTime, relativeTime } from '#lib/time.js';
	import Icon from '#lib/Icon.svelte';

	let {
		item,
		now,
		lang,
		m,
		pending,
		onSave
	}: {
		item: Item;
		now: number;
		lang: Lang;
		m: Messages;
		pending: boolean;
		onSave: (text: string) => Promise<boolean>;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let saveFailed = $state(false);
	let copyState = $state<'idle' | 'ok' | 'fail'>('idle');
	let resetCopyId: number | undefined;

	const fileSize = $derived(
		item.kind === 'file' && item.fileSize !== undefined
			? item.fileSize >= 1024 * 1024
				? (item.fileSize / 1024 / 1024).toFixed(1) + ' MB'
				: Math.max(1, Math.round(item.fileSize / 1024)) + ' KB'
			: ''
	);

	function startEdit(): void {
		draft = item.text;
		saveFailed = false;
		editing = true;
	}

	async function save(): Promise<void> {
		const text = draft.trim();
		if (text.length === 0) return;
		if (text === item.text) {
			editing = false;
			return;
		}
		saving = true;
		const ok = await onSave(text);
		saving = false;
		if (ok) editing = false;
		else saveFailed = true;
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter' && e.shiftKey && !e.isComposing) {
			e.preventDefault();
			if (!saving) void save();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editing = false;
		}
	}

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(item.text);
			copyState = 'ok';
		} catch {
			copyState = 'fail';
		}
		clearTimeout(resetCopyId);
		resetCopyId = setTimeout(() => (copyState = 'idle'), 1_500);
	}

	const copyLabel = $derived(copyState === 'ok' ? m.copied : copyState === 'fail' ? m.copyFailed : m.copy);
</script>

<article class="flex gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-opacity {pending ? 'opacity-60' : ''}">
	<div class="min-w-0 flex-1">
		{#if item.kind === 'file'}
			<div class="flex items-baseline gap-2">
				<span class="text-xl font-bold tracking-tight text-stone-900">{relativeTime(item.createdAt, now, lang)}</span>
				<span class="text-xs text-stone-400 tabular-nums">{absoluteTime(item.createdAt, lang)}</span>
			</div>
			<p class="mt-2 flex min-w-0 items-center gap-2 text-base leading-relaxed text-stone-800">
				<Icon name="file" size={18} />
				<span class="truncate font-medium">{item.fileName}</span>
				<span class="shrink-0 text-sm text-stone-400">{fileSize}</span>
			</p>
		{:else if editing}
			<!-- svelte-ignore a11y_autofocus -->
			<textarea
				bind:value={draft}
				onkeydown={onKeydown}
				autofocus
				class="min-h-20 w-full rounded-xl border border-stone-300/90 bg-white p-3 text-base leading-relaxed field-sizing-content transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-orange-500/15 focus:outline-none"
			></textarea>
			<p class="mt-2 text-xs text-stone-400">
				{m.editHint}
				{#if saveFailed}<span class="font-medium text-red-600">{m.saveFailed}</span>{/if}
			</p>
			<div class="mt-2 flex gap-2">
				<button
					onclick={() => void save()}
					disabled={saving}
					class="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
				>
					{m.save}
				</button>
				<button
					onclick={() => (editing = false)}
					class="rounded-lg px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
				>
					{m.cancel}
				</button>
			</div>
		{:else}
			<div class="flex items-baseline gap-2">
				<span class="text-xl font-bold tracking-tight text-stone-900">{relativeTime(item.createdAt, now, lang)}</span>
				<span class="text-xs text-stone-400 tabular-nums">{absoluteTime(item.createdAt, lang)}</span>
			</div>
			<p class="mt-2 text-base leading-relaxed break-words whitespace-pre-wrap text-stone-800">{item.text}</p>
		{/if}
	</div>
	<div class="flex w-28 shrink-0 flex-col gap-2 sm:w-32">
		{#if item.kind === 'file'}
			<a
				href="/api/files/{item.id}"
				download
				class="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-white transition-all hover:bg-stone-700 active:scale-[.98]"
			>
				<Icon name="download" size={20} />
				<span class="text-sm font-semibold">{m.download}</span>
			</a>
		{:else}
			<button
				onclick={() => void copy()}
				class="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl text-white transition-all active:scale-[.98] {copyState === 'ok'
					? 'bg-emerald-600'
					: copyState === 'fail'
						? 'bg-red-600'
						: 'bg-stone-900 hover:bg-stone-700'}"
			>
				<Icon name={copyState === 'ok' ? 'check' : 'copy'} size={20} />
				<span class="text-sm font-semibold">{copyLabel}</span>
			</button>
			{#if !editing && !pending}
				<button
					onclick={startEdit}
					class="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-stone-300/90 text-stone-600 transition-all hover:border-stone-400 hover:text-stone-900 active:scale-[.98]"
				>
					<Icon name="pencil" size={20} />
					<span class="text-sm font-semibold">{m.edit}</span>
				</button>
			{/if}
		{/if}
	</div>
</article>
