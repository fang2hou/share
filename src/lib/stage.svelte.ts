import { buildUploadPayload, defaultZipName, type UploadPayload } from "#lib/files.js";

export type StagedFile = { id: string; file: File; preview: string | null };

/**
 * Client-side staging area for file uploads: drops, pastes, and picker
 * selections accumulate here instead of uploading immediately, so the user
 * can review, remove, rename the package, and confirm in one go.
 */
export class FileStage {
  files = $state<StagedFile[]>([]);
  zipName = $state(defaultZipName(new Date()));
  busy = $state(false);

  #urls: string[] = [];

  add(list: File[]): void {
    for (const file of list) {
      if (file.size === 0) continue;
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (preview) this.#urls.push(preview);
      this.files.push({ id: crypto.randomUUID(), file, preview });
    }
  }

  remove(id: string): void {
    const entry = this.files.find((f) => f.id === id);
    if (entry?.preview) URL.revokeObjectURL(entry.preview);
    this.files = this.files.filter((f) => f.id !== id);
  }

  clear(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls = [];
    this.files = [];
    this.zipName = defaultZipName(new Date());
  }

  totalBytes = $derived(this.files.reduce((sum, f) => sum + f.file.size, 0));

  payload(): Promise<UploadPayload> {
    return buildUploadPayload(
      this.files.map((f) => f.file),
      { zipName: this.zipName },
    );
  }

  dispose(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls = [];
  }
}
