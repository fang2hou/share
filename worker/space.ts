import { DurableObject } from 'cloudflare:workers';
import { PAGE_SIZE, WS_PING, WS_PONG, type Item, type ServerMessage } from '../src/lib/protocol.ts';

type Row = {
	id: string;
	text: string;
	created_at: number;
	updated_at: number;
	kind: string;
	file_name: string | null;
	file_size: number | null;
	file_key: string | null;
	share_token: string | null;
	share_active: number;
	share_max_downloads: number | null;
	share_downloads: number;
};

const SELECT_COLUMNS =
	'id, text, created_at, updated_at, kind, file_name, file_size, file_key, share_token, share_active, share_max_downloads, share_downloads';

const te = new TextEncoder();

function b64url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function rowToItem(row: Row): Item {
	const item: Item = { id: row.id, text: '', createdAt: row.created_at, updatedAt: row.updated_at, kind: 'text' };
	if (row.kind === 'file') {
		item.kind = 'file';
		item.fileName = row.file_name ?? undefined;
		item.fileSize = row.file_size ?? undefined;
	} else {
		item.text = row.text;
	}
	if (row.share_active === 1 || row.share_token !== null || row.share_downloads > 0) {
		item.share = {
			active: row.share_active === 1,
			token: row.share_token ?? undefined,
			maxDownloads: row.share_max_downloads,
			downloads: row.share_downloads
	};
	}
	return item;
}

export class Space extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS items (
				id TEXT PRIMARY KEY,
				text TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				kind TEXT NOT NULL DEFAULT 'text',
				file_name TEXT,
				file_size INTEGER,
				file_key TEXT,
				share_token TEXT,
				share_active INTEGER NOT NULL DEFAULT 0,
				share_max_downloads INTEGER,
				share_downloads INTEGER NOT NULL DEFAULT 0
			)
		`);
		// idempotent in-place migration for DO instances created before a column existed
		const columns = new Set<string>();
		for (const row of ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(items)')) columns.add(row.name);
		if (!columns.has('kind')) ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");
		if (!columns.has('file_name')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_name TEXT');
		if (!columns.has('file_size')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_size INTEGER');
		if (!columns.has('file_key')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_key TEXT');
		if (!columns.has('share_token')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN share_token TEXT');
		if (!columns.has('share_active')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN share_active INTEGER NOT NULL DEFAULT 0');
		if (!columns.has('share_max_downloads')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN share_max_downloads INTEGER');
		if (!columns.has('share_downloads')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN share_downloads INTEGER NOT NULL DEFAULT 0');
		ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS items_created_at ON items(created_at)');
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
	}

	#ownerSub(): string {
		return (this.ctx.id.name ?? '').replace(/^gh:/, '');
	}

	#rowToItem(row: Row): Item {
		const item = rowToItem(row);
	if (item.share && row.share_token !== null) {
		item.share.url = `/f/${this.#ownerSub()}/${row.id}/${row.share_token}`;
	}
		return item;
	}

	list(before?: number, limit: number = PAGE_SIZE): { items: Item[]; hasMore: boolean } {
		const capped = Math.min(Math.max(1, Math.floor(limit)), 100);
		const rows = (
			before === undefined
				? this.ctx.storage.sql.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items ORDER BY created_at DESC LIMIT ?`, capped + 1)
				: this.ctx.storage.sql.exec<Row>(
						`SELECT ${SELECT_COLUMNS} FROM items WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`,
						before,
						capped + 1
					)
		).toArray();
		const hasMore = rows.length > capped;
		return { items: (hasMore ? rows.slice(0, capped) : rows).map((r) => this.#rowToItem(r)), hasMore };
	}

	async create(id: string, text: string): Promise<Item> {
		const now = Date.now();
		await this.ctx.storage.sql.exec(
			'INSERT INTO items (id, text, created_at, updated_at, kind) VALUES (?, ?, ?, ?, \'text\') ON CONFLICT(id) DO NOTHING',
			id,
			text,
			now,
			now
		);
		const item = this.#selectItem(id);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	async createFile(id: string, file: { fileName: string; fileSize: number; fileKey: string }): Promise<Item> {
		const now = Date.now();
		await this.ctx.storage.sql.exec(
			"INSERT INTO items (id, text, created_at, updated_at, kind, file_name, file_size, file_key) VALUES (?, '', ?, ?, 'file', ?, ?, ?) ON CONFLICT(id) DO NOTHING",
			id,
			now,
			now,
			file.fileName,
			file.fileSize,
			file.fileKey
		);
		const item = this.#selectItem(id);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	getFile(id: string): { item: Item; fileKey: string } | null {
		const row = this.ctx.storage.sql.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id).toArray()[0];
		if (!row || row.kind !== 'file' || row.file_key === null) return null;
		return { item: this.#rowToItem(row), fileKey: row.file_key };
	}

	async update(id: string, text: string): Promise<Item | null> {
		const rows = this.ctx.storage.sql
			.exec<Row>(
				`UPDATE items SET text = ?, updated_at = ? WHERE id = ? AND kind = 'text' RETURNING ${SELECT_COLUMNS}`,
				text,
				Date.now(),
				id
			)
			.toArray();
		if (rows.length === 0) return null;
		const item = this.#rowToItem(rows[0]);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	async setShare(id: string, share: { active: boolean; maxDownloads: number | null }): Promise<Item | null> {
		const row = this.ctx.storage.sql.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id).toArray()[0];
		if (!row) return null;
		let token = row.share_token;
		if (share.active && token === null) {
			token = b64url(crypto.getRandomValues(new Uint8Array(32)));
		}
		const wasActive = row.share_active === 1;
		const downloads = share.active && !wasActive ? 0 : row.share_downloads;
		const updated = this.ctx.storage.sql
			.exec<Row>(
			`UPDATE items SET share_token = ?, share_active = ?, share_max_downloads = ?, share_downloads = ?, updated_at = ? WHERE id = ? RETURNING ${SELECT_COLUMNS}`,
			token,
			share.active ? 1 : 0,
			share.maxDownloads,
			downloads,
			Date.now(),
			id
			)
			.toArray()[0];
		const item = this.#rowToItem(updated);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	/** public access path: no session, token must match, active required, download budget enforced */
	async accessShared(id: string, token: string): Promise<{ item: Item; fileKey: string | null; exhausted: boolean } | null> {
		const row = this.ctx.storage.sql.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id).toArray()[0];
		if (!row || row.share_active !== 1 || row.share_token === null) return null;
		const given = te.encode(token);
		const actual = te.encode(row.share_token);
		if (given.length !== actual.length || !crypto.subtle.timingSafeEqual(given, actual)) return null;
		const max = row.share_max_downloads;
		if (max !== null && row.share_downloads >= max) {
			return { item: this.#rowToItem(row), fileKey: row.kind === 'file' ? row.file_key : null, exhausted: true };
		}
		const updated = this.ctx.storage.sql
			.exec<Row>('UPDATE items SET share_downloads = share_downloads + 1, updated_at = ? WHERE id = ? RETURNING ' + SELECT_COLUMNS, Date.now(), id)
			.toArray()[0];
		const item = this.#rowToItem(updated);
		this.broadcast({ type: 'upsert', item });
		return { item, fileKey: row.kind === 'file' ? row.file_key : null, exhausted: false };
	}

	#selectItem(id: string): Item {
		const row = this.ctx.storage.sql.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id).one();
		return this.#rowToItem(row);
	}

	private broadcast(msg: ServerMessage): void {
		const data = JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(data);
			} catch {
				// individual socket failures must not break the broadcast
			}
		}
	}

	override fetch(): Response {
		const [server, client] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(server);
		const page = this.list();
		server.send(JSON.stringify({ type: 'snapshot', items: page.items, hasMore: page.hasMore } satisfies ServerMessage));
		return new Response(null, { status: 101, webSocket: client });
	}
}
