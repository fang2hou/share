import { zipSync } from "fflate";
import { MAX_FILE_BYTES } from "#shared/protocol.js";

function zipName(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `files-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

export type UploadPayload = { file: File } | { error: "empty" } | { error: "too_large" };

/**
 * Normalizes a dropped/pasted file set into a single uploadable File:
 * one file passes through untouched, several files are packaged into one zip.
 */
export async function buildUploadPayload(list: File[]): Promise<UploadPayload> {
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
    payload = new File([zipSync(entries, { level: 6 })], zipName(new Date()), {
      type: "application/zip",
    });
  }
  if (payload.size > MAX_FILE_BYTES) return { error: "too_large" };
  return { file: payload };
}
