import type { Lang } from "./i18n.ts";
import type { StoredFile } from "./protocol.ts";

export type PublicView = { lang: Lang; path: string; url: string; image: string } & (
  | { kind: "password" }
  | { kind: "files"; files: StoredFile[] }
  | { kind: "text"; text: string }
);
