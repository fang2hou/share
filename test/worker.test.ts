import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signSession } from "../worker/auth.ts";
import type { Item, ServerMessage } from "../shared/protocol.ts";

const BASE = "http://example.com";
const ORIGIN = BASE;

type ItemList = { items: Item[]; hasMore: boolean };
type CreatedItem = { item: Item };
type MessageCollector = { next: () => Promise<ServerMessage> };

async function sessionCookie(sub: string, nowSec?: number): Promise<string> {
  const token = await signSession(env.SESSION_SECRET, { sub, login: "t-" + sub }, nowSec);
  return "ts_session=" + token;
}

function collector(ws: WebSocket): MessageCollector {
  const buffered: ServerMessage[] = [];
  const waiters: ((m: ServerMessage) => void)[] = [];
  ws.addEventListener("message", (e) => {
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
    },
  };
}

async function connectWs(cookie: string): Promise<{ ws: WebSocket; messages: MessageCollector }> {
  const res = await SELF.fetch(BASE + "/api/ws", {
    headers: { Cookie: cookie, Origin: ORIGIN, Upgrade: "websocket", Connection: "Upgrade" },
  });
  if (res.status !== 101) throw new Error("ws upgrade failed: " + res.status);
  const ws = res.webSocket as WebSocket;
  ws.accept();
  return { ws, messages: collector(ws) };
}

async function postItem(cookie: string, id: string, text: string): Promise<Response> {
  return SELF.fetch(BASE + "/api/items", {
    method: "POST",
    headers: { Cookie: cookie, Origin: ORIGIN },
    body: JSON.stringify({ id, text }),
  });
}

describe("auth", () => {
  it("rejects missing, tampered, and expired sessions", async () => {
    const missing = await SELF.fetch(BASE + "/api/items");
    expect(missing.status).toBe(401);

    const token = await signSession(env.SESSION_SECRET, { sub: "1", login: "t" });
    const dot = token.lastIndexOf(".");
    const sig = token.slice(dot + 1);
    const flipped = (sig.startsWith("A") ? "B" : "A") + sig.slice(1);
    const tampered = token.slice(0, dot + 1) + flipped;
    const tamperedRes = await SELF.fetch(BASE + "/api/items", {
      headers: { Cookie: "ts_session=" + tampered },
    });
    expect(tamperedRes.status).toBe(401);

    const expiredToken = await signSession(
      env.SESSION_SECRET,
      { sub: "1", login: "t" },
      Math.floor(Date.now() / 1000) - 30 * 24 * 3600 - 60,
    );
    const expiredRes = await SELF.fetch(BASE + "/api/items", {
      headers: { Cookie: "ts_session=" + expiredToken },
    });
    expect(expiredRes.status).toBe(401);
  });
});

describe("items api", () => {
  it("creates, lists, and is idempotent on duplicate ids", async () => {
    const cookie = await sessionCookie("2");
    const id = crypto.randomUUID();
    const post = await postItem(cookie, id, "hello world");
    expect(post.status).toBe(201);
    const created = (await post.json()) as CreatedItem;
    expect(created.item.text).toBe("hello world");

    const again = await postItem(cookie, id, "hello world");
    expect(again.status).toBe(201);

    const listRes = await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } });
    const list = (await listRes.json()) as ItemList;
    expect(list.items.map((i) => i.id)).toEqual([id]);
  });

  it("stores optional filename and suffix, and validates them", async () => {
    const cookie = await sessionCookie("2");
    const id = crypto.randomUUID();
    const post = await SELF.fetch(BASE + "/api/items", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ id, text: "int main() {}", filename: "demo", suffix: "CPP" }),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as CreatedItem;
    expect(created.item.filename).toBe("demo");
    expect(created.item.suffix).toBe("cpp"); // normalized to lowercase

    const badSuffix = await SELF.fetch(BASE + "/api/items", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ id: crypto.randomUUID(), text: "x", suffix: "../etc" }),
    });
    expect(badSuffix.status).toBe(400);

    const badFilename = await SELF.fetch(BASE + "/api/items", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ id: crypto.randomUUID(), text: "x", filename: "a/b" }),
    });
    expect(badFilename.status).toBe(400);

    const suffixOnly = await postItem(cookie, crypto.randomUUID(), "print('hi')");
    expect(suffixOnly.status).toBe(201);

    // PATCH rewrites meta: absent keys keep the stored value, null clears
    const patchRes = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "int main() { return 0; }" }),
    });
    expect(patchRes.status).toBe(200);
    const kept = (await patchRes.json()) as CreatedItem;
    expect(kept.item.filename).toBe("demo");
    expect(kept.item.suffix).toBe("cpp");

    const patchMeta = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "int main() { return 0; }",
        filename: "renamed",
        suffix: "cc",
      }),
    });
    expect(patchMeta.status).toBe(200);
    const renamed = (await patchMeta.json()) as CreatedItem;
    expect(renamed.item.filename).toBe("renamed");
    expect(renamed.item.suffix).toBe("cc");

    const patchClear = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "plain now", filename: null, suffix: null }),
    });
    expect(patchClear.status).toBe(200);
    const cleared = (await patchClear.json()) as CreatedItem;
    expect(cleared.item.filename).toBeUndefined();
    expect(cleared.item.suffix).toBeUndefined();

    const patchBad = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x", filename: "a\\b" }),
    });
    expect(patchBad.status).toBe(400);
  });

  it("paginates with a created-at cursor", async () => {
    const cookie = await sessionCookie("3");
    // controlled timestamps: page-item-0 newest, page-item-2 oldest
    const base = Date.now() - 100_000;
    for (let i = 0; i < 3; i++) {
      await runInDurableObject(env.SPACE.getByName("gh:3"), (_instance, state) => {
        state.storage.sql.exec(
          "INSERT INTO items (id, text, created_at, updated_at, kind) VALUES (?, ?, ?, ?, 'text')",
          "page-item-" + i,
          "p" + i,
          base - i * 1000,
          base - i * 1000,
        );
      });
    }

    const first = (await (
      await SELF.fetch(BASE + "/api/items?limit=2", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(first.items.map((i) => i.id)).toEqual(["page-item-0", "page-item-1"]);
    expect(first.hasMore).toBe(true);

    const cursor = first.items[1]?.createdAt;
    const second = (await (
      await SELF.fetch(BASE + "/api/items?limit=2&before=" + cursor, {
        headers: { Cookie: cookie },
      })
    ).json()) as ItemList;
    expect(second.items.map((i) => i.id)).toEqual(["page-item-2"]);
    expect(second.hasMore).toBe(false);

    const bad = await SELF.fetch(BASE + "/api/items?limit=0", { headers: { Cookie: cookie } });
    expect(bad.status).toBe(400);
  });

  it("keeps rows forever and still lists and patches them", async () => {
    const cookie = await sessionCookie("3b");
    const id = crypto.randomUUID();
    await postItem(cookie, id, "v1");
    const old = Date.now() - 40 * 24 * 3600 * 1000;
    await runInDurableObject(env.SPACE.getByName("gh:3b"), (_instance, state) => {
      state.storage.sql.exec("UPDATE items SET created_at = ? WHERE id = ?", old, id);
    });

    const list = (await (
      await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(list.items.map((i) => i.id)).toEqual([id]);

    const patch = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ text: "v2" }),
    });
    expect(patch.status).toBe(200);
  });

  it("updates existing items and broadcasts via websocket", { timeout: 20_000 }, async () => {
    const cookie = await sessionCookie("4a");
    const id = crypto.randomUUID();
    await postItem(cookie, id, "v1");

    const { ws, messages } = await connectWs(cookie);
    await messages.next();

    const patch = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ text: "v2" }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as CreatedItem;
    expect(patched.item.text).toBe("v2");
    expect(patched.item.updatedAt).toBeGreaterThan(patched.item.createdAt);

    const upsertMsg = await messages.next();
    expect(upsertMsg).toEqual({ type: "upsert", item: patched.item });
    ws.close();

    const missing = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID(), {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ text: "x" }),
    });
    expect(missing.status).toBe(404);
  });

  it("isolates users", async () => {
    const cookieA = await sessionCookie("5a");
    const cookieB = await sessionCookie("5b");
    const post = await postItem(cookieA, crypto.randomUUID(), "only for a");
    expect(post.status).toBe(201);

    const listB = await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookieB } });
    const list = (await listB.json()) as ItemList;
    expect(list.items).toEqual([]);
  });

  it("rejects bad origins and blank text", async () => {
    const cookie = await sessionCookie("6");
    const evil = await SELF.fetch(BASE + "/api/items", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "http://evil.example" },
      body: JSON.stringify({ id: crypto.randomUUID(), text: "x" }),
    });
    expect(evil.status).toBe(403);

    const blank = await postItem(cookie, crypto.randomUUID(), "   \n\t ");
    expect(blank.status).toBe(400);
  });
});

describe("homepage", () => {
  it("injects escaped bootstrap data and redirects anonymous visitors", async () => {
    const cookie = await sessionCookie("7");
    await postItem(cookie, crypto.randomUUID(), "</script><b>x");

    const page = await SELF.fetch(BASE + "/", { headers: { Cookie: cookie } });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<script id="bootstrap" type="application/json">');
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("</script><b>");
    expect(page.headers.get("cache-control")).toBe("no-store");

    const anon = await SELF.fetch(BASE + "/", { redirect: "manual" });
    expect(anon.status).toBe(302);
    expect(anon.headers.get("Location")).toBe("/auth/login");
  });
});

describe("share links", () => {
  async function enableShare(
    cookie: string,
    id: string,
    active: boolean,
    maxDownloads: number | null,
  ): Promise<Item> {
    const res = await SELF.fetch(BASE + "/api/items/" + id + "/share", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ active, maxDownloads }),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as CreatedItem).item;
  }

  it(
    "serves a public text view without a session and counts accesses",
    { timeout: 20_000 },
    async () => {
      const cookie = await sessionCookie("91");
      const id = crypto.randomUUID();
      await postItem(cookie, id, "public payload <b>测试</b>");

      const off = await SELF.fetch(BASE + "/f/91.not-the-right-token-at-all-22");
      expect(off.status).toBe(404);

      const enabled = await enableShare(cookie, id, true, null);
      expect(enabled.share?.active).toBe(true);
      expect(enabled.share?.url).toBe("/f/91." + enabled.share?.token);

      const view = await SELF.fetch(BASE + enabled.share!.url!);
      expect(view.status).toBe(200);
      expect(view.headers.get("cache-control")).toBe("no-store");
      const html = await view.text();
      expect(html).toContain("public payload &lt;b&gt;测试&lt;/b&gt;");
      expect(html).not.toContain("<b>测试</b>");
      // preview card: dynamic title/description, attribute-escaped, never indexed
      expect(html).toContain(
        '<meta property="og:title" content="public payload &lt;b&gt;测试&lt;/b&gt;">',
      );
      expect(html).toContain('content="noindex"');
      expect(html).toContain('property="og:image"');
      const after = await enableShare(cookie, id, true, null);
      expect(after.share?.downloads).toBe(1);
    },
  );

  it("enforces the download budget and resets on re-enable", async () => {
    const cookie = await sessionCookie("92");
    const id = crypto.randomUUID();
    await postItem(cookie, id, "budgeted");
    const enabled = await enableShare(cookie, id, true, 2);
    const url = BASE + enabled.share!.url!;

    expect((await SELF.fetch(url)).status).toBe(200);
    expect((await SELF.fetch(url)).status).toBe(200);
    expect((await SELF.fetch(url)).status).toBe(404);

    await enableShare(cookie, id, false, null);
    expect((await SELF.fetch(url)).status).toBe(404);

    const again = await enableShare(cookie, id, true, 5);
    expect(again.share?.downloads).toBe(0);
    expect((await SELF.fetch(url)).status).toBe(200);
  });

  it("publicly downloads a shared file and blocks cross-site authed fetches", async () => {
    const cookie = await sessionCookie("93");
    const id = crypto.randomUUID();
    const put = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "content-type": "text/plain",
        "x-id": id,
        "x-file-name": "pub.txt",
      },
      body: "shared-file-bytes",
    });
    expect(put.status).toBe(201);
    const enabled = await enableShare(cookie, id, true, null);
    const url = BASE + enabled.share!.url!;

    const dl = await SELF.fetch(url);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toContain("pub.txt");
    expect(await dl.text()).toBe("shared-file-bytes");

    const crossSite = await SELF.fetch(BASE + "/api/files/" + id, {
      headers: { Cookie: cookie, "Sec-Fetch-Site": "cross-site" },
    });
    expect(crossSite.status).toBe(403);
  });

  it("guards the share endpoint", async () => {
    const cookie = await sessionCookie("94");
    const evil = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID() + "/share", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "http://evil.example" },
      body: JSON.stringify({ active: true, maxDownloads: null }),
    });
    expect(evil.status).toBe(403);

    const missing = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID() + "/share", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ active: true, maxDownloads: null }),
    });
    expect(missing.status).toBe(404);

    const badBody = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID() + "/share", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ active: "yes" }),
    });
    expect(badBody.status).toBe(400);
  });
});

describe("files api", () => {
  it("uploads, lists, and downloads a file", async () => {
    const cookie = await sessionCookie("f1");
    const id = crypto.randomUUID();
    const bytes = "file-payload-测试-123";
    const res = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "content-type": "text/plain",
        "x-id": id,
        "x-file-name": encodeURIComponent("笔记 note.txt"),
      },
      body: bytes,
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as CreatedItem;
    expect(created.item.kind).toBe("file");
    expect(created.item.fileName).toBe("笔记 note.txt");
    expect(created.item.fileSize).toBe(new TextEncoder().encode(bytes).length);
    expect(created.item.text).toBe("");

    const list = (await (
      await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(list.items.some((i) => i.id === id && i.kind === "file")).toBe(true);

    const dl = await SELF.fetch(BASE + "/api/files/" + id, { headers: { Cookie: cookie } });
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("text/plain");
    expect(dl.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(await dl.text()).toBe(bytes);
  });

  it("broadcasts file items over ws and rejects PATCH on them", async () => {
    const cookie = await sessionCookie("f2");
    const { messages } = await connectWs(cookie);
    const snapshot = await messages.next();
    expect(snapshot.type).toBe("snapshot");

    const id = crypto.randomUUID();
    const res = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "content-type": "application/zip",
        "x-id": id,
        "x-file-name": "pack.zip",
      },
      body: "zip-bytes",
    });
    expect(res.status).toBe(201);
    const upsert = await messages.next();
    expect(upsert.type).toBe("upsert");
    if (upsert.type === "upsert") expect(upsert.item.fileName).toBe("pack.zip");

    const patch = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ text: "nope" }),
    });
    expect(patch.status).toBe(404);
  });

  it("guards file endpoints", async () => {
    const cookie = await sessionCookie("f4");
    const evil = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "http://evil.example",
        "x-id": crypto.randomUUID(),
        "x-file-name": "x",
      },
      body: "x",
    });
    expect(evil.status).toBe(403);

    const get405 = await SELF.fetch(BASE + "/api/files", { headers: { Cookie: cookie } });
    expect(get405.status).toBe(405);

    const badName = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "x-id": crypto.randomUUID(),
        "x-file-name": "%E0%A4%A",
      },
      body: "x",
    });
    expect(badName.status).toBe(400);

    const missing = await SELF.fetch(BASE + "/api/files/" + crypto.randomUUID(), {
      headers: { Cookie: cookie },
    });
    expect(missing.status).toBe(404);
  });
});

describe("delete api", () => {
  it("deletes a text item, broadcasts removal, and 404s on repeat", async () => {
    const cookie = await sessionCookie("d1");
    const { messages } = await connectWs(cookie);
    const snapshot = await messages.next();
    expect(snapshot.type).toBe("snapshot");

    const id = crypto.randomUUID();
    expect((await postItem(cookie, id, "to delete")).status).toBe(201);
    await messages.next(); // upsert

    const res = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    const removed = await messages.next();
    expect(removed).toEqual({ type: "remove", ids: [id] });

    const list = (await (
      await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(list.items.some((i) => i.id === id)).toBe(false);

    const again = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(again.status).toBe(404);
  });

  it("deletes the stored file object behind a file item", async () => {
    const cookie = await sessionCookie("d2");
    const id = crypto.randomUUID();
    const key = "gh:d2/" + id;
    const res = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "content-type": "text/plain",
        "x-id": id,
        "x-file-name": "gone.txt",
      },
      body: "bytes-to-delete",
    });
    expect(res.status).toBe(201);
    expect(await env.FILES.head(key)).not.toBeNull();

    const del = await SELF.fetch(BASE + "/api/items/" + id, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(del.status).toBe(200);
    expect(await env.FILES.head(key)).toBeNull();

    const dl = await SELF.fetch(BASE + "/api/files/" + id, { headers: { Cookie: cookie } });
    expect(dl.status).toBe(404);
  });

  it("guards the delete endpoint", async () => {
    const cookie = await sessionCookie("d3");
    const evil = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID(), {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: "http://evil.example" },
    });
    expect(evil.status).toBe(403);

    const unknown = await SELF.fetch(BASE + "/api/items/" + crypto.randomUUID(), {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(unknown.status).toBe(404);
  });
});
