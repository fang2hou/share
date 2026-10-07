export type PreviewKind = "image" | "audio" | "video" | "pdf" | "text";

export function previewKind(type: string): PreviewKind | null {
  const mime = type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(mime)) return "image";
  if (/^audio\/(mpeg|mp4|ogg|wav|webm|flac|x-wav)$/.test(mime)) return "audio";
  if (/^video\/(mp4|webm|ogg|quicktime)$/.test(mime)) return "video";
  if (mime === "application/pdf") return "pdf";
  if (
    mime.startsWith("text/") ||
    ["application/json", "application/xml", "application/javascript"].includes(mime)
  )
    return "text";
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
