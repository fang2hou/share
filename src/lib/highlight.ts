// lazy highlight.js wiring: core + one chunk per language, loaded on first use
import type { LanguageDef } from "./languages.js";

type HljsCore = {
  registerLanguage(name: string, def: unknown): void;
  highlight(
    code: string,
    opts: { language: string; ignoreIllegals: boolean },
  ): {
    value: string;
  };
};

// explicit per-language import table so Vite can code-split each grammar
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  typescript: () => import("highlight.js/lib/languages/typescript"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  python: () => import("highlight.js/lib/languages/python"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  c: () => import("highlight.js/lib/languages/c"),
  go: () => import("highlight.js/lib/languages/go"),
  rust: () => import("highlight.js/lib/languages/rust"),
  java: () => import("highlight.js/lib/languages/java"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  swift: () => import("highlight.js/lib/languages/swift"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  objectivec: () => import("highlight.js/lib/languages/objectivec"),
  php: () => import("highlight.js/lib/languages/php"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  xml: () => import("highlight.js/lib/languages/xml"),
  css: () => import("highlight.js/lib/languages/css"),
  json: () => import("highlight.js/lib/languages/json"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  ini: () => import("highlight.js/lib/languages/ini"),
  sql: () => import("highlight.js/lib/languages/sql"),
  bash: () => import("highlight.js/lib/languages/bash"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  diff: () => import("highlight.js/lib/languages/diff"),
  lua: () => import("highlight.js/lib/languages/lua"),
  r: () => import("highlight.js/lib/languages/r"),
  scala: () => import("highlight.js/lib/languages/scala"),
  dart: () => import("highlight.js/lib/languages/dart"),
};

let coreP: Promise<HljsCore> | null = null;
const grammarPs = new Map<string, Promise<unknown>>();

function ensureCore(): Promise<HljsCore> {
  coreP ??= import("highlight.js/lib/core").then((m) => m.default as HljsCore);
  return coreP;
}

function ensureGrammar(hljs: string): Promise<unknown> | null {
  const loader = loaders[hljs];
  if (!loader) return null;
  let p = grammarPs.get(hljs);
  if (!p) {
    p = loader().then(async (m) => {
      (await ensureCore()).registerLanguage(hljs, m.default);
      return m.default;
    });
    grammarPs.set(hljs, p);
  }
  return p;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** returns highlighted HTML, or plain escaped text when the grammar fails */
export async function highlightCode(code: string, lang: LanguageDef): Promise<string> {
  const core = await ensureCore();
  const grammar = await ensureGrammar(lang.hljs);
  if (!grammar) return escapeHtml(code);
  try {
    return core.highlight(code, { language: lang.hljs, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
