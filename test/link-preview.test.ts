import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signSession } from "../worker/auth.ts";
import { shareImageSvg } from "../worker/share-image.ts";
import type { Item } from "../shared/protocol.ts";

const BASE = "http://example.com";
const BOT = "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";

async function owner(sub: string): Promise<string> {
  return "ts_session=" + (await signSession(env.SESSION_SECRET, { sub, login: "preview-fixture" }));
}

async function enable(cookie: string, id: string, password: string | null = null): Promise<string> {
  const response = await SELF.fetch(`${BASE}/api/items/${id}/share`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: BASE },
    body: JSON.stringify({ active: true, password, maxDownloads: 1 }),
  });
  expect(response.status).toBe(200);
  const { item } = await response.json<{ item: Item }>();
  return BASE + item.share!.url;
}

async function upload(cookie: string, name: string, collection?: string): Promise<string> {
  const id = crypto.randomUUID();
  const response = await SELF.fetch(BASE + "/api/files", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: BASE,
      "x-id": id,
      "x-file-name": encodeURIComponent(name),
      "content-type": "application/pdf",
      ...(collection ? { "x-collection-id": collection } : {}),
    },
    body: "file-fixture",
  });
  expect(response.status).toBe(201);
  return collection ?? id;
}

describe("Discord link previews", () => {
  it("serves the existing website card without exposing signed-in bootstrap data", async () => {
    const cookie = await owner("preview-home");
    for (const headers of [
      new Headers({ "User-Agent": BOT }),
      new Headers({ "User-Agent": BOT, Cookie: cookie }),
    ]) {
      const response = await SELF.fetch(BASE + "/", { headers, redirect: "manual" });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const html = await response.text();
      expect(html).toContain('property="og:title" content="share."');
      expect(html).toContain('property="og:image" content="https://share.fang2hou.com/og.png"');
      expect(html).not.toContain('id="bootstrap"');
    }
    expect((await SELF.fetch(BASE + "/", { redirect: "manual" })).status).toBe(302);
  });

  it("previews a legacy single file and generates a real PNG without consuming its download", async () => {
    const cookie = await owner("2010");
    const id = await upload(cookie, '报告 & "notes".pdf');
    const url = await enable(cookie, id);
    for (const suffix of ["", "/og.png"]) {
      const head = await SELF.fetch(url + suffix, {
        method: "HEAD",
        headers: { "User-Agent": BOT },
      });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
    }
    for (const suffix of ["/zip", `/files/${id}`])
      expect(
        (await SELF.fetch(url + suffix, { method: "HEAD", headers: { "User-Agent": BOT } })).status,
      ).toBe(404);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await SELF.fetch(url + "?view=1&ignored=fixture", {
        headers: { "User-Agent": BOT },
      });
      const html = await response.text();
      expect(html).toContain('property="og:title" content="报告 &amp; &quot;notes&quot;.pdf"');
      expect(html).toContain("PDF · 1 KB");
      expect(html).toContain(`property="og:url" content="${url}"`);
      expect(html).toContain(`property="og:image" content="${url}/og.png?lang=en"`);
    }
    const card = await SELF.fetch(url + "/og.png?lang=ja");
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/png");
    expect(card.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await card.arrayBuffer());
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const png = new DataView(bytes.buffer);
    expect(png.getUint32(16)).toBe(1200);
    expect(png.getUint32(20)).toBe(630);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    const download = await SELF.fetch(url);
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(new TextDecoder().decode(await download.arrayBuffer())).toBe("file-fixture");
    for (const suffix of ["", "/og.png", "?view=1"])
      expect((await SELF.fetch(url + suffix, { headers: { "User-Agent": BOT } })).status).toBe(404);
  });

  it("shows localized collection counts, total size and file names", async () => {
    const cookie = await owner("2011");
    const collection = crypto.randomUUID();
    await upload(cookie, "design.pdf", collection);
    await upload(cookie, "자료.pdf", collection);
    const url = await enable(cookie, collection);
    for (const [lang, title] of [
      ["zh-CN", "2 个文件"],
      ["zh-TW", "2 個檔案"],
      ["ja", "ファイル 2 件"],
      ["ko", "파일 2개"],
      ["en", "2 files"],
    ]) {
      const html = await (
        await SELF.fetch(url, { headers: { "User-Agent": BOT, "Accept-Language": lang! } })
      ).text();
      expect(html).toContain(`property="og:title" content="${title}"`);
      expect(html).toContain("1 KB · design.pdf · 자료.pdf");
      expect(html).toContain(`/og.png?lang=${lang}`);
    }
    const card = await SELF.fetch(url + "/og.png?lang=ko");
    expect(card.status).toBe(200);
    await card.arrayBuffer();
    expect((await SELF.fetch(url + "/zip")).status).toBe(200);
    expect((await SELF.fetch(url + "/og.png")).status).toBe(404);
  });

  it("keeps password-protected names out of public cards, even with an unlock cookie", async () => {
    const cookie = await owner("2012");
    const id = await upload(cookie, "private-filename.pdf");
    const url = await enable(cookie, id, "Fixture-secret-2012");
    const html = await (await SELF.fetch(url, { headers: { "User-Agent": BOT } })).text();
    expect(html).toContain('property="og:title" content="Password protected"');
    expect(html).toContain(`property="og:image" content="${BASE}/og.png"`);
    expect(html).not.toContain("private-filename");
    expect((await SELF.fetch(url + "/og.png")).status).toBe(404);
    const unlocked = await SELF.fetch(url + "/unlock", {
      method: "POST",
      headers: { Origin: BASE },
      body: new URLSearchParams({ password: "Fixture-secret-2012" }),
      redirect: "manual",
    });
    const grant = unlocked.headers.get("set-cookie")!.split(";")[0]!;
    const botHtml = await (
      await SELF.fetch(url, { headers: { Cookie: grant, "User-Agent": BOT } })
    ).text();
    expect(botHtml).not.toContain("private-filename");
    expect(botHtml).toContain('property="og:title" content="Password protected"');
    expect((await SELF.fetch(url + "/og.png", { headers: { Cookie: grant } })).status).toBe(404);
  });

  it("does not consume text accesses and rejects revoked cards", async () => {
    const cookie = await owner("2013");
    const id = crypto.randomUUID();
    expect(
      (
        await SELF.fetch(BASE + "/api/items", {
          method: "POST",
          headers: { Cookie: cookie, Origin: BASE },
          body: JSON.stringify({ id, text: "public text fixture" }),
        })
      ).status,
    ).toBe(201);
    const url = await enable(cookie, id);
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await SELF.fetch(url, { headers: { "User-Agent": BOT } })).status).toBe(200);
    expect((await SELF.fetch(url)).status).toBe(200);
    expect((await SELF.fetch(url, { headers: { "User-Agent": BOT } })).status).toBe(404);
    const file = await upload(cookie, "revoked.pdf");
    const fileUrl = await enable(cookie, file);
    await SELF.fetch(`${BASE}/api/items/${file}/share`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: BASE },
      body: JSON.stringify({ active: false }),
    });
    for (const suffix of ["", "/og.png"])
      expect((await SELF.fetch(fileUrl + suffix, { headers: { "User-Agent": BOT } })).status).toBe(
        404,
      );
  });

  it("escapes XML and bounds long multilingual names in the image layout", () => {
    const svg = shareImageSvg({
      kind: "files",
      lang: "en",
      path: "/fixture",
      url: BASE + "/fixture",
      image: "",
      files: [
        {
          id: "fixture",
          name: '<script>"报告資料자료"&'.repeat(30) + ".pdf",
          size: 4096,
          type: "application/pdf",
        },
      ],
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;");
    expect(svg).toContain("…");
    expect(svg).toContain("#faf7f2");
    expect(svg).toContain("#ea580c");
    expect(svg.length).toBeLessThan(2000);
  });
});
