import { DurableObject } from "cloudflare:workers";
import {
  MAX_COLLECTION_FILES,
  PAGE_SIZE,
  WS_PING,
  WS_PONG,
  type Item,
  type ServerMessage,
  type StoredFile,
} from "../shared/protocol.ts";

import { hashPassword, verifyPassword } from "./share-password.ts";

type Row = {
  files_json: string | null;
  share_password_hash: string | null;
  share_attempts: number;
  share_attempt_at: number;
  id: string;
  text: string;
  created_at: number;
  updated_at: number;
  kind: string;
  file_name: string | null;
  file_size: number | null;
  file_key: string | null;
  filename: string | null;
  suffix: string | null;
  share_token: string | null;
  share_active: number;
  share_max_downloads: number | null;
  share_downloads: number;
};

const SELECT_COLUMNS =
  "id, text, created_at, updated_at, kind, file_name, file_size, file_key, filename, suffix, share_token, share_active, share_max_downloads, share_downloads, files_json, share_password_hash, share_attempts, share_attempt_at";

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function rowToItem(row: Row): Item {
  const item: Item = {
    id: row.id,
    text: "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kind: "text",
  };
  if (row.kind === "file") {
    item.kind = "file";
    item.fileName = row.file_name ?? undefined;
    item.fileSize = row.file_size ?? undefined;
    if (row.files_json) item.files = JSON.parse(row.files_json) as StoredFile[];
  } else {
    item.text = row.text;
    item.filename = row.filename ?? undefined;
    item.suffix = row.suffix ?? undefined;
  }
  if (row.share_active === 1 || row.share_token !== null || row.share_downloads > 0) {
    item.share = {
      active: row.share_active === 1,
      passwordProtected: row.share_password_hash !== null,
      token: row.share_token ?? undefined,
      maxDownloads: row.share_max_downloads,
      downloads: row.share_downloads,
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
				share_downloads INTEGER NOT NULL DEFAULT 0,
				filename TEXT,
				suffix TEXT
			)
		`);
    // idempotent in-place migration for DO instances created before a column existed
    const columns = new Set<string>();
    for (const row of ctx.storage.sql.exec<{ name: string }>("PRAGMA table_info(items)"))
      columns.add(row.name);
    if (!columns.has("kind"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");
    if (!columns.has("file_name"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN file_name TEXT");
    if (!columns.has("file_size"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN file_size INTEGER");
    if (!columns.has("file_key"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN file_key TEXT");
    if (!columns.has("share_token"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN share_token TEXT");
    if (!columns.has("share_active"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN share_active INTEGER NOT NULL DEFAULT 0");
    if (!columns.has("share_max_downloads"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN share_max_downloads INTEGER");
    if (!columns.has("share_downloads"))
      ctx.storage.sql.exec(
        "ALTER TABLE items ADD COLUMN share_downloads INTEGER NOT NULL DEFAULT 0",
      );
    if (!columns.has("filename"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN filename TEXT");
    if (!columns.has("suffix")) ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN suffix TEXT");
    if (!columns.has("files_json"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN files_json TEXT");
    if (!columns.has("share_password_hash"))
      ctx.storage.sql.exec("ALTER TABLE items ADD COLUMN share_password_hash TEXT");
    if (!columns.has("share_attempts"))
      ctx.storage.sql.exec(
        "ALTER TABLE items ADD COLUMN share_attempts INTEGER NOT NULL DEFAULT 0",
      );
    if (!columns.has("share_attempt_at"))
      ctx.storage.sql.exec(
        "ALTER TABLE items ADD COLUMN share_attempt_at INTEGER NOT NULL DEFAULT 0",
      );
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS items_created_at ON items(created_at)");
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS items_share_token ON items(share_token)");
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
  }

  #ownerSub(): string {
    return (this.ctx.id.name ?? "").replace(/^gh:/, "");
  }

  #rowToItem(row: Row): Item {
    const item = rowToItem(row);
    if (item.share && row.share_token !== null) {
      item.share.url = `/f/${this.#ownerSub()}.${row.share_token}`;
    }
    return item;
  }

  list(before?: number, limit: number = PAGE_SIZE): { items: Item[]; hasMore: boolean } {
    const capped = Math.min(Math.max(1, Math.floor(limit)), 100);
    const rows = (
      before === undefined
        ? this.ctx.storage.sql.exec<Row>(
            `SELECT ${SELECT_COLUMNS} FROM items ORDER BY created_at DESC LIMIT ?`,
            capped + 1,
          )
        : this.ctx.storage.sql.exec<Row>(
            `SELECT ${SELECT_COLUMNS} FROM items WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`,
            before,
            capped + 1,
          )
    ).toArray();
    const hasMore = rows.length > capped;
    return {
      items: (hasMore ? rows.slice(0, capped) : rows).map((r) => this.#rowToItem(r)),
      hasMore,
    };
  }

  async create(id: string, text: string, filename?: string, suffix?: string): Promise<Item> {
    const now = Date.now();
    const rows = this.ctx.storage.sql
      .exec<Row>(
        `INSERT INTO items (id, text, created_at, updated_at, kind, filename, suffix) VALUES (?, ?, ?, ?, 'text', ?, ?) ON CONFLICT(id) DO NOTHING RETURNING ${SELECT_COLUMNS}`,
        id,
        text,
        now,
        now,
        filename ?? null,
        suffix ?? null,
      )
      .toArray();
    // duplicate id: the conflicting row already exists, re-read it for an idempotent response
    const item = rows.length > 0 ? this.#rowToItem(rows[0]!) : this.#selectItem(id);
    this.broadcast({ type: "upsert", item });
    return item;
  }

  async createFile(
    id: string,
    file: { fileName: string; fileSize: number; fileKey: string },
  ): Promise<Item | null> {
    if (!this.fileCanUpload(id)) return null;
    const now = Date.now();
    const rows = this.ctx.storage.sql
      .exec<Row>(
        `INSERT INTO items (id, text, created_at, updated_at, kind, file_name, file_size, file_key) VALUES (?, '', ?, ?, 'file', ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING ${SELECT_COLUMNS}`,
        id,
        now,
        now,
        file.fileName,
        file.fileSize,
        file.fileKey,
      )
      .toArray();
    // duplicate id: the conflicting row already exists, re-read it for an idempotent response
    const item = rows.length > 0 ? this.#rowToItem(rows[0]!) : this.#selectItem(id);
    this.broadcast({ type: "upsert", item });
    return item;
  }

  getItem(id: string): Item | null {
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .toArray()[0];
    return row ? this.#rowToItem(row) : null;
  }

  fileCanUpload(fileId: string, collectionId?: string): boolean {
    const existing = this.getItem(fileId);
    if (existing && (collectionId || existing.kind !== "file" || existing.files)) return false;
    const member = this.ctx.storage.sql
      .exec<{ id: string }>(
        "SELECT items.id FROM items, json_each(items.files_json) AS member WHERE json_extract(member.value, '$.id') = ? AND items.id != ? LIMIT 1",
        fileId,
        collectionId ?? fileId,
      )
      .toArray()[0];
    return !member;
  }

  collectionCanAccept(id: string, fileId: string): boolean {
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .toArray()[0];
    if (!row) return true;
    if (!row.files_json || row.kind !== "file") return false;
    const files = JSON.parse(row.files_json) as StoredFile[];
    return files.some((f) => f.id === fileId) || files.length < MAX_COLLECTION_FILES;
  }

  addCollectionFile(id: string, file: StoredFile): Item | null {
    if (!this.fileCanUpload(file.id, id) || !this.collectionCanAccept(id, file.id)) return null;
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .toArray()[0];
    const files = row?.files_json ? (JSON.parse(row.files_json) as StoredFile[]) : [];
    if (files.some((f) => f.id === file.id)) return this.#rowToItem(row!);
    files.push(file);
    const now = Date.now();
    const updated = this.ctx.storage.sql
      .exec<Row>(
        `INSERT INTO items (id, text, created_at, updated_at, kind, files_json, file_size) VALUES (?, '', ?, ?, 'file', ?, ?) ON CONFLICT(id) DO UPDATE SET files_json = excluded.files_json, file_size = excluded.file_size, updated_at = excluded.updated_at RETURNING ${SELECT_COLUMNS}`,
        id,
        now,
        now,
        JSON.stringify(files),
        files.reduce((sum, f) => sum + f.size, 0),
      )
      .one();
    const item = this.#rowToItem(updated);
    this.broadcast({ type: "upsert", item });
    return item;
  }

  getFile(id: string, memberId?: string): { item: Item; fileKey: string } | null {
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .toArray()[0];
    if (!row || row.kind !== "file") return null;
    if (row.files_json && memberId) {
      const member = (JSON.parse(row.files_json) as StoredFile[]).find((f) => f.id === memberId);
      if (!member) return null;
      return {
        item: { ...this.#rowToItem(row), fileName: member.name, fileSize: member.size },
        fileKey: `gh:${this.#ownerSub()}/${member.id}`,
      };
    }
    if (row.file_key === null || (memberId && memberId !== id)) return null;
    return { item: this.#rowToItem(row), fileKey: row.file_key };
  }

  /**
   * text is always rewritten; filename/suffix are only written when defined
   * (undefined = keep current value, null = clear, string = set)
   */
  async update(
    id: string,
    text: string,
    filename?: string | null,
    suffix?: string | null,
  ): Promise<Item | null> {
    const sets = ["text = ?", "updated_at = ?"];
    const args: unknown[] = [text, Date.now()];
    if (filename !== undefined) {
      sets.push("filename = ?");
      args.push(filename);
    }
    if (suffix !== undefined) {
      sets.push("suffix = ?");
      args.push(suffix);
    }
    args.push(id);
    const rows = this.ctx.storage.sql
      .exec<Row>(
        `UPDATE items SET ${sets.join(", ")} WHERE id = ? AND kind = 'text' RETURNING ${SELECT_COLUMNS}`,
        ...args,
      )
      .toArray();
    if (rows.length === 0) return null;
    const item = this.#rowToItem(rows[0]!); // guarded by rows.length check above
    this.broadcast({ type: "upsert", item });
    return item;
  }

  /** deletes one item; returns the R2 key when a stored file must also go */
  async removeItem(id: string): Promise<{ fileKey: string | null; fileKeys: string[] } | null> {
    const row = this.ctx.storage.sql
      .exec<{ id: string; kind: string; file_key: string | null; files_json: string | null }>(
        "DELETE FROM items WHERE id = ? RETURNING id, kind, file_key, files_json",
        id,
      )
      .toArray()[0];
    if (!row) return null;
    this.broadcast({ type: "remove", ids: [row.id] });
    return {
      fileKey: row.kind === "file" ? row.file_key : null,
      fileKeys: row.files_json
        ? (JSON.parse(row.files_json) as StoredFile[]).map((f) => `gh:${this.#ownerSub()}/${f.id}`)
        : [],
    };
  }

  async setShare(
    id: string,
    share: { active: boolean; maxDownloads: number | null; password?: string | null },
  ): Promise<Item | null> {
    const passwordHash =
      typeof share.password === "string" ? await hashPassword(share.password) : share.password;
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .toArray()[0];
    if (!row) return null;
    let token = row.share_token;
    if (share.active && token === null) {
      token = b64url(crypto.getRandomValues(new Uint8Array(16)));
    }
    const wasActive = row.share_active === 1;
    const downloads = share.active && !wasActive ? 0 : row.share_downloads;
    const updated = this.ctx.storage.sql
      .exec<Row>(
        `UPDATE items SET share_token = ?, share_active = ?, share_max_downloads = ?, share_downloads = ?, share_password_hash = ?, share_attempts = 0, updated_at = ? WHERE id = ? RETURNING ${SELECT_COLUMNS}`,
        token,
        share.active ? 1 : 0,
        share.maxDownloads,
        downloads,
        passwordHash === undefined ? row.share_password_hash : passwordHash,
        Date.now(),
        id,
      )
      .toArray()[0];
    if (!updated) return null;
    const item = this.#rowToItem(updated);
    this.broadcast({ type: "upsert", item });
    return item;
  }

  inspectShared(token: string): { item: Item; passwordHash: string | null } | null {
    const row = this.ctx.storage.sql
      .exec<Row>(
        `SELECT ${SELECT_COLUMNS} FROM items WHERE share_token = ? AND share_active = 1`,
        token,
      )
      .toArray()[0];
    if (
      !row ||
      (row.share_max_downloads !== null && row.share_downloads >= row.share_max_downloads)
    )
      return null;
    return { item: this.#rowToItem(row), passwordHash: row.share_password_hash };
  }

  async unlockShared(token: string, password: string): Promise<string | null> {
    const row = this.ctx.storage.sql
      .exec<Row>(
        `SELECT ${SELECT_COLUMNS} FROM items WHERE share_token = ? AND share_active = 1`,
        token,
      )
      .toArray()[0];
    if (
      !row?.share_password_hash ||
      (row.share_max_downloads !== null && row.share_downloads >= row.share_max_downloads)
    )
      return null;
    const now = Date.now();
    const attempts = now - row.share_attempt_at >= 60_000 ? 0 : row.share_attempts;
    if (attempts >= 10) return null;
    this.ctx.storage.sql.exec(
      "UPDATE items SET share_attempts = ?, share_attempt_at = ? WHERE id = ?",
      attempts + 1,
      attempts === 0 ? now : row.share_attempt_at,
      row.id,
    );
    if (!(await verifyPassword(password, row.share_password_hash))) return null;
    const current = this.inspectShared(token);
    if (!current || current.passwordHash !== row.share_password_hash) return null;
    this.ctx.storage.sql.exec("UPDATE items SET share_attempts = 0 WHERE id = ?", row.id);
    return row.share_password_hash;
  }

  /** public access path: no session, the token alone locates the row; active required, download budget enforced */
  async accessShared(
    token: string,
    passwordHash?: string | null,
  ): Promise<{ item: Item; fileKey: string | null; exhausted: boolean } | null> {
    const row = this.ctx.storage.sql
      .exec<Row>(
        `SELECT ${SELECT_COLUMNS} FROM items WHERE share_token = ? AND share_active = 1`,
        token,
      )
      .toArray()[0];
    if (!row || (row.share_password_hash !== null && row.share_password_hash !== passwordHash))
      return null;
    const max = row.share_max_downloads;
    if (max !== null && row.share_downloads >= max) {
      return {
        item: this.#rowToItem(row),
        fileKey: row.kind === "file" ? row.file_key : null,
        exhausted: true,
      };
    }
    const updated = this.ctx.storage.sql
      .exec<Row>(
        "UPDATE items SET share_downloads = share_downloads + 1, updated_at = ? WHERE id = ? RETURNING " +
          SELECT_COLUMNS,
        Date.now(),
        row.id,
      )
      .toArray()[0];
    if (!updated) return null;
    const item = this.#rowToItem(updated);
    this.broadcast({ type: "upsert", item });
    return { item, fileKey: row.kind === "file" ? row.file_key : null, exhausted: false };
  }

  #selectItem(id: string): Item {
    const row = this.ctx.storage.sql
      .exec<Row>(`SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`, id)
      .one();
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
    const [server, client] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const page = this.list();
    server.send(
      JSON.stringify({
        type: "snapshot",
        items: page.items,
        hasMore: page.hasMore,
      } satisfies ServerMessage),
    );
    return new Response(null, { status: 101, webSocket: client });
  }
}
