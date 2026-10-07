export const MAX_TEXT_PREVIEW_BYTES = 10 * 1024 * 1024;
export const TEXT_PREVIEW_CHUNK_BYTES = 256 * 1024;

// Read a small overlap so UTF-8 characters crossing page boundaries stay intact.
export function textPreviewRange(page: number, size: number): { start: number; end: number } {
  const offset = page * TEXT_PREVIEW_CHUNK_BYTES;
  return {
    start: Math.max(0, offset - 3),
    end: Math.min(size - 1, offset + TEXT_PREVIEW_CHUNK_BYTES + 2),
  };
}

export function decodeTextPreview(buffer: ArrayBuffer, page: number): string {
  const bytes = new Uint8Array(buffer);
  let start = page === 0 ? 0 : 3;
  let end = Math.min(bytes.length, start + TEXT_PREVIEW_CHUNK_BYTES);
  while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start++;
  while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end++;
  return new TextDecoder().decode(bytes.subarray(start, end));
}

export type PreviewKind = "image" | "audio" | "video" | "pdf" | "text";

export function previewKind(type: string, size = 0): PreviewKind | null {
  const mime = type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(mime)) return "image";
  if (/^audio\/(mpeg|mp4|ogg|wav|webm|flac|x-wav)$/.test(mime)) return "audio";
  if (/^video\/(mp4|webm|ogg|quicktime)$/.test(mime)) return "video";
  if (mime === "application/pdf") return "pdf";
  if (
    mime.startsWith("text/") ||
    ["application/json", "application/xml", "application/javascript"].includes(mime)
  )
    return size > MAX_TEXT_PREVIEW_BYTES ? null : "text";
  return null;
}

export function fileTypeFromName(name: string): string {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  if (types[extension]) return types[extension];
  if (
    [
      "txt",
      "md",
      "csv",
      "json",
      "xml",
      "html",
      "css",
      "js",
      "ts",
      "jsx",
      "tsx",
      "svelte",
      "py",
      "rb",
      "rs",
      "go",
      "java",
      "c",
      "cpp",
      "h",
      "sh",
      "yaml",
      "yml",
      "toml",
      "log",
    ].includes(extension)
  )
    return "text/plain";
  return "application/octet-stream";
}
