export type StagedFile = {
  id: string;
  file: File;
  preview: string | null;
  collectionId?: string;
};

/**
 * Client-side staging area for file uploads: drops, pastes, and picker
 * selections accumulate here instead of uploading immediately, so the user
 * can review and upload files individually or as a collection.
 */
export class FileStage {
  files = $state<StagedFile[]>([]);
  collectionId = $state<string | undefined>();
  busy = $state(false);
  uploadingIds = $state<string[]>([]);

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
    if (this.files.length === 0) this.collectionId = undefined;
  }

  clear(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls = [];
    this.files = [];
    this.collectionId = undefined;
  }

  totalBytes = $derived(this.files.reduce((sum, f) => sum + f.file.size, 0));

  dispose(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls = [];
  }
}
