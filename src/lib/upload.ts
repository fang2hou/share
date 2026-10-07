import { MAX_FILE_BYTES, UPLOAD_PART_BYTES, type Item } from "#shared/protocol.js";

type Reply = { item?: Item; reference?: string; partNumber?: number; etag?: string };

function send(
  url: string,
  body: Blob,
  method: "POST" | "PUT",
  headers: Record<string, string>,
  progress: (loaded: number) => void,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "json";
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status === 401) location.href = "/auth/login";
      if (xhr.status < 200 || xhr.status >= 300) reject(new Error("upload_failed"));
      else resolve(xhr.response as Reply);
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.onabort = () => reject(new Error("upload_aborted"));
    xhr.send(body);
  });
}

export async function uploadFile(
  file: File,
  id: string,
  collectionId: string | undefined,
  progress: (percent: number) => void,
): Promise<Item> {
  if (file.size > MAX_FILE_BYTES || file.size === 0) throw new Error("file_too_large");
  if (file.size <= UPLOAD_PART_BYTES) {
    const reply = await send(
      "/api/files",
      file,
      "POST",
      {
        "content-type": file.type || "application/octet-stream",
        "x-id": id,
        "x-file-name": encodeURIComponent(file.name),
        ...(collectionId ? { "x-collection-id": collectionId } : {}),
      },
      (loaded) => progress(Math.min(99, Math.round((loaded / file.size) * 100))),
    );
    if (!reply.item) throw new Error("upload_failed");
    return reply.item;
  }
  const start = await fetch("/api/uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, name: file.name, size: file.size, type: file.type, collectionId }),
  });
  if (start.status === 401) location.href = "/auth/login";
  if (!start.ok) throw new Error("upload_failed");
  const { reference } = (await start.json()) as Reply;
  if (!reference) throw new Error("upload_failed");
  const base = `/api/uploads/${reference}`;
  const parts: { partNumber: number; etag: string }[] = [];
  let completed = false;
  try {
    for (let offset = 0; offset < file.size; offset += UPLOAD_PART_BYTES) {
      const partNumber = parts.length + 1;
      const reply = await send(
        `${base}/${partNumber}`,
        file.slice(offset, offset + UPLOAD_PART_BYTES),
        "PUT",
        { "content-type": "application/octet-stream" },
        (loaded) => progress(Math.min(99, Math.round(((offset + loaded) / file.size) * 100))),
      );
      if (reply.partNumber !== partNumber || !reply.etag) throw new Error("upload_failed");
      parts.push({ partNumber, etag: reply.etag });
    }
    const result = await fetch(`${base}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parts }),
    });
    if (result.status === 401) location.href = "/auth/login";
    if (!result.ok) throw new Error("upload_failed");
    const { item } = (await result.json()) as Reply;
    if (!item) throw new Error("upload_failed");
    completed = true;
    progress(100);
    return item;
  } finally {
    if (!completed) await fetch(base, { method: "DELETE" }).catch(() => {});
  }
}
