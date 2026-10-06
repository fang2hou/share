<script lang="ts">
	import { onMount } from 'svelte';
	import Composer from '#lib/Composer.svelte';
	import ItemCard from '#lib/ItemCard.svelte';
	import UploadCard from '#lib/UploadCard.svelte';
	import { messages, pickLang, type Lang } from '#lib/i18n.js';
	import { MAX_FILE_BYTES, type Item } from '#lib/protocol.js';
	import { SpaceStore } from '#lib/space.svelte.js';
	import { dayKey, dayKeyOffset, dayLabel } from '#lib/time.js';

	const LANGS: { id: Lang; label: string }[] = [
		{ id: 'zh-CN', label: '简体中文' },
		{ id: 'ja', label: '日本語' },
		{ id: 'en', label: 'English' }
	];

	function initialLang(): Lang {
		const saved = localStorage.getItem('ts_lang');
		if (saved === 'zh-CN' || saved === 'ja' || saved === 'en') return saved;
		return pickLang(navigator.languages);
	}

	let lang = $state(initialLang());
	const m = $derived(messages[lang]);
	$effect(() => {
		document.documentElement.lang = lang;
	});

	function setLang(next: Lang): void {
		lang = next;
		localStorage.setItem('ts_lang', next);
	}

	const space = new SpaceStore();

	let now = $state(Date.now());
	let notice = $state('');
	let clearNoticeId: number | undefined;
	let dragging = $state(0);
	/** per-day expand overrides; absence = default (today/yesterday open, older closed) */
	let dayOverrides = $state<Record<string, boolean>>({});

	const today = $derived(dayKeyOffset(now, 0));
	const yesterday = $derived(dayKeyOffset(now, 1));

	const visible: Item[] = $derived([...space.pending, ...space.items]);
	const dotClass = $derived(
		space.status === 'live' ? 'bg-emerald-500' : space.status === 'reconnecting' ? 'bg-amber-500' : 'bg-stone-300'
	);

	type DayGroup = { key: string; label: string; items: Item[]; expanded: boolean };

	// newest first; today and yesterday stay open, older days collapse by default
	const groups = $derived.by(() => {
		const byDay = new Map<string, Item[]>();
		for (const item of visible) {
			const key = dayKey(item.createdAt);
			const bucket = byDay.get(key);
			if (bucket) bucket.push(item);
			else byDay.set(key, [item]);
		}
		const result: DayGroup[] = [];
		for (const [key, items] of byDay) {
			const override = dayOverrides[key];
			const expanded = override ?? (key === today || key === yesterday);
			result.push({ key, label: dayLabel(items[0].createdAt, lang), items, expanded });
		}
		return result;
	});

	function toggleDay(key: string): void {
		dayOverrides[key] = !(dayOverrides[key] ?? (key === today || key === yesterday));
	}

	function showNotice(text: string): void {
		notice = text;
		clearTimeout(clearNoticeId);
		clearNoticeId = setTimeout(() => (notice = ''), 4_000);
	}

	function zipName(d: Date): string {
		const pad = (n: number): string => String(n).padStart(2, '0');
		return `files-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
	}

	async function handleFiles(list: File[]): Promise<void> {
		const files = list.filter((f) => f.size > 0);
		if (files.length === 0) return;
		let payload: File;
		if (files.length === 1) {
			payload = files[0];
		} else {
			// several files at once are packaged into a single zip, downloaded as one on the other side
			const entries: Record<string, Uint8Array> = {};
			const used = new Set<string>();
			for (const file of files) {
				let name = file.name || 'file';
				let n = 2;
				while (used.has(name)) {
					name = `${n}-${file.name || 'file'}`;
					n++;
				}
				used.add(name);
				entries[name] = new Uint8Array(await file.arrayBuffer());
			}
			const { zipSync } = await import('fflate');
			payload = new File([zipSync(entries, { level: 6 })], zipName(new Date()), { type: 'application/zip' });
		}
		if (payload.size > MAX_FILE_BYTES) {
			showNotice(m.fileTooLarge);
			return;
		}
		const ok = await space.uploadFile(payload);
		if (!ok) showNotice(m.uploadFailed);
	}

	function dragHasFiles(e: DragEvent): boolean {
		return [...(e.dataTransfer?.types ?? [])].includes('Files');
	}

	onMount(() => {
		space.connect();
		const tickId = setInterval(() => (now = Date.now()), 15_000);
		const onVisibility = () => {
			if (document.visibilityState === 'visible') now = Date.now();
		};
		const onDragEnter = (e: DragEvent) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
			dragging++;
		};
		const onDragOver = (e: DragEvent) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
		};
		const onDragLeave = (e: DragEvent) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
			dragging = Math.max(0, dragging - 1);
		};
		const onDrop = (e: DragEvent) => {
			e.preventDefault();
			dragging = 0;
			void handleFiles([...(e.dataTransfer?.files ?? [])]);
		};
		const onPaste = (e: ClipboardEvent) => {
			const files = [...(e.clipboardData?.files ?? [])];
			if (files.length > 0) void handleFiles(files);
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);
		window.addEventListener('paste', onPaste);
		return () => {
			clearInterval(tickId);
			clearTimeout(clearNoticeId);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('dragenter', onDragEnter);
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('dragleave', onDragLeave);
			window.removeEventListener('drop', onDrop);
			window.removeEventListener('paste', onPaste);
			space.destroy();
		};
	});
</script>

<main class="mx-auto max-w-3xl space-y-4 px-4 py-6">
	<header class="flex items-center justify-between">
		<span class="flex items-center gap-2" title={space.status}>
			<span class="size-2 rounded-full {dotClass}"></span>
		</span>
		<nav class="flex rounded-full border border-stone-200/80 bg-white p-0.5 shadow-sm" aria-label="Language / 语言 / 言語">
			{#each LANGS as l (l.id)}
				<button
					onclick={() => setLang(l.id)}
					aria-pressed={lang === l.id}
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors {lang === l.id
						? 'bg-stone-900 text-white'
						: 'text-stone-500 hover:text-stone-900'}"
				>
					{l.label}
				</button>
			{/each}
		</nav>
	</header>

	<Composer m={m} onSubmit={(text) => space.create(text)} onError={() => showNotice(m.sendFailed)} onFiles={(files) => void handleFiles(files)} />
	<p aria-live="polite" class="min-h-5 text-sm">
		{#if notice}
			<span class="font-medium text-red-600">{notice}</span>
		{:else if space.status === 'reconnecting'}
			<span class="font-medium text-amber-600">{m.reconnecting}</span>
		{/if}
	</p>

	{#each space.uploads as u (u.id)}
		<UploadCard name={u.name} size={u.size} progress={u.progress} m={m} />
	{/each}

	{#if visible.length === 0 && space.uploads.length === 0}
		<p class="rounded-2xl border border-dashed border-stone-300 py-16 text-center text-sm text-stone-400">{m.empty}</p>
	{/if}

	{#each groups as group (group.key)}
		<section class="space-y-3">
			<button
				onclick={() => toggleDay(group.key)}
				aria-expanded={group.expanded}
				class="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-stone-100"
			>
				<svg
					class="size-4 shrink-0 text-stone-400 transition-transform {group.expanded ? 'rotate-90' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
				<span class="text-sm font-semibold text-stone-600">{group.label}</span>
				<span class="text-xs text-stone-400">{group.items.length} {m.items}</span>
			</button>
			{#if group.expanded}
				{#each group.items as item (item.id)}
					<ItemCard
						item={item}
						now={now}
						lang={lang}
						m={m}
						pending={space.pending.some((p) => p.id === item.id)}
						onSave={(text) => space.update(item.id, text)}
						onShare={(active, maxDownloads) => space.setShare(item.id, active, maxDownloads)}
					/>
				{/each}
			{/if}
		</section>
	{/each}

	{#if space.hasMore}
		<button
			onclick={() => void space.loadOlder()}
			class="w-full rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-900"
		>
			{m.loadOlder}
		</button>
	{/if}
</main>

{#if dragging > 0}
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-orange-500/10 backdrop-blur-[2px]">
		<div class="rounded-3xl border-2 border-dashed border-orange-400 bg-white/90 px-10 py-8 shadow-lg">
			<p class="text-lg font-semibold text-stone-800">{m.dropHere}</p>
		</div>
	</div>
{/if}
