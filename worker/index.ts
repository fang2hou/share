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
import { messages, pickLang, type Lang } from "../shared/i18n.ts";

import { fileResponse, zipResponse, selectedFiles, readFile } from "./file-transfer.ts";
import { fileView, passwordView, publicFiles, textView } from "./share-view.ts";
import { grantCookie, hasGrant } from "./share-password.ts";
import { shareImage } from "./share-image.ts";

import { multipartUpload, registerFile } from "./file-upload.ts";

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

async function homepage(request: Request, env: Env): Promise<Response> {
  if (isLinkPreview(request)) {
    const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
    const headers = new Headers(shell.headers);
    headers.set("cache-control", "no-store");
    headers.delete("etag");
    return new Response(request.method === "HEAD" ? null : shell.body, {
      status: shell.status,
      headers,
    });
  }
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

function isLinkPreview(request: Request): boolean {
  return /(?:^|[\s;(])Discordbot(?:\/|[\s;)]|$)/i.test(request.headers.get("User-Agent") ?? "");
}

function validateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
  return text;
}

// PATCH meta semantics: absent = keep current, null = clear, string = set
function patchMeta(
  value: unknown,
  pattern: RegExp,
  lower: boolean,
): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return false;
  const v = value.trim();
  return pattern.test(v) ? (lower ? v.toLowerCase() : v) : false;
}

function validateFilename(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return false;
  const filename = value.trim();
  return FILENAME_PATTERN.test(filename) ? filename : false;
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

  if (path === "/api/uploads" || path.startsWith("/api/uploads/")) {
    if (!originAllowed(request, env)) return jsonError("forbidden", 403);
    try {
      return await multipartUpload(request, env, session.sub, stub, url);
    } catch {
      return jsonError("upload_failed", 500);
    }
  }

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
    const collectionId = request.headers.get("x-collection-id");
    if (
      collectionId !== null &&
      (!ID_PATTERN.test(collectionId) ||
        collectionId === id ||
        !(await stub.collectionCanAccept(collectionId, id)))
    )
      return jsonError("bad_request", 400);
    if (!(await stub.fileCanUpload(id, collectionId ?? undefined)))
      return jsonError("bad_request", 400);
    const key = "gh:" + session.sub + "/" + id;
    let stored: R2Object | null;
    try {
      // File IDs are immutable; retries must never replace bytes already accepted by R2.
      stored = await env.FILES.put(key, request.body, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: {
          contentType: request.headers.get("content-type") ?? "application/octet-stream",
        },
        customMetadata: { itemId: collectionId ?? id, name: encodeURIComponent(fileName) },
      });
      stored ??= await env.FILES.head(key);
    } catch {
      return jsonError("upload_failed", 500);
    }
    if (!stored) return jsonError("upload_failed", 500);
    return registerFile(env, stub, stored, id, fileName, collectionId ?? undefined);
  }

  const fileMatch = path.match(/^\/api\/files\/([^/]+)(?:\/([^/]+))?$/);
  if (fileMatch) {
    if (request.method !== "GET") return jsonError("method_not_allowed", 405);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site") return jsonError("forbidden", 403);
    const fileId = fileMatch[1];
    if (!fileId || !ID_PATTERN.test(fileId)) return jsonError("bad_request", 400);
    const memberId = fileMatch[2];
    if (memberId === "zip") {
      const item = await stub.getItem(fileId);
      if (!item || item.kind !== "file") return jsonError("not_found", 404);
      const files = selectedFiles(publicFiles(item), url.searchParams.get("ids"));
      if (!files) return jsonError("bad_request", 400);
      return zipResponse(env.FILES, session.sub, files);
    }
    if (memberId && !ID_PATTERN.test(memberId)) return jsonError("bad_request", 400);
    const file = await stub.getFile(fileId, memberId);
    if (!file) return jsonError("not_found", 404);
    const obj = await readFile(
      env.FILES,
      file.fileKey,
      request.headers.get("Range"),
      url.searchParams.get("preview") === "1",
    );
    if (!obj) return jsonError("not_found", 404);
    return fileResponse(
      obj,
      file.item,
      "private, no-store",
      url.searchParams.get("preview") === "1",
      request.headers.has("Range"),
    );
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
      const keys = [...removed.fileKeys];
      if (removed.fileKey !== null) keys.push(removed.fileKey);
      if (keys.length) await env.FILES.delete(keys);
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
      const filename = patchMeta(body.filename, FILENAME_PATTERN, false);
      if (filename === false) return jsonError("bad_request", 400);
      const suffix = patchMeta(body.suffix, SUFFIX_PATTERN, true);
      if (suffix === false) return jsonError("bad_request", 400);
      const item = await stub.update(itemId, text, filename, suffix);
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
    if (!bodyLength(request) || bodyLength(request) > MAX_BODY_BYTES)
      return jsonError("bad_request", 400);
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
    const password = body.password;
    if (
      password !== undefined &&
      password !== null &&
      (typeof password !== "string" || password.length < 6 || password.length > 128)
    )
      return jsonError("bad_request", 400);
    const item = await stub.setShare(shareId, {
      active: body.active,
      maxDownloads: max,
      password: password as string | null | undefined,
    });
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

function requestLang(request: Request): Lang {
  const saved = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("ts_lang="))
    ?.slice(8);
  if (saved && Object.hasOwn(messages, saved)) return saved as Lang;
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
  action: string = "",
): Promise<Response> {
  if (!/^\d+$/.test(sub) || !SHARE_TOKEN_PATTERN.test(token)) {
    return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const stub = env.SPACE.getByName("gh:" + sub);
  const path = `/f/${sub}.${token}`;
  const url = new URL(request.url);
  const lang = requestLang(request);
  const notFound = (): Response =>
    new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  if (action === "/unlock") {
    if (
      request.method !== "POST" ||
      !originAllowed(request, env) ||
      bodyLength(request) < 1 ||
      bodyLength(request) > 4096
    )
      return notFound();
    let password: string | File | null;
    try {
      password = (await request.formData()).get("password");
    } catch {
      return notFound();
    }
    if (typeof password !== "string" || password.length < 6 || password.length > 128)
      return notFound();
    const hash = await stub.unlockShared(token, password);
    if (!hash) return notFound();
    const cookie = await grantCookie(env.SESSION_SECRET, path, hash, url.protocol === "https:");
    return request.headers.get("Accept") === "application/json"
      ? Response.json(
          { ok: true },
          { headers: { "set-cookie": cookie, "cache-control": "no-store" } },
        )
      : new Response(null, {
          status: 303,
          headers: {
            "set-cookie": cookie,
            Location: path + "?view=1",
            "cache-control": "no-store",
          },
        });
  }
  if (
    request.method !== "GET" &&
    !(
      request.method === "HEAD" &&
      ((action === "" && isLinkPreview(request)) || action === "/og.png")
    )
  )
    return notFound();
  const info = await stub.inspectShared(token);
  if (!info) return notFound();
  if (action === "/og.png") {
    // Image URLs are public; an unlock cookie must never publish protected metadata.
    if (info.passwordHash || info.item.kind !== "file") return notFound();
    if (request.method === "HEAD")
      return new Response(null, {
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
          "x-content-type-options": "nosniff",
        },
      });
    const imageLang = pickLang([url.searchParams.get("lang") ?? lang]);
    return shareImage(
      {
        kind: "files",
        lang: imageLang,
        path,
        url: url.origin + path,
        image: "",
        files: publicFiles(info.item),
      },
      env.ASSETS,
    );
  }
  if (
    info.passwordHash &&
    (isLinkPreview(request) ||
      !(await hasGrant(request, env.SESSION_SECRET, path, info.passwordHash)))
  ) {
    return action === "" ? passwordView(lang, request.url) : notFound();
  }
  if (info.item.kind === "file") {
    if (
      action === "" &&
      (isLinkPreview(request) ||
        info.item.files ||
        info.passwordHash ||
        url.searchParams.get("view") === "1")
    )
      return fileView(
        lang,
        publicFiles(info.item),
        request.url,
        info.passwordHash ? url.origin + "/og.png" : `${url.origin}${path}/og.png?lang=${lang}`,
      );
    if (action === "/zip") {
      const files = selectedFiles(publicFiles(info.item), url.searchParams.get("ids"));
      if (!files) return notFound();
      const access = await stub.accessShared(token, info.passwordHash);
      if (!access || access.exhausted) return notFound();
      return zipResponse(env.FILES, sub, files);
    }
    const member = action.startsWith("/files/") ? action.slice(7) : undefined;
    if (action && (!member || !ID_PATTERN.test(member))) return notFound();
    const file = await stub.getFile(info.item.id, member);
    if (!file) return notFound();
    const obj = await readFile(
      env.FILES,
      file.fileKey,
      request.headers.get("Range"),
      url.searchParams.get("preview") === "1",
    );
    if (!obj) return notFound();
    const access = await stub.accessShared(token, info.passwordHash);
    if (!access || access.exhausted) return notFound();
    return fileResponse(
      obj,
      file.item,
      "no-store",
      url.searchParams.get("preview") === "1",
      request.headers.has("Range"),
    );
  }
  if (action) return notFound();
  if (isLinkPreview(request)) return textView(lang, info.item, request.url);
  const result = await stub.accessShared(token, info.passwordHash);
  // uniform 404 for missing, disabled, wrong token, and exhausted budget alike — no enumeration oracle
  if (result === null || result.exhausted) {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }
  return textView(lang, result.item, request.url);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (
      path === "/" &&
      (request.method === "GET" || (request.method === "HEAD" && isLinkPreview(request)))
    )
      return homepage(request, env);
    const sharePath = path.match(
      /^\/f\/(\d+)\.([A-Za-z0-9_-]{22,43})(\/unlock|\/zip|\/og\.png|\/files\/[^/]+)?$/,
    );
    if (sharePath && sharePath[1] !== undefined && sharePath[2] !== undefined) {
      const response = await publicShare(request, env, sharePath[1], sharePath[2], sharePath[3]);
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    if (path === "/auth/login" && request.method === "GET")
      return await loginRedirect(request, env);
    if (path === "/auth/callback" && request.method === "GET") return handleCallback(request, env);
    if (path.startsWith("/api/")) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
