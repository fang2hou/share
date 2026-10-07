import { Zip, ZipPassThrough } from "fflate";
import type { Item, StoredFile } from "../shared/protocol.ts";
import { previewKind, fileTypeFromName, MAX_TEXT_PREVIEW_BYTES } from "../shared/file-preview.ts";

export async function readFile(
  bucket: R2Bucket,
  key: string,
  range: string | null,
  preview = false,
): Promise<R2ObjectBody | null> {
  const metadata = range || preview ? await bucket.head(key) : null;
  if (range || preview) {
    if (!metadata) return null;
    const type = metadata.httpMetadata?.contentType ?? "application/octet-stream";
    const name = decodeURIComponent(metadata.customMetadata?.name ?? "");
    const kind = previewKind(type) ?? previewKind(fileTypeFromName(name));
    if (preview && kind === "text" && metadata.size > MAX_TEXT_PREVIEW_BYTES) return null;
  }
  if (!range) return bucket.get(key);
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  if (!metadata) return null;
  const offset = match[1] ? Number(match[1]) : Math.max(0, metadata.size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), metadata.size - 1) : metadata.size - 1;
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(end) ||
    offset >= metadata.size ||
    end < offset ||
    (!match[1] && Number(match[2]) === 0)
  )
    return null;
  return bucket.get(key, { range: { offset, length: end - offset + 1 } });
}

export function fileResponse(
  obj: R2ObjectBody,
  item: Item,
  cacheControl: string,
  preview = false,
  ranged = false,
): Response {
  const name = item.fileName ?? "download";
  const mime = obj.httpMetadata?.contentType ?? "application/octet-stream";
  const kind = previewKind(mime, obj.size);
  const inline = preview && kind !== null;
  const ascii = name
    .replace(/[^\x20-\x7e]/g, "_")
    .replaceAll('"', "")
    .replaceAll("\\", "_");
  const headers = new Headers({
    "content-type": inline && kind === "text" ? "text/plain; charset=utf-8" : mime,
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex",
    "referrer-policy": "no-referrer",
  });
  headers.set("accept-ranges", "bytes");
  let status = 200;
  if (ranged && obj.range && "offset" in obj.range && obj.range.offset !== undefined) {
    const length =
      "length" in obj.range
        ? (obj.range.length ?? obj.size - obj.range.offset)
        : obj.size - obj.range.offset;
    headers.set(
      "content-range",
      `bytes ${obj.range.offset}-${obj.range.offset + length - 1}/${obj.size}`,
    );
    headers.set("content-length", String(length));
    status = 206;
  } else headers.set("content-length", String(obj.size));
  if (inline) headers.set("content-security-policy", "sandbox; default-src 'none'");
  return new Response(obj.body, { headers, status });
}

function archiveName(name: string, used: Set<string>): string {
  // eslint-disable-next-line no-control-regex -- archive entries must not contain control characters
  const stripped = name.replaceAll(/[\\/\x00-\x1f]/g, "_");
  const clean = !stripped || stripped === "." || stripped === ".." ? "file" : stripped;
  let candidate = clean;
  let n = 2;
  while (used.has(candidate)) candidate = `${n++}-${clean}`;
  used.add(candidate);
  return candidate;
}

export function zipResponse(bucket: R2Bucket, owner: string, files: StoredFile[]): Response {
  async function* archive(): AsyncGenerator<Uint8Array> {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (error) throw error;
      chunks.push(chunk);
    });
    const used = new Set<string>();
    try {
      for (const file of files) {
        const obj = await bucket.get(`gh:${owner}/${file.id}`);
        if (!obj) throw new Error("file_unavailable");
        const entry = new ZipPassThrough(archiveName(file.name, used));
        zip.add(entry);
        while (chunks.length) yield chunks.shift()!;
        const reader = obj.body.getReader();
        try {
          while (true) {
            const result = await reader.read();
            entry.push(result.value ?? new Uint8Array(), result.done);
            while (chunks.length) yield chunks.shift()!;
            if (result.done) break;
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      }
      zip.end();
      while (chunks.length) yield chunks.shift()!;
    } finally {
      zip.terminate();
    }
  }
  const iterator = archive();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await iterator.next();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return(undefined);
      },
    }),
    {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="files.zip"',
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}

export function selectedFiles(files: StoredFile[], query: string | null): StoredFile[] | null {
  const ids = query === null ? files.map((f) => f.id) : query.split(",");
  if (ids.length === 0 || ids.length > 100 || new Set(ids).size !== ids.length) return null;
  const chosen = ids.map((id) => files.find((f) => f.id === id));
  if (chosen.some((f) => !f)) return null;
  const result = chosen as StoredFile[];
  // fflate writes standard ZIP archives; reject selections that need ZIP64.
  if (result.reduce((sum, f) => sum + f.size, 0) > 0xffffffff - 1024 * 1024) return null;
  return result;
}
