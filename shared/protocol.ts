export const MAX_TEXT_LENGTH = 100_000; // by character count
export const MAX_BODY_BYTES = 524_288;
export const MAX_FILE_BYTES = 75 * 1024 * 1024;
export const PAGE_SIZE = 50;
export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,43}$/;
// optional snippet metadata: a display filename and/or a language suffix; both nullable
export const FILENAME_PATTERN = /^[^\\/:*?"<>|]{1,64}$/;
export const SUFFIX_PATTERN = /^[a-z][a-z0-9+#-]{0,15}$/;

export type ShareState = {
  active: boolean;
  /** owner-only: token and link path are only ever returned to the item's owner session */
  token?: string;
  /** short public path /f/<ownerSub>.<token>; undefined while never enabled */
  url?: string;
  maxDownloads: number | null;
  downloads: number;
};

export type Item = {
  id: string;
  text: string; // '' for file items
  createdAt: number;
  updatedAt: number; // epoch ms, server-generated
  kind: "text" | "file";
  fileName?: string;
  fileSize?: number;
  /** text snippets only: optional download filename */
  filename?: string;
  /** text snippets only: optional language suffix, e.g. "cpp" */
  suffix?: string;
  share?: ShareState;
};
export type Bootstrap = { items: Item[]; hasMore: boolean };

export type ServerMessage =
  | { type: "snapshot"; items: Item[]; hasMore: boolean }
  | { type: "upsert"; item: Item }
  | { type: "remove"; ids: string[] };

export const WS_PING = "ping";
export const WS_PONG = "pong";
