import { handleCallback, loginRedirect, originAllowed, readSession } from './auth.ts';
import {
	ID_PATTERN,
	MAX_BODY_BYTES,
	MAX_FILE_BYTES,
	MAX_TEXT_LENGTH,
	type Item
} from '../src/lib/protocol.ts';

export { Space } from './space.ts';

function jsonError(error: string, status: number): Response {
	return Response.json({ error }, { status });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function bodyLength(request: Request): number {
	return Number(request.headers.get('Content-Length') ?? '');
}

async function homepage(request: Request, env: Env): Promise<Response> {
	const session = await readSession(request, env);
	if (!session) return new Response(null, { status: 302, headers: { Location: '/auth/login' } });

	const itemsP: Promise<Item[]> = env.SPACE.getByName('gh:' + session.sub).list();
	const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
	if (!shell.ok) return shell;

	const transformed = new HTMLRewriter().on('head', {
		async element(el) {
			try {
				const items = await itemsP;
				el.append(
					'<script id="bootstrap" type="application/json">' +
						JSON.stringify({ items }).replaceAll('<', '\\u003c') +
						'</script>',
					{ html: true }
				);
			} catch {
				console.error(JSON.stringify({ event: 'bootstrap_failed' }));
			}
		}
	}).transform(shell);

	const headers = new Headers(transformed.headers);
	headers.set('content-type', 'text/html; charset=utf-8');
	headers.set('cache-control', 'no-store');
	headers.delete('etag');
	return new Response(transformed.body, { status: transformed.status, headers });
}

function validateText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	if (text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
	return text;
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
	const session = await readSession(request, env);
	if (!session) return jsonError('unauthorized', 401);
	const stub = env.SPACE.getByName('gh:' + session.sub);
	const path = url.pathname;

	if (path === '/api/items') {
		if (request.method === 'GET') return Response.json({ items: await stub.list() });
		if (request.method === 'POST') {
			if (!originAllowed(request, env)) return jsonError('forbidden', 403);
			const length = bodyLength(request);
			if (!length) return jsonError('length_required', 411);
			if (length > MAX_BODY_BYTES) return jsonError('payload_too_large', 413);
			const body = await readJsonBody(request);
			if (!body || typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) return jsonError('bad_request', 400);
			const text = validateText(body.text);
			if (text === null) return jsonError('bad_request', 400);
			return Response.json({ item: await stub.create(body.id, text) }, { status: 201 });
		}
		return jsonError('method_not_allowed', 405);
	}

	if (path === '/api/files') {
		if (request.method !== 'POST') return jsonError('method_not_allowed', 405);
		if (!originAllowed(request, env)) return jsonError('forbidden', 403);
		const length = bodyLength(request);
		if (!length) return jsonError('length_required', 411);
		if (length > MAX_FILE_BYTES) return jsonError('payload_too_large', 413);
		const id = request.headers.get('x-id') ?? '';
		if (!ID_PATTERN.test(id)) return jsonError('bad_request', 400);
		let fileName = '';
		try {
			fileName = decodeURIComponent(request.headers.get('x-file-name') ?? '').trim();
		} catch {
			fileName = '';
		}
		if (fileName.length === 0 || fileName.length > 255) return jsonError('bad_request', 400);
		const key = 'gh:' + session.sub + '/' + id;
		try {
			await env.FILES.put(key, request.body, {
				httpMetadata: { contentType: request.headers.get('content-type') ?? 'application/octet-stream' }
			});
		} catch {
			return jsonError('upload_failed', 500);
		}
		const item = await stub.createFile(id, { fileName, fileSize: length, fileKey: key });
		return Response.json({ item }, { status: 201 });
	}

	const fileMatch = path.match(/^\/api\/files\/([^/]+)$/);
	if (fileMatch) {
		if (request.method !== 'GET') return jsonError('method_not_allowed', 405);
		if (!ID_PATTERN.test(fileMatch[1])) return jsonError('bad_request', 400);
		const file = await stub.getFile(fileMatch[1]);
		if (!file) return jsonError('not_found', 404);
		const obj = await env.FILES.get(file.fileKey);
		if (!obj) return jsonError('not_found', 404);
		const name = file.item.fileName ?? 'download';
		const asciiFallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
		return new Response(obj.body, {
			headers: {
				'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
				'content-disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`,
				'cache-control': 'private, no-store'
			}
		});
	}

	const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
	if (itemMatch) {
		if (request.method !== 'PATCH') return jsonError('method_not_allowed', 405);
		if (!ID_PATTERN.test(itemMatch[1])) return jsonError('bad_request', 400);
		if (!originAllowed(request, env)) return jsonError('forbidden', 403);
		const length = bodyLength(request);
		if (!length) return jsonError('length_required', 411);
		if (length > MAX_BODY_BYTES) return jsonError('payload_too_large', 413);
		const body = await readJsonBody(request);
		if (!body) return jsonError('bad_request', 400);
		const text = validateText(body.text);
		if (text === null) return jsonError('bad_request', 400);
		const item = await stub.update(itemMatch[1], text);
		if (item === null) return jsonError('not_found', 404);
		return Response.json({ item });
	}

	if (path === '/api/ws') {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return jsonError('upgrade_required', 426);
		if (!originAllowed(request, env)) return jsonError('forbidden', 403);
		return stub.fetch(request);
	}

	return jsonError('not_found', 404);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		if (path === '/' && request.method === 'GET') return homepage(request, env);
		if (path === '/auth/login' && request.method === 'GET') return loginRedirect(request, env);
		if (path === '/auth/callback' && request.method === 'GET') return handleCallback(request, env);
		if (path.startsWith('/api/')) return api(request, env, url);
		return env.ASSETS.fetch(request);
	}
} satisfies ExportedHandler<Env>;
