import { WS_PING, WS_PONG, type Item, type ServerMessage } from "#shared/protocol.js";

export class SpaceStore {
  items = $state<Item[]>([]);
  pending = $state<Item[]>([]);
  uploads = $state<{ id: string; name: string; size: number; progress: number }[]>([]);
  status = $state<"connecting" | "live" | "reconnecting">("connecting");
  hasMore = $state(false);

  #ws: WebSocket | null = null;
  #heartbeatId: number | undefined;
  #watchdogId: number | undefined;
  #retryId: number | undefined;
  #attempts = 0;
  #pongAt = 0;
  #destroyed = false;
  #local = new Set<string>();
  #onRemote: ((item: Item) => void) | undefined;

  #onVisibility = (): void => {
    if (this.#destroyed || document.visibilityState !== "visible") return;
    const ws = this.#ws;
    if (ws && ws.readyState === WebSocket.OPEN) return;
    if (this.#retryId !== undefined) {
      clearTimeout(this.#retryId);
      this.#retryId = undefined;
    }
    void this.refresh();
    this.connect();
  };

  constructor(opts: { onRemote?: (item: Item) => void } = {}) {
    this.#onRemote = opts.onRemote;
    const el = document.getElementById("bootstrap");
    if (el) {
      el.remove();
      try {
        const data = JSON.parse(el.textContent ?? "") as { items?: unknown; hasMore?: boolean };
        if (Array.isArray(data.items))
          this.applySnapshot(data.items as Item[], data.hasMore === true);
        else void this.refresh();
      } catch {
        void this.refresh();
      }
    } else {
      void this.refresh();
    }
    document.addEventListener("visibilitychange", this.#onVisibility);
  }

  applySnapshot(items: Item[], hasMore = this.hasMore): void {
    this.items = [...items].sort((a, b) => b.createdAt - a.createdAt);
    this.hasMore = hasMore;
    const ids = new Set(items.map((i) => i.id));
    this.pending = this.pending.filter((p) => !ids.has(p.id));
  }

  upsert(item: Item): void {
    this.pending = this.pending.filter((p) => p.id !== item.id);
    const index = this.items.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      const existing = this.items[index];
      if (!existing) return;
      if (existing.updatedAt >= item.updatedAt) return;
      this.items[index] = item;
      return;
    }
    let insertAt = this.items.findIndex((i) => i.createdAt < item.createdAt);
    if (insertAt < 0) insertAt = this.items.length;
    this.items.splice(insertAt, 0, item);
  }

  remove(ids: string[]): void {
    const removed = new Set(ids);
    this.items = this.items.filter((i) => !removed.has(i.id));
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) {
        location.href = "/auth/login";
        return;
      }
      if (res.status !== 200) return;
      const data = (await res.json()) as { items?: unknown; hasMore?: boolean };
      if (Array.isArray(data.items))
        this.applySnapshot(data.items as Item[], data.hasMore === true);
    } catch {
      // keep whatever state we already have
    }
  }

  // cursor pagination: pull the page older than the oldest loaded item
  async loadOlder(): Promise<void> {
    if (!this.hasMore) return;
    const oldest = this.items.at(-1);
    if (!oldest) return;
    const before = oldest.createdAt;
    try {
      const res = await fetch("/api/items?before=" + before);
      if (res.status !== 200) return;
      const data = (await res.json()) as { items?: unknown; hasMore?: boolean };
      if (!Array.isArray(data.items)) return;
      const incoming = data.items as Item[];
      this.hasMore = data.hasMore === true;
      for (const item of incoming) this.upsert(item);
    } catch {
      // pagination is best-effort; the button stays available
    }
  }

  async setShare(id: string, active: boolean, maxDownloads: number | null): Promise<boolean> {
    try {
      const res = await fetch("/api/items/" + id + "/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, maxDownloads }),
      });
      if (res.status !== 200) return false;
      const data = (await res.json()) as { item: Item };
      this.upsert(data.item);
      return true;
    } catch {
      return false;
    }
  }

  async create(text: string, meta: { filename?: string; suffix?: string } = {}): Promise<boolean> {
    const id = crypto.randomUUID();
    this.#local.add(id);
    const now = Date.now();
    this.pending.unshift({
      id,
      text,
      createdAt: now,
      updatedAt: now,
      kind: "text",
      filename: meta.filename,
      suffix: meta.suffix,
    });
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text, filename: meta.filename, suffix: meta.suffix }),
      });
      if (res.status === 401) {
        location.href = "/auth/login";
        return false;
      }
      if (res.status !== 201) {
        this.pending = this.pending.filter((p) => p.id !== id);
        return false;
      }
      const data = (await res.json()) as { item: Item };
      this.upsert(data.item);
      return true;
    } catch {
      this.pending = this.pending.filter((p) => p.id !== id);
      return false;
    }
  }

  async update(id: string, text: string): Promise<boolean> {
    try {
      const res = await fetch("/api/items/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status !== 200) return false;
      const data = (await res.json()) as { item: Item };
      this.upsert(data.item);
      return true;
    } catch {
      return false;
    }
  }

  // permanent deletion: item row and (for files) the R2 object behind it
  async removeItem(id: string): Promise<boolean> {
    try {
      const res = await fetch("/api/items/" + id, { method: "DELETE" });
      if (res.status === 401) {
        location.href = "/auth/login";
        return false;
      }
      if (res.status !== 200) return false;
      this.remove([id]);
      return true;
    } catch {
      return false;
    }
  }

  // upload with real progress; the file goes to /api/files as the raw body (R2-backed)
  async uploadFile(file: File): Promise<boolean> {
    const id = crypto.randomUUID();
    this.#local.add(id);
    this.uploads.unshift({ id, name: file.name, size: file.size, progress: 0 });
    const { promise, resolve, reject } = Promise.withResolvers<{
      status: number;
      item: Item | null;
    }>();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.responseType = "json";
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-id", id);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const upload = this.uploads.find((u) => u.id === id);
      if (upload) upload.progress = Math.round((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      const body = xhr.response as { item?: Item } | null;
      resolve({ status: xhr.status, item: body?.item ?? null });
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.onabort = () => reject(new Error("upload_aborted"));
    xhr.send(file);
    try {
      const result = await promise;
      this.uploads = this.uploads.filter((u) => u.id !== id);
      if (result.status === 401) {
        location.href = "/auth/login";
        return false;
      }
      if (result.status !== 201 || result.item === null) return false;
      this.upsert(result.item);
      return true;
    } catch {
      this.uploads = this.uploads.filter((u) => u.id !== id);
      return false;
    }
  }

  connect(): void {
    if (this.#destroyed) return;
    const ws = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api/ws",
    );
    this.#ws = ws;
    ws.onopen = () => {
      if (this.#ws !== ws) return;
      this.status = "live";
      this.#attempts = 0;
      this.#startHeartbeat();
    };
    ws.onmessage = (e: MessageEvent) => {
      if (e.data === WS_PONG) {
        this.#pongAt = Date.now();
        return;
      }
      this.#dispatch(e.data);
    };
    ws.onclose = () => {
      if (this.#ws !== ws || this.#destroyed) return;
      this.status = "reconnecting";
      this.#stopHeartbeat();
      const delay = Math.min(500 * 2 ** this.#attempts, 10_000);
      this.#attempts += 1;
      this.#retryId = setTimeout(() => {
        this.#retryId = undefined;
        void this.refresh();
        this.connect();
      }, delay);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // socket already dead
      }
    };
  }

  destroy(): void {
    this.#destroyed = true;
    const ws = this.#ws;
    this.#ws = null;
    this.#stopHeartbeat();
    if (this.#retryId !== undefined) {
      clearTimeout(this.#retryId);
      this.#retryId = undefined;
    }
    document.removeEventListener("visibilitychange", this.#onVisibility);
    try {
      ws?.close();
    } catch {
      // socket already dead
    }
  }

  #dispatch(raw: unknown): void {
    try {
      const msg = JSON.parse(raw as string) as ServerMessage;
      if (msg.type === "snapshot") this.applySnapshot(msg.items, msg.hasMore);
      else if (msg.type === "upsert") {
        this.upsert(msg.item);
        // new content from another device: creation (not an edit), not ours
        if (!this.#local.has(msg.item.id) && msg.item.createdAt === msg.item.updatedAt) {
          this.#onRemote?.(msg.item);
        }
      } else if (msg.type === "remove") this.remove(msg.ids);
    } catch {
      // malformed message; ignore
    }
  }

  #startHeartbeat(): void {
    this.#stopHeartbeat();
    this.#pongAt = Date.now();
    this.#heartbeatId = setInterval(() => {
      const ws = this.#ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const sentAt = Date.now();
      ws.send(WS_PING);
      clearTimeout(this.#watchdogId);
      this.#watchdogId = setTimeout(() => {
        this.#watchdogId = undefined;
        if (this.#pongAt < sentAt) {
          try {
            ws.close();
          } catch {
            // socket already dead
          }
        }
      }, 10_000);
    }, 25_000);
  }

  #stopHeartbeat(): void {
    if (this.#heartbeatId !== undefined) {
      clearInterval(this.#heartbeatId);
      this.#heartbeatId = undefined;
    }
    if (this.#watchdogId !== undefined) {
      clearTimeout(this.#watchdogId);
      this.#watchdogId = undefined;
    }
  }
}
