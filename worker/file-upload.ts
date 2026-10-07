import {
  ID_PATTERN,
  MAX_BODY_BYTES,
  MAX_FILE_BYTES,
  UPLOAD_PART_BYTES,
} from "../shared/protocol.ts";
import type { Space } from "./space.ts";

type Store = DurableObjectStub<Space>;
type Upload = {
  id: string;
  name: string;
  size: number;
  type: string;
  collectionId?: string;
  key: string;
  uploadId: string;
  expires: number;
};
const error = (status: number) => Response.json({ error: "upload_failed" }, { status });

async function canUpload(stub: Store, id: string, collectionId?: string): Promise<boolean> {
  return (
    (!collectionId ||
      (collectionId !== id && (await stub.collectionCanAccept(collectionId, id)))) &&
    (await stub.fileCanUpload(id, collectionId))
  );
}

export async function registerFile(
  env: Env,
  stub: Store,
  stored: R2Object,
  id: string,
  name: string,
  collectionId?: string,
): Promise<Response> {
  if (
    stored.customMetadata?.itemId !== (collectionId ?? id) &&
    (collectionId || stored.customMetadata?.itemId)
  )
    return error(400);
  name = stored.customMetadata?.name ? decodeURIComponent(stored.customMetadata.name) : name;
  const item = collectionId
    ? await stub.addCollectionFile(collectionId, {
        id,
        name,
        size: stored.size,
        type: stored.httpMetadata?.contentType ?? "application/octet-stream",
      })
    : await stub.createFile(id, { fileName: name, fileSize: stored.size, fileKey: stored.key });
  if (!item) {
    if (await stub.fileCanUpload(id)) await env.FILES.delete(stored.key);
    return error(400);
  }
  return Response.json({ item }, { status: 201 });
}

async function cleanup(env: Env, upload: Upload, manifestKey: string): Promise<void> {
  try {
    await env.FILES.resumeMultipartUpload(upload.key, upload.uploadId).abort();
  } catch {
    // Completion may have already consumed the multipart upload.
  }
  await env.FILES.delete([upload.key, manifestKey]);
}

/** Upload sessions and staging objects are scoped to the authenticated owner. */
export async function multipartUpload(
  request: Request,
  env: Env,
  sub: string,
  stub: Store,
  url: URL,
): Promise<Response> {
  const namespace = `uploads/gh:${sub}/`;
  const match = url.pathname.match(/^\/api\/uploads(?:\/([\w-]+)(?:\/(\d+|complete))?)?$/);
  if (!match) return error(404);
  const reference = match[1];
  const operation = match[2];
  const length = Number(request.headers.get("content-length"));
  if (request.method === "POST" && (!Number.isSafeInteger(length) || length <= 0))
    return error(411);
  if (request.method !== "PUT" && length > MAX_BODY_BYTES) return error(413);

  if (!reference) {
    if (request.method !== "POST") return error(405);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return error(400);
    }
    if (!body || typeof body !== "object") return error(400);
    const { id, name, size, type, collectionId } = body;
    if (typeof size === "number" && size > MAX_FILE_BYTES) return error(413);
    if (
      typeof id !== "string" ||
      !ID_PATTERN.test(id) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 255 ||
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      typeof type !== "string" ||
      type.length > 255 ||
      (collectionId !== undefined &&
        (typeof collectionId !== "string" || !ID_PATTERN.test(collectionId)))
    )
      return error(400);
    if (!(await canUpload(stub, id, collectionId))) return error(400);
    const token = crypto.randomUUID();
    const key = namespace + token + "/body";
    const multipart = await env.FILES.createMultipartUpload(key);
    const upload: Upload = {
      id,
      name: name.trim(),
      size,
      type: type || "application/octet-stream",
      collectionId,
      key,
      uploadId: multipart.uploadId,
      expires: Date.now() + 60 * 60 * 1000,
    };
    try {
      await env.FILES.put(namespace + token, JSON.stringify(upload));
    } catch (cause) {
      await multipart.abort();
      throw cause;
    }
    return Response.json({ reference: token }, { status: 201 });
  }
  if (!ID_PATTERN.test(reference)) return error(404);
  const manifestKey = namespace + reference;
  const manifest = await env.FILES.get(manifestKey);
  if (!manifest) return error(404);
  const upload = await manifest.json<Upload>();
  if (request.method === "DELETE" && !operation) {
    await cleanup(env, upload, manifestKey);
    return new Response(null, { status: 204 });
  }
  if (upload.expires < Date.now()) {
    await cleanup(env, upload, manifestKey);
    return error(404);
  }
  const multipart = env.FILES.resumeMultipartUpload(upload.key, upload.uploadId);
  const count = Math.ceil(upload.size / UPLOAD_PART_BYTES);
  if (request.method === "PUT" && operation && operation !== "complete") {
    const part = Number(operation);
    if (!Number.isInteger(part) || part < 1 || part > count) return error(400);
    const expected = Math.min(UPLOAD_PART_BYTES, upload.size - (part - 1) * UPLOAD_PART_BYTES);
    if (!length) return error(411);
    if (length !== expected || !request.body) return error(400);
    return Response.json(await multipart.uploadPart(part, request.body));
  }
  if (request.method !== "POST" || operation !== "complete") return error(405);
  let parts: R2UploadedPart[];
  try {
    const body = await request.json<{ parts: R2UploadedPart[] }>();
    parts = body.parts;
    if (
      !Array.isArray(parts) ||
      parts.length !== count ||
      parts.some(
        (part, index) =>
          !part ||
          part.partNumber !== index + 1 ||
          typeof part.etag !== "string" ||
          !part.etag ||
          part.etag.length > 4096,
      )
    )
      return error(400);
  } catch {
    return error(400);
  }
  if (!(await canUpload(stub, upload.id, upload.collectionId))) return error(400);
  // Complete into a private staging key, then publish with the same immutable-write
  // condition as small files. Competing retries cannot replace an accepted file.
  if (!(await env.FILES.head(upload.key))) await multipart.complete(parts);
  const staged = await env.FILES.get(upload.key);
  if (!staged || staged.size !== upload.size) return error(400);
  const key = `gh:${sub}/${upload.id}`;
  let stored = await env.FILES.put(key, staged.body, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: upload.type },
    customMetadata: {
      itemId: upload.collectionId ?? upload.id,
      name: encodeURIComponent(upload.name),
    },
  });
  stored ??= await env.FILES.head(key);
  if (!stored) return error(500);
  const response = await registerFile(
    env,
    stub,
    stored,
    upload.id,
    upload.name,
    upload.collectionId,
  );
  if (response.ok) await cleanup(env, upload, manifestKey);
  return response;
}
