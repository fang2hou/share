import { handleCallback, loginRedirect, originAllowed, readSession } from "./auth.ts";
import {
  FILENAME_PATTERN,
  ID_PATTERN,
  MAX_BODY_BYTES,
  MAX_FILE_BYTES,
  MAX_TEXT_LENGTH,
  SHARE_TOKEN_PATTERN,
  SUFFIX_PATTERN,
} from "../shared/protocol.ts";
import type { Item } from "../shared/protocol.ts";
import { messages, pickLang, type Lang } from "../shared/i18n.ts";

export { Space } from "./space.ts";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function bodyLength(request: Request): number {
  return Number(request.headers.get("Content-Length") ?? "");
}

/** R2 body → attachment response; shared by the owner download and the public share path */
function fileResponse(obj: R2ObjectBody, item: Item, cacheControl: string): Response {
  const name = item.fileName ?? "download";
  const asciiFallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": cacheControl,
    },
  });
}

async function homepage(request: Request, env: Env): Promise<Response> {
  const session = await readSession(request, env);
  if (!session) return new Response(null, { status: 302, headers: { Location: "/auth/login" } });

  const itemsP = env.SPACE.getByName("gh:" + session.sub).list();
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
  if (!shell.ok) return shell;

  const transformed = new HTMLRewriter()
    .on("head", {
      async element(el) {
        try {
          const page = await itemsP;
          el.append(
            '<script id="bootstrap" type="application/json">' +
              JSON.stringify({ items: page.items, hasMore: page.hasMore }).replaceAll(
                "<",
                "\\u003c",
              ) +
              "</script>",
            { html: true },
          );
        } catch {
          console.error(JSON.stringify({ event: "bootstrap_failed" }));
        }
      },
    })
    .transform(shell);

  const headers = new Headers(transformed.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.delete("etag");
  return new Response(transformed.body, { status: transformed.status, headers });
}

function validateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
  return text;
}

function validateFilename(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return false;
  const name = value.trim();
  return FILENAME_PATTERN.test(name) ? name : false;
}

function validateSuffix(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return false;
  const suffix = value.trim().toLowerCase();
  return SUFFIX_PATTERN.test(suffix) ? suffix : false;
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const session = await readSession(request, env);
  if (!session) return jsonError("unauthorized", 401);
  const stub = env.SPACE.getByName("gh:" + session.sub);
  const path = url.pathname;

  if (path === "/api/items") {
    if (request.method === "GET") {
      let before: number | undefined;
      const beforeRaw = url.searchParams.get("before");
      if (beforeRaw !== null) {
        before = Number(beforeRaw);
        if (!Number.isFinite(before) || before <= 0) return jsonError("bad_request", 400);
      }
      let limit: number | undefined;
      const limitRaw = url.searchParams.get("limit");
      if (limitRaw !== null) {
        limit = Number(limitRaw);
        if (!Number.isFinite(limit) || limit < 1 || limit > 100)
          return jsonError("bad_request", 400);
      }
      return Response.json(await stub.list(before, limit));
    }
    if (request.method === "POST") {
      if (!originAllowed(request, env)) return jsonError("forbidden", 403);
      const length = bodyLength(request);
      if (!length) return jsonError("length_required", 411);
      if (length > MAX_BODY_BYTES) return jsonError("payload_too_large", 413);
      const body = await readJsonBody(request);
      if (!body || typeof body.id !== "string" || !ID_PATTERN.test(body.id))
        return jsonError("bad_request", 400);
      const text = validateText(body.text);
      if (text === null) return jsonError("bad_request", 400);
      const filename = validateFilename(body.filename);
      if (filename === false) return jsonError("bad_request", 400);
      const suffix = validateSuffix(body.suffix);
      if (suffix === false) return jsonError("bad_request", 400);
      return Response.json(
        { item: await stub.create(body.id, text, filename ?? undefined, suffix ?? undefined) },
        { status: 201 },
      );
    }
    return jsonError("method_not_allowed", 405);
  }

  if (path === "/api/files") {
    if (request.method !== "POST") return jsonError("method_not_allowed", 405);
    if (!originAllowed(request, env)) return jsonError("forbidden", 403);
    const length = bodyLength(request);
    if (!length) return jsonError("length_required", 411);
    if (length > MAX_FILE_BYTES) return jsonError("payload_too_large", 413);
    const id = request.headers.get("x-id") ?? "";
    if (!ID_PATTERN.test(id)) return jsonError("bad_request", 400);
    let fileName = "";
    try {
      fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "").trim();
    } catch {
      fileName = "";
    }
    if (fileName.length === 0 || fileName.length > 255) return jsonError("bad_request", 400);
    const key = "gh:" + session.sub + "/" + id;
    try {
      await env.FILES.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("content-type") ?? "application/octet-stream",
        },
      });
    } catch {
      return jsonError("upload_failed", 500);
    }
    const item = await stub.createFile(id, { fileName, fileSize: length, fileKey: key });
    return Response.json({ item }, { status: 201 });
  }

  const fileMatch = path.match(/^\/api\/files\/([^/]+)$/);
  if (fileMatch) {
    if (request.method !== "GET") return jsonError("method_not_allowed", 405);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site") return jsonError("forbidden", 403);
    const fileId = fileMatch[1];
    if (!fileId || !ID_PATTERN.test(fileId)) return jsonError("bad_request", 400);
    const file = await stub.getFile(fileId);
    if (!file) return jsonError("not_found", 404);
    const obj = await env.FILES.get(file.fileKey);
    if (!obj) return jsonError("not_found", 404);
    return fileResponse(obj, file.item, "private, no-store");
  }

  const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
  if (itemMatch) {
    const itemId = itemMatch[1];
    if (!itemId || !ID_PATTERN.test(itemId)) return jsonError("bad_request", 400);
    if (request.method === "DELETE") {
      if (!originAllowed(request, env)) return jsonError("forbidden", 403);
      const removed = await stub.removeItem(itemId);
      if (!removed) return jsonError("not_found", 404);
      // inline await: when the response returns, the stored bytes are already gone
      if (removed.fileKey !== null) await env.FILES.delete(removed.fileKey);
      return Response.json({ ok: true });
    }
    if (request.method === "PATCH") {
      if (!originAllowed(request, env)) return jsonError("forbidden", 403);
      const length = bodyLength(request);
      if (!length) return jsonError("length_required", 411);
      if (length > MAX_BODY_BYTES) return jsonError("payload_too_large", 413);
      const body = await readJsonBody(request);
      if (!body) return jsonError("bad_request", 400);
      const text = validateText(body.text);
      if (text === null) return jsonError("bad_request", 400);
      const item = await stub.update(itemId, text);
      if (item === null) return jsonError("not_found", 404);
      return Response.json({ item });
    }
    return jsonError("method_not_allowed", 405);
  }

  const shareMatch = path.match(/^\/api\/items\/([^/]+)\/share$/);
  if (shareMatch) {
    if (request.method !== "POST") return jsonError("method_not_allowed", 405);
    const shareId = shareMatch[1];
    if (!shareId || !ID_PATTERN.test(shareId)) return jsonError("bad_request", 400);
    if (!originAllowed(request, env)) return jsonError("forbidden", 403);
    const body = await readJsonBody(request);
    if (!body || typeof body.active !== "boolean") return jsonError("bad_request", 400);
    let max: number | null = null;
    if (body.maxDownloads !== null && body.maxDownloads !== undefined) {
      if (
        typeof body.maxDownloads !== "number" ||
        !Number.isInteger(body.maxDownloads) ||
        body.maxDownloads < 1 ||
        body.maxDownloads > 1_000_000
      ) {
        return jsonError("bad_request", 400);
      }
      max = body.maxDownloads;
    }
    const item = await stub.setShare(shareId, { active: body.active, maxDownloads: max });
    if (item === null) return jsonError("not_found", 404);
    return Response.json({ item });
  }

  if (path === "/api/ws") {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return jsonError("upgrade_required", 426);
    if (!originAllowed(request, env)) return jsonError("forbidden", 403);
    return stub.fetch(request);
  }

  return jsonError("not_found", 404);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function requestLang(request: Request): Lang {
  const tags = (request.headers.get("Accept-Language") ?? "")
    .split(",")
    .map((t) => (t.split(";")[0] ?? "").trim())
    .filter(Boolean);
  return pickLang(tags);
}

// public share view: no session; the 128-bit token in the path IS the capability
async function publicShare(
  request: Request,
  env: Env,
  sub: string,
  token: string,
): Promise<Response> {
  if (!/^\d+$/.test(sub) || !SHARE_TOKEN_PATTERN.test(token)) {
    return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const result = await env.SPACE.getByName("gh:" + sub).accessShared(token);
  // uniform 404 for missing, disabled, wrong token, and exhausted budget alike — no enumeration oracle
  if (result === null || result.exhausted) {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }
  const { item } = result;
  if (item.kind === "file") {
    if (result.fileKey === null)
      return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
    const obj = await env.FILES.get(result.fileKey);
    if (!obj)
      return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
    const res = fileResponse(obj, item, "no-store");
    res.headers.set("x-robots-tag", "noindex");
    return res;
  }
  const lang = requestLang(request);
  const m = messages[lang];
  // preview card: first line as the title, a longer slice as the description
  const firstLine = item.text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const title =
    firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine || m.shareViewTitle;
  const summary = item.text.replaceAll(/\s+/g, " ").trim();
  const description =
    (summary.length > 200 ? summary.slice(0, 197) + "…" : summary) || m.shareViewTitle;
  const origin = new URL(request.url).origin;
  const html =
    '<!doctype html><html lang="' +
    lang +
    '"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>' +
    escapeHtml(title) +
    " — share</title>" +
    '<meta name="description" content="' +
    escapeHtml(description) +
    '">' +
    '<meta property="og:title" content="' +
    escapeHtml(title) +
    '"><meta property="og:description" content="' +
    escapeHtml(description) +
    '"><meta property="og:type" content="website"><meta property="og:site_name" content="share">' +
    '<meta property="og:url" content="' +
    escapeHtml(request.url) +
    '"><meta property="og:image" content="' +
    origin +
    '/og.png"><meta name="twitter:card" content="summary_large_image">' +
    "<style>body{font-family:system-ui,sans-serif;background:#faf7f2;color:#292524;margin:0;padding:2rem}" +
    "main{max-width:48rem;margin:0 auto;background:#fff;border-radius:1rem;padding:1.5rem;box-shadow:0 1px 2px rgb(0 0 0/.06)}" +
    "pre{white-space:pre-wrap;word-break:break-word;font:inherit;line-height:1.6;margin:0 0 1rem}" +
    "button{border:0;border-radius:.75rem;background:#1c1917;color:#fff;font-size:1rem;font-weight:600;padding:.75rem 2rem;cursor:pointer}" +
    "button.ok{background:#059669}</style>" +
    "<main><pre>" +
    escapeHtml(item.text) +
    '</pre><button onclick="n=1">' +
    escapeHtml(m.copy) +
    "</button></main>" +
    '<script>document.querySelector("button").onclick=async function(){try{await navigator.clipboard.writeText(document.querySelector("pre").textContent);' +
    "this.textContent='" +
    m.copied +
    "';this.className='ok'}catch(e){}}<" +
    "/script>";
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/" && request.method === "GET") return homepage(request, env);
    const sharePath = path.match(/^\/f\/(\d+)\.([A-Za-z0-9_-]{22,43})$/);
    if (
      sharePath &&
      sharePath[1] !== undefined &&
      sharePath[2] !== undefined &&
      request.method === "GET"
    )
      return publicShare(request, env, sharePath[1], sharePath[2]);
    if (path === "/auth/login" && request.method === "GET") return loginRedirect(request, env);
    if (path === "/auth/callback" && request.method === "GET") return handleCallback(request, env);
    if (path.startsWith("/api/")) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
