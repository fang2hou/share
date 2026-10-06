import { zipSync } from "fflate";
import { MAX_FILE_BYTES } from "#shared/protocol.js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function defaultZipName(d: Date): string {
  return `files-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

/** Strips path separators and control characters, keeps the .zip suffix. */
export function sanitizeZipName(raw: string, fallback: string): string {
  let name = raw
    .trim()
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/^\.+/, "");
  if (!name || name === ".zip") return fallback;
  if (!name.toLowerCase().endsWith(".zip")) name += ".zip";
  return name;
}

export type UploadPayload = { file: File } | { error: "empty" } | { error: "too_large" };

/**
 * Normalizes a staged file set into a single uploadable File:
 * one file passes through untouched, several files are packaged into one zip.
 */
export async function buildUploadPayload(
  list: File[],
  opts: { zipName?: string } = {},
): Promise<UploadPayload> {
  const files = list.filter((f) => f.size > 0);
  const [first] = files;
  if (!first) return { error: "empty" };
  let payload: File;
  if (files.length === 1) {
    payload = first;
  } else {
    const entries: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    for (const file of files) {
      let name = file.name || "file";
      let n = 2;
      while (used.has(name)) {
        name = `${n}-${file.name || "file"}`;
        n++;
      }
      used.add(name);
      entries[name] = new Uint8Array(await file.arrayBuffer());
    }
    const fallback = defaultZipName(new Date());
    const name = sanitizeZipName(opts.zipName ?? "", fallback);
    payload = new File([zipSync(entries, { level: 6 })], name, {
      type: "application/zip",
    });
  }
  if (payload.size > MAX_FILE_BYTES) return { error: "too_large" };
  return { file: payload };
}
