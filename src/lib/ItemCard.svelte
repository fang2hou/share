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
		onSave,
		onShare
	}: {
		item: Item;
		now: number;
		lang: Lang;
		m: Messages;
		pending: boolean;
		onSave: (text: string) => Promise<boolean>;
		onShare: (active: boolean, maxDownloads: number | null) => Promise<boolean>;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let saveFailed = $state(false);
	let copyState = $state<'idle' | 'ok' | 'fail'>('idle');
	let resetCopyId: number | undefined;
	let shareOpen = $state(false);
	let limitInput = $state('');
	let shareBusy = $state(false);
	let linkCopied = $state(false);
	let resetLinkCopiedId: number | undefined;

	const fileSize = $derived(
		item.kind === 'file' && item.fileSize !== undefined
			? item.fileSize >= 1024 * 1024
				? (item.fileSize / 1024 / 1024).toFixed(1) + ' MB'
				: Math.max(1, Math.round(item.fileSize / 1024)) + ' KB'
			: ''
	);
	const shareUrl = $derived(item.share?.url ? location.origin + item.share.url : '');
	const shareCount = $derived(
		item.share ? `${item.share.downloads} / ${item.share.maxDownloads === null ? m.unlimited : item.share.maxDownloads}` : ''
	);
	const exhausted = $derived(
		item.share?.active === true &&
			item.share.maxDownloads !== null &&
			item.share.downloads >= item.share.maxDownloads
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

	async function copyLink(): Promise<void> {
		try {
			await navigator.clipboard.writeText(shareUrl);
			linkCopied = true;
			clearTimeout(resetLinkCopiedId);
			resetLinkCopiedId = setTimeout(() => (linkCopied = false), 1_500);
		} catch {
			// clipboard unavailable; the url stays selectable in the input
		}
	}

	async function enableShare(): Promise<void> {
		const trimmed = limitInput.trim();
		const max = trimmed.length === 0 ? null : Number(trimmed);
		if (max !== null && (!Number.isInteger(max) || max < 1)) return;
		shareBusy = true;
		await onShare(true, max);
		shareBusy = false;
	}

	async function disableShare(): Promise<void> {
		shareBusy = true;
		await onShare(false, null);
		shareBusy = false;
	}

	const copyLabel = $derived(copyState === 'ok' ? m.copied : copyState === 'fail' ? m.copyFailed : m.copy);
</script>

<article class="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-opacity {pending ? 'opacity-60' : ''}">
	<div class="flex gap-3">
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
	</div>

	{#if !editing && !pending}
		<div class="mt-3 flex items-center gap-2 border-t border-stone-100 pt-2">
			<button
				onclick={() => (shareOpen = !shareOpen)}
				aria-expanded={shareOpen}
				class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors {item.share?.active
					? 'text-emerald-700 hover:bg-emerald-50'
					: 'text-stone-400 hover:bg-stone-100 hover:text-stone-700'}"
			>
				<Icon name="link" size={14} />
				{m.share}
				{#if item.share?.active}
					<span class="tabular-nums {exhausted ? 'text-red-600' : ''}">· {shareCount}</span>
				{/if}
			</button>
		</div>
		{#if shareOpen}
			<div class="mt-2 rounded-xl bg-stone-50 p-3">
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
							onclick={() => void disableShare()}
							disabled={shareBusy}
							class="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
						>
							{m.shareOff}
						</button>
					</div>
					<p class="mt-2 text-xs {exhausted ? 'font-medium text-red-600' : 'text-stone-400'}">{m.limitLabel}: {shareCount}</p>
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
							onclick={() => void enableShare()}
							disabled={shareBusy}
							class="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
						>
							{m.shareOn}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</article>
