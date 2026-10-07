import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { signSession } from "../worker/auth.ts";
import { Space } from "../worker/space.ts";
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

describe("password sharing and file collections", () => {
  async function share(
    cookie: string,
    id: string,
    password: string | null,
    maxDownloads: number | null = null,
  ): Promise<Item> {
    const res = await SELF.fetch(BASE + `/api/items/${id}/share`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ active: true, password, maxDownloads }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    if (password) expect(body).not.toContain(password);
    return (JSON.parse(body) as CreatedItem).item;
  }

  async function unlock(url: string, password: string, origin = ORIGIN): Promise<Response> {
    return SELF.fetch(url + "/unlock", {
      method: "POST",
      redirect: "manual",
      headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password }).toString(),
    });
  }

  async function upload(
    cookie: string,
    collection: string,
    id: string,
    name: string,
    bytes: string,
    type = "text/plain",
  ): Promise<Item> {
    const res = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "x-id": id,
        "x-file-name": encodeURIComponent(name),
        "x-collection-id": collection,
        "content-type": type,
      },
      body: bytes,
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as CreatedItem).item;
  }

  it("keeps protected content private and invalidates grants when the password changes", async () => {
    const cookie = await sessionCookie("991");
    const id = crypto.randomUUID();
    await postItem(cookie, id, "confidential-text-991");
    const item = await share(cookie, id, "First-secret-991");
    expect(item.share?.passwordProtected).toBe(true);
    const url = BASE + item.share!.url;
    const challenge = await SELF.fetch(url, { headers: { "Accept-Language": "ja" } });
    const html = await challenge.text();
    expect(html).toContain('lang="ja"');
    expect(html).not.toContain("confidential-text-991");
    expect(html).not.toContain("First-secret-991");
    expect((await unlock(url, "wrong-password")).status).toBe(404);
    expect((await unlock(url, "First-secret-991", "https://evil.example")).status).toBe(404);
    const grant = await unlock(url, "First-secret-991");
    expect(grant.status).toBe(303);
    expect(grant.headers.get("Set-Cookie")).toContain("HttpOnly; SameSite=Lax");
    const accessCookie = grant.headers.get("Set-Cookie")!.split(";")[0]!;
    expect(await (await SELF.fetch(url, { headers: { Cookie: accessCookie } })).text()).toContain(
      "confidential-text-991",
    );
    const otherId = crypto.randomUUID();
    await postItem(cookie, otherId, "another-protected-share");
    const otherShare = await share(cookie, otherId, "First-secret-991");
    expect(
      await (
        await SELF.fetch(BASE + otherShare.share!.url, { headers: { Cookie: accessCookie } })
      ).text(),
    ).not.toContain("another-protected-share");
    const tampered = accessCookie.slice(0, -1) + (accessCookie.endsWith("0") ? "1" : "0");
    expect(await (await SELF.fetch(url, { headers: { Cookie: tampered } })).text()).not.toContain(
      "confidential-text-991",
    );
    await share(cookie, id, "Second-secret-991");
    expect(
      await (await SELF.fetch(url, { headers: { Cookie: accessCookie } })).text(),
    ).not.toContain("confidential-text-991");
    expect((await unlock(url, "First-secret-991")).status).toBe(404);
    const second = await unlock(url, "Second-secret-991");
    expect(second.status).toBe(303);
    await SELF.fetch(BASE + `/api/items/${id}/share`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ active: false }),
    });
    expect(
      (
        await SELF.fetch(url, {
          headers: { Cookie: second.headers.get("Set-Cookie")!.split(";")[0]! },
        })
      ).status,
    ).toBe(404);
  });

  it("persists an unlock attempt limit without charging the download budget", async () => {
    const cookie = await sessionCookie("992");
    const id = crypto.randomUUID();
    await postItem(cookie, id, "attempt-limit-content");
    const item = await share(cookie, id, "Actual-secret-992", 1);
    const url = BASE + item.share!.url;
    for (let i = 0; i < 10; i++) expect((await unlock(url, "wrong-password")).status).toBe(404);
    expect((await unlock(url, "Actual-secret-992")).status).toBe(404);
    await runInDurableObject(env.SPACE.getByName("gh:992"), (instance, state) => {
      const row = state.storage.sql
        .exec<{ share_downloads: number; share_attempts: number; share_password_hash: string }>(
          "SELECT share_downloads, share_attempts, share_password_hash FROM items WHERE id = ?",
          id,
        )
        .one();
      expect(row.share_downloads).toBe(0);
      expect(row.share_attempts).toBe(10);
      expect(row.share_password_hash).not.toContain("Actual-secret-992");
      expect(row.share_password_hash).toMatch(/^[a-f0-9]{32}\.[a-f0-9]{64}$/);
      state.storage.sql.exec(
        "UPDATE items SET share_attempt_at = ? WHERE id = ?",
        Date.now() - 61_000,
        id,
      );
      expect(instance.list().items[0]?.share?.downloads).toBe(0);
    });
    expect((await unlock(url, "Actual-secret-992")).status).toBe(303);
  });

  it("uploads members independently, retries without duplicates, selects ZIP entries, and deletes all bytes", async () => {
    const cookie = await sessionCookie("993");
    const other = await sessionCookie("994");
    const collection = crypto.randomUUID();
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await upload(cookie, collection, first, "same.txt", "first-bytes");
    const item = await upload(cookie, collection, second, "same.txt", "second-bytes");
    const retry = await upload(cookie, collection, second, "same.txt", "second-bytes");
    expect(retry.files).toHaveLength(2);
    await upload(cookie, collection, second, "renamed.txt", "changed-byte-count");
    expect(item.fileSize).toBe(23);
    expect(
      await (
        await SELF.fetch(BASE + `/api/files/${collection}/${first}`, {
          headers: { Cookie: cookie },
        })
      ).text(),
    ).toBe("first-bytes");
    const archive = await SELF.fetch(BASE + `/api/files/${collection}/zip`, {
      headers: { Cookie: cookie },
    });
    expect(archive.headers.get("Content-Type")).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(["same.txt", "2-same.txt"]);
    expect(new TextDecoder().decode(entries["2-same.txt"])).toBe("second-bytes");
    const selected = await SELF.fetch(BASE + `/api/files/${collection}/zip?ids=${second}`, {
      headers: { Cookie: cookie },
    });
    const selectedEntries = unzipSync(new Uint8Array(await selected.arrayBuffer()));
    expect(Object.keys(selectedEntries)).toEqual(["same.txt"]);
    expect(new TextDecoder().decode(selectedEntries["same.txt"])).toBe("second-bytes");
    expect(
      (
        await SELF.fetch(BASE + `/api/files/${collection}/zip?ids=${crypto.randomUUID()}`, {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(400);
    for (const suffix of [first, "zip"])
      expect(
        (
          await SELF.fetch(BASE + `/api/files/${collection}/${suffix}`, {
            headers: { Cookie: other },
          })
        ).status,
      ).toBe(404);
    const removed = await SELF.fetch(BASE + `/api/items/${collection}`, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(removed.status).toBe(200);
    expect(await env.FILES.get(`gh:993/${first}`)).toBeNull();
    expect(await env.FILES.get(`gh:993/${second}`)).toBeNull();
  });

  it("requires a scoped grant for previews and ZIPs and charges only successful transfers", async () => {
    const cookie = await sessionCookie("995");
    const collection = crypto.randomUUID();
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await upload(
      cookie,
      collection,
      first,
      "private.html",
      "<script>alert(1)</script>",
      "text/html",
    );
    await upload(cookie, collection, second, "private.txt", "private-file-bytes");
    const item = await share(cookie, collection, "Collection-secret-995", 2);
    const url = BASE + item.share!.url;
    expect(await (await SELF.fetch(url)).text()).not.toContain("private.html");
    for (const suffix of [`/files/${first}`, `/files/${first}?preview=1`, "/zip"])
      expect((await SELF.fetch(url + suffix)).status).toBe(404);
    const grant = await unlock(url, "Collection-secret-995");
    const accessCookie = grant.headers.get("Set-Cookie")!.split(";")[0]!;
    const headers = { Cookie: accessCookie };
    const page = await SELF.fetch(url, { headers });
    expect(await page.text()).toContain("private.html");
    expect((await SELF.fetch(url + `/files/${crypto.randomUUID()}`, { headers })).status).toBe(404);
    expect((await SELF.fetch(url + "/zip?ids=", { headers })).status).toBe(404);
    const preview = await SELF.fetch(url + `/files/${first}?preview=1`, { headers });
    expect(preview.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(preview.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(await preview.text()).toBe("<script>alert(1)</script>");
    const zip = await SELF.fetch(url + `/zip?ids=${second}`, { headers });
    expect(
      new TextDecoder().decode(unzipSync(new Uint8Array(await zip.arrayBuffer()))["private.txt"]),
    ).toBe("private-file-bytes");
    expect((await SELF.fetch(url + `/files/${second}`, { headers })).status).toBe(404);
    const listed = (await (
      await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(listed.items[0]?.share?.downloads).toBe(2);
  });

  it("keeps link-only collections available and rejects collection collisions with text items", async () => {
    const cookie = await sessionCookie("996");
    const collection = crypto.randomUUID();
    const file = crypto.randomUUID();
    await upload(cookie, collection, file, "open.txt", "open-bytes");
    const item = await share(cookie, collection, null);
    expect(item.share?.passwordProtected).toBe(false);
    const url = BASE + item.share!.url;
    expect(await (await SELF.fetch(url)).text()).toContain("open.txt");
    expect(await (await SELF.fetch(url + `/files/${file}`)).text()).toBe("open-bytes");
    const textId = crypto.randomUUID();
    await postItem(cookie, textId, "retain-text");
    const rejected = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "x-id": crypto.randomUUID(),
        "x-collection-id": textId,
        "x-file-name": "collision.txt",
      },
      body: "file-bytes",
    });
    expect(rejected.status).toBe(400);
    const listed = (await (
      await SELF.fetch(BASE + "/api/items", { headers: { Cookie: cookie } })
    ).json()) as ItemList;
    expect(listed.items.find((i) => i.id === textId)?.text).toBe("retain-text");
  });
});

describe("file preview compatibility", () => {
  it("serves byte ranges and prevents active documents from executing", async () => {
    const cookie = await sessionCookie("997");
    const id = crypto.randomUUID();
    const put = await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "x-id": id,
        "x-file-name": "media.mp4",
        "content-type": "video/mp4",
      },
      body: "0123456789",
    });
    expect(put.status).toBe(201);
    const range = await SELF.fetch(BASE + `/api/files/${id}?preview=1`, {
      headers: { Cookie: cookie, Range: "bytes=2-5" },
    });
    expect(range.status).toBe(206);
    expect(range.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(range.headers.get("Accept-Ranges")).toBe("bytes");
    expect(new TextDecoder().decode(await range.arrayBuffer())).toBe("2345");
    const tail = await SELF.fetch(BASE + `/api/files/${id}`, {
      headers: { Cookie: cookie, Range: "bytes=-3" },
    });
    expect(new TextDecoder().decode(await tail.arrayBuffer())).toBe("789");
    const invalid = await SELF.fetch(BASE + `/api/files/${id}`, {
      headers: { Cookie: cookie, Range: "bytes=100-" },
    });
    expect(invalid.status).toBe(404);
    const svgId = crypto.randomUUID();
    await SELF.fetch(BASE + "/api/files", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "x-id": svgId,
        "x-file-name": "unsafe.svg",
        "content-type": "image/svg+xml",
      },
      body: '<svg onload="alert(1)"></svg>',
    });
    const svg = await SELF.fetch(BASE + `/api/files/${svgId}?preview=1`, {
      headers: { Cookie: cookie },
    });
    expect(svg.headers.get("Content-Disposition")).toContain("attachment;");
    expect(svg.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps member storage separate from other collections and standalone items", async () => {
    const cookie = await sessionCookie("998");
    const firstCollection = crypto.randomUUID();
    const secondCollection = crypto.randomUUID();
    const id = crypto.randomUUID();
    const headers = {
      Cookie: cookie,
      Origin: ORIGIN,
      "x-id": id,
      "x-file-name": "original.txt",
      "x-collection-id": firstCollection,
    };
    expect(
      (await SELF.fetch(BASE + "/api/files", { method: "POST", headers, body: "original" })).status,
    ).toBe(201);
    expect(
      (
        await SELF.fetch(BASE + "/api/files", {
          method: "POST",
          headers: { ...headers, "x-collection-id": secondCollection },
          body: "replaced",
        })
      ).status,
    ).toBe(400);
    const singleHeaders = {
      Cookie: cookie,
      Origin: ORIGIN,
      "x-id": id,
      "x-file-name": "original.txt",
    };
    expect(
      (
        await SELF.fetch(BASE + "/api/files", {
          method: "POST",
          headers: singleHeaders,
          body: "replaced",
        })
      ).status,
    ).toBe(400);
    expect(
      await (
        await SELF.fetch(BASE + `/api/files/${firstCollection}/${id}`, {
          headers: { Cookie: cookie },
        })
      ).text(),
    ).toBe("original");
  });
});

it("applies additive schema migrations repeatedly without losing existing records", async () => {
  const stub = env.SPACE.getByName("gh:999");
  const id = crypto.randomUUID();
  await stub.create(id, "preserve-existing-record", "record", "txt");
  await runInDurableObject(stub, (_instance, state) => {
    const first = new Space(state, env);
    const second = new Space(state, env);
    expect(first.list().items[0]?.text).toBe("preserve-existing-record");
    expect(second.list().items[0]?.filename).toBe("record");
    const row = state.storage.sql
      .exec<{
        files_json: string | null;
        share_password_hash: string | null;
        share_attempts: number;
      }>("SELECT files_json, share_password_hash, share_attempts FROM items WHERE id = ?", id)
      .one();
    expect(row).toEqual({ files_json: null, share_password_hash: null, share_attempts: 0 });
  });
});
