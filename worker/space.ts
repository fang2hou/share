import { DurableObject } from 'cloudflare:workers';
import { TTL_MS, WS_PING, WS_PONG, type Item, type ServerMessage } from '../src/lib/protocol.ts';

type Row = {
	id: string;
	text: string;
	created_at: number;
	updated_at: number;
	kind: string;
	file_name: string | null;
	file_size: number | null;
	file_key: string | null;
};

function rowToItem(row: Row): Item {
	if (row.kind === 'file') {
		return {
			id: row.id,
			text: '',
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			kind: 'file',
			fileName: row.file_name ?? undefined,
			fileSize: row.file_size ?? undefined
		};
	}
	return { id: row.id, text: row.text, createdAt: row.created_at, updatedAt: row.updated_at, kind: 'text' };
}

const SELECT_COLUMNS = 'id, text, created_at, updated_at, kind, file_name, file_size, file_key';

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
				file_key TEXT
			)
		`);
		// migrate pre-file-sharing DO instances (columns are simply added; existing rows default to kind='text')
		const columns = new Set<string>();
		for (const row of ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(items)')) columns.add(row.name);
		if (!columns.has('kind')) ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");
		if (!columns.has('file_name')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_name TEXT');
		if (!columns.has('file_size')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_size INTEGER');
		if (!columns.has('file_key')) ctx.storage.sql.exec('ALTER TABLE items ADD COLUMN file_key TEXT');
		ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS items_created_at ON items(created_at)');
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
	}

	list(): Item[] {
		const cutoff = Date.now() - TTL_MS;
		return this.ctx.storage.sql
			.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE created_at >= ? ORDER BY created_at DESC`, cutoff)
			.toArray()
			.map(rowToItem);
	}

	async create(id: string, text: string): Promise<Item> {
		await this.purge();
		const now = Date.now();
		this.ctx.storage.sql.exec(
			'INSERT INTO items (id, text, created_at, updated_at, kind) VALUES (?, ?, ?, ?, \'text\') ON CONFLICT(id) DO NOTHING',
			id,
			text,
			now,
			now
		);
		const item = this.selectItem(id);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	async createFile(id: string, file: { fileName: string; fileSize: number; fileKey: string }): Promise<Item> {
		await this.purge();
		const now = Date.now();
		this.ctx.storage.sql.exec(
			"INSERT INTO items (id, text, created_at, updated_at, kind, file_name, file_size, file_key) VALUES (?, '', ?, ?, 'file', ?, ?, ?) ON CONFLICT(id) DO NOTHING",
			id,
			now,
			now,
			file.fileName,
			file.fileSize,
			file.fileKey
		);
		const item = this.selectItem(id);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	getFile(id: string): { item: Item; fileKey: string } | null {
		const cutoff = Date.now() - TTL_MS;
		const rows = this.ctx.storage.sql
			.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ? AND created_at >= ?`, id, cutoff)
			.toArray();
		const row = rows[0];
		if (!row || row.kind !== 'file' || row.file_key === null) return null;
		return { item: rowToItem(row), fileKey: row.file_key };
	}

	async update(id: string, text: string): Promise<Item | null> {
		await this.purge();
		const cutoff = Date.now() - TTL_MS;
		const rows = this.ctx.storage.sql
			.exec<Row>(
				`UPDATE items SET text = ?, updated_at = ? WHERE id = ? AND created_at >= ? AND kind = 'text' RETURNING ${SELECT_COLUMNS}`,
				text,
				Date.now(),
				id,
				cutoff
			)
			.toArray();
		if (rows.length === 0) return null;
		const item = rowToItem(rows[0]);
		this.broadcast({ type: 'upsert', item });
		return item;
	}

	private selectItem(id: string): Item {
		const row = this.ctx.storage.sql
			.exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
			.one();
		return rowToItem(row);
	}

	private async purge(): Promise<void> {
		const cutoff = Date.now() - TTL_MS;
		const rows = this.ctx.storage.sql
			.exec<{ id: string; file_key: string | null }>(
				'DELETE FROM items WHERE created_at < ? RETURNING id, file_key',
				cutoff
			)
			.toArray();
		if (rows.length === 0) return;
		const keys = rows.filter((r) => r.file_key !== null).map((r) => r.file_key as string);
		if (keys.length > 0) await this.env.FILES.delete(keys).catch(() => undefined);
		this.broadcast({ type: 'remove', ids: rows.map((r) => r.id) });
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
		server.send(JSON.stringify({ type: 'snapshot', items: this.list() } satisfies ServerMessage));
		return new Response(null, { status: 101, webSocket: client });
	}
}
