import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { signSession } from '../worker/auth.ts';
import { TTL_MS, type Item, type ServerMessage } from '../src/lib/protocol.ts';

const BASE = 'http://example.com';
const ORIGIN = BASE;

type ItemList = { items: Item[] };
type CreatedItem = { item: Item };
type MessageCollector = { next: () => Promise<ServerMessage> };

async function sessionCookie(sub: string, nowSec?: number): Promise<string> {
	const token = await signSession(env.SESSION_SECRET, { sub, login: 't-' + sub }, nowSec);
	return 'ts_session=' + token;
}

function collector(ws: WebSocket): MessageCollector {
	const buffered: ServerMessage[] = [];
	const waiters: ((m: ServerMessage) => void)[] = [];
	ws.addEventListener('message', (e) => {
		const msg = JSON.parse(e.data) as ServerMessage;
		const waiter = waiters.shift();
		if (waiter) waiter(msg);
		else buffered.push(msg);
	});
	return {
		next() {
			const msg = buffered.shift();
			if (msg) return Promise.resolve(msg);
			const { promise, resolve } = Promise.withResolvers<ServerMessage>();
			waiters.push(resolve);
			return promise;
		}
	};
}

async function connectWs(cookie: string): Promise<{ ws: WebSocket; messages: MessageCollector }> {
	const res = await SELF.fetch(BASE + '/api/ws', {
		headers: { Cookie: cookie, Origin: ORIGIN, Upgrade: 'websocket', Connection: 'Upgrade' }
	});
	if (res.status !== 101) throw new Error('ws upgrade failed: ' + res.status);
	const ws = res.webSocket as WebSocket;
	ws.accept();
	return { ws, messages: collector(ws) };
}

async function postItem(cookie: string, id: string, text: string): Promise<Response> {
	return SELF.fetch(BASE + '/api/items', {
		method: 'POST',
		headers: { Cookie: cookie, Origin: ORIGIN },
		body: JSON.stringify({ id, text })
	});
}

async function insertExpiredRow(sub: string, id: string): Promise<void> {
	await runInDurableObject(env.SPACE.getByName('gh:' + sub), (_instance, state) => {
		const old = Date.now() - TTL_MS - 1000;
		state.storage.sql.exec(
			'INSERT INTO items (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)',
			id,
			'stale',
			old,
			old
		);
	});
}

async function rowCount(sub: string): Promise<number> {
	return runInDurableObject(env.SPACE.getByName('gh:' + sub), (_i, state) =>
		state.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM items').one().n
	);
}

describe('auth', () => {
	it('rejects missing, tampered, and expired sessions', async () => {
		const missing = await SELF.fetch(BASE + '/api/items');
		expect(missing.status).toBe(401);

		const token = await signSession(env.SESSION_SECRET, { sub: '1', login: 't' });
		const dot = token.lastIndexOf('.');
		const sig = token.slice(dot + 1);
		const flipped = (sig.startsWith('A') ? 'B' : 'A') + sig.slice(1);
		const tampered = token.slice(0, dot + 1) + flipped;
		const tamperedRes = await SELF.fetch(BASE + '/api/items', { headers: { Cookie: 'ts_session=' + tampered } });
		expect(tamperedRes.status).toBe(401);

		const expiredToken = await signSession(
			env.SESSION_SECRET,
			{ sub: '1', login: 't' },
			Math.floor(Date.now() / 1000) - 30 * 24 * 3600 - 60
		);
		const expiredRes = await SELF.fetch(BASE + '/api/items', { headers: { Cookie: 'ts_session=' + expiredToken } });
		expect(expiredRes.status).toBe(401);
	});
});

describe('items api', () => {
	it('creates, lists, and is idempotent on duplicate ids', async () => {
		const cookie = await sessionCookie('2');
		const id = crypto.randomUUID();
		const post = await postItem(cookie, id, 'hello world');
		expect(post.status).toBe(201);
		const created = (await post.json()) as CreatedItem;
		expect(created.item.text).toBe('hello world');

		const again = await postItem(cookie, id, 'hello world');
		expect(again.status).toBe(201);

		const listRes = await SELF.fetch(BASE + '/api/items', { headers: { Cookie: cookie } });
		const list = (await listRes.json()) as ItemList;
		expect(list.items.map((i) => i.id)).toEqual([id]);
	});

	it('hides expired rows on read and purges them on write, broadcasting via websocket', { timeout: 20_000 }, async () => {
		const cookie = await sessionCookie('3');
		const expiredId = 'expired-row-3';
		await insertExpiredRow('3', expiredId);

		const listRes = await SELF.fetch(BASE + '/api/items', { headers: { Cookie: cookie } });
		const list = (await listRes.json()) as ItemList;
		expect(list.items).toEqual([]);
		expect(await rowCount('3')).toBe(1);

		const { ws, messages } = await connectWs(cookie);
		const snapshot = await messages.next();
		expect(snapshot).toEqual({ type: 'snapshot', items: [] });

		const newId = crypto.randomUUID();
		const post = await postItem(cookie, newId, 'fresh');
		expect(post.status).toBe(201);

		const removeMsg = await messages.next();
		expect(removeMsg).toEqual({ type: 'remove', ids: [expiredId] });

		const upsertMsg = await messages.next();
		if (upsertMsg.type !== 'upsert') throw new Error('expected upsert, got ' + JSON.stringify(upsertMsg));
		expect(upsertMsg.item.id).toBe(newId);

		expect(await rowCount('3')).toBe(1);
		ws.close();
	});

	it('updates existing items and 404s for missing or expired ids', { timeout: 20_000 }, async () => {
		const cookie = await sessionCookie('4a');
		const id = crypto.randomUUID();
		await postItem(cookie, id, 'v1');

		const { ws, messages } = await connectWs(cookie);
		await messages.next();

		const patch = await SELF.fetch(BASE + '/api/items/' + id, {
			method: 'PATCH',
			headers: { Cookie: cookie, Origin: ORIGIN },
			body: JSON.stringify({ text: 'v2' })
		});
		expect(patch.status).toBe(200);
		const patched = (await patch.json()) as CreatedItem;
		expect(patched.item.text).toBe('v2');
		expect(patched.item.updatedAt).toBeGreaterThan(patched.item.createdAt);

		const upsertMsg = await messages.next();
		expect(upsertMsg).toEqual({ type: 'upsert', item: patched.item });
		ws.close();

		const missing = await SELF.fetch(BASE + '/api/items/' + crypto.randomUUID(), {
			method: 'PATCH',
			headers: { Cookie: cookie, Origin: ORIGIN },
			body: JSON.stringify({ text: 'x' })
		});
		expect(missing.status).toBe(404);
		const otherCookie = await sessionCookie('4b');
		const expiredId = crypto.randomUUID();
		await insertExpiredRow('4b', expiredId);
		const expiredPatch = await SELF.fetch(BASE + '/api/items/' + expiredId, {
			method: 'PATCH',
			headers: { Cookie: otherCookie, Origin: ORIGIN },
			body: JSON.stringify({ text: 'x' })
		});
		expect(expiredPatch.status).toBe(404);
	});

	it('isolates users', async () => {
		const cookieA = await sessionCookie('5a');
		const cookieB = await sessionCookie('5b');
		const post = await postItem(cookieA, crypto.randomUUID(), 'only for a');
		expect(post.status).toBe(201);

		const listB = await SELF.fetch(BASE + '/api/items', { headers: { Cookie: cookieB } });
		const list = (await listB.json()) as ItemList;
		expect(list.items).toEqual([]);
	});

	it('rejects bad origins and blank text', async () => {
		const cookie = await sessionCookie('6');
		const evil = await SELF.fetch(BASE + '/api/items', {
			method: 'POST',
			headers: { Cookie: cookie, Origin: 'http://evil.example' },
			body: JSON.stringify({ id: crypto.randomUUID(), text: 'x' })
		});
		expect(evil.status).toBe(403);

		const blank = await postItem(cookie, crypto.randomUUID(), '   \n\t ');
		expect(blank.status).toBe(400);
	});
});

describe('homepage', () => {
	it('injects escaped bootstrap data and redirects anonymous visitors', async () => {
		const cookie = await sessionCookie('7');
		await postItem(cookie, crypto.randomUUID(), '</script><b>x');

		const page = await SELF.fetch(BASE + '/', { headers: { Cookie: cookie } });
		expect(page.status).toBe(200);
		const html = await page.text();
		expect(html).toContain('<script id="bootstrap" type="application/json">');
		expect(html).toContain('\\u003c/script>');
		expect(html).not.toContain('</script><b>');
		expect(page.headers.get('cache-control')).toBe('no-store');

		const anon = await SELF.fetch(BASE + '/', { redirect: 'manual' });
		expect(anon.status).toBe(302);
		expect(anon.headers.get('Location')).toBe('/auth/login');
	});
});

describe('files api', () => {
	it('uploads, lists, and downloads a file', async () => {
		const cookie = await sessionCookie('f1');
		const id = crypto.randomUUID();
		const bytes = 'file-payload-测试-123';
		const res = await SELF.fetch(BASE + '/api/files', {
			method: 'POST',
			headers: {
				Cookie: cookie,
				Origin: ORIGIN,
				'content-type': 'text/plain',
				'x-id': id,
				'x-file-name': encodeURIComponent('笔记 note.txt')
			},
			body: bytes
		});
		expect(res.status).toBe(201);
		const created = (await res.json()) as CreatedItem;
		expect(created.item.kind).toBe('file');
		expect(created.item.fileName).toBe('笔记 note.txt');
		expect(created.item.fileSize).toBe(new TextEncoder().encode(bytes).length);
		expect(created.item.text).toBe('');

		const list = (await (await SELF.fetch(BASE + '/api/items', { headers: { Cookie: cookie } })).json()) as ItemList;
		expect(list.items.some((i) => i.id === id && i.kind === 'file')).toBe(true);

		const dl = await SELF.fetch(BASE + '/api/files/' + id, { headers: { Cookie: cookie } });
		expect(dl.status).toBe(200);
		expect(dl.headers.get('content-type')).toBe('text/plain');
		expect(dl.headers.get('content-disposition')).toContain("filename*=UTF-8''");
		expect(await dl.text()).toBe(bytes);
	});

	it('broadcasts file items over ws and rejects PATCH on them', async () => {
		const cookie = await sessionCookie('f2');
		const { messages } = await connectWs(cookie);
		const snapshot = await messages.next();
		expect(snapshot.type).toBe('snapshot');

		const id = crypto.randomUUID();
		const res = await SELF.fetch(BASE + '/api/files', {
			method: 'POST',
			headers: { Cookie: cookie, Origin: ORIGIN, 'content-type': 'application/zip', 'x-id': id, 'x-file-name': 'pack.zip' },
			body: 'zip-bytes'
		});
		expect(res.status).toBe(201);
		const upsert = await messages.next();
		expect(upsert.type).toBe('upsert');
		if (upsert.type === 'upsert') expect(upsert.item.fileName).toBe('pack.zip');

		const patch = await SELF.fetch(BASE + '/api/items/' + id, {
			method: 'PATCH',
			headers: { Cookie: cookie, Origin: ORIGIN },
			body: JSON.stringify({ text: 'nope' })
		});
		expect(patch.status).toBe(404);
	});

	it('purges expired file rows and deletes their R2 objects', async () => {
		const cookie = await sessionCookie('f3');
		const expiredId = crypto.randomUUID();
		const expiredKey = 'gh:f3/' + expiredId;
		await env.FILES.put(expiredKey, 'stale-object', { httpMetadata: { contentType: 'application/octet-stream' } });
		await runInDurableObject(env.SPACE.getByName('gh:f3'), (_instance, state) => {
			const old = Date.now() - TTL_MS - 1000;
			state.storage.sql.exec(
				"INSERT INTO items (id, text, created_at, updated_at, kind, file_name, file_size, file_key) VALUES (?, '', ?, ?, 'file', 'old.bin', 8, ?)",
				expiredId,
				old,
				old,
				expiredKey
			);
		});
		await postItem(cookie, crypto.randomUUID(), 'trigger purge');
		expect(await rowCount('f3')).toBe(1);

		// purge awaits the R2 delete inline, so the object is gone once the write returns
		expect(await env.FILES.head(expiredKey)).toBeNull();
	});

	it('guards file endpoints', async () => {
		const cookie = await sessionCookie('f4');
		const evil = await SELF.fetch(BASE + '/api/files', {
			method: 'POST',
			headers: { Cookie: cookie, Origin: 'http://evil.example', 'x-id': crypto.randomUUID(), 'x-file-name': 'x' },
			body: 'x'
		});
		expect(evil.status).toBe(403);

		const get405 = await SELF.fetch(BASE + '/api/files', { headers: { Cookie: cookie } });
		expect(get405.status).toBe(405);

		const badName = await SELF.fetch(BASE + '/api/files', {
			method: 'POST',
			headers: { Cookie: cookie, Origin: ORIGIN, 'x-id': crypto.randomUUID(), 'x-file-name': '%E0%A4%A' },
			body: 'x'
		});
		expect(badName.status).toBe(400);

		const missing = await SELF.fetch(BASE + '/api/files/' + crypto.randomUUID(), { headers: { Cookie: cookie } });
		expect(missing.status).toBe(404);
	});
});
