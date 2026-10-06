<script lang="ts">
	import { onMount } from 'svelte';
	import Composer from '#lib/Composer.svelte';
	import ItemCard from '#lib/ItemCard.svelte';
	import UploadCard from '#lib/UploadCard.svelte';
	import { messages, pickLang, type Lang } from '#lib/i18n.js';
	import { MAX_FILE_BYTES, TTL_MS, type Item } from '#lib/protocol.js';
	import { SpaceStore } from '#lib/space.svelte.js';

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

	const visible: Item[] = $derived([...space.pending, ...space.items.filter((i) => i.createdAt >= now - TTL_MS)]);
	const dotClass = $derived(
		space.status === 'live' ? 'bg-emerald-500' : space.status === 'reconnecting' ? 'bg-amber-500' : 'bg-stone-300'
	);

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
	{#each visible as item (item.id)}
		<ItemCard
			item={item}
			now={now}
			lang={lang}
			m={m}
			pending={space.pending.some((p) => p.id === item.id)}
			onSave={(text) => space.update(item.id, text)}
		/>
	{/each}
</main>

{#if dragging > 0}
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-orange-500/10 backdrop-blur-[2px]">
		<div class="rounded-3xl border-2 border-dashed border-orange-400 bg-white/90 px-10 py-8 shadow-lg">
			<p class="text-lg font-semibold text-stone-800">{m.dropHere}</p>
		</div>
	</div>
{/if}
