// shiki (VS Code grammars) with the pure-JS regex engine: no WASM, and the
// core plus each grammar load on first use, so text-only sessions never pay
import type { LanguageDef } from "./languages.js";

type Highlighter = {
  loadLanguage(grammar: unknown): Promise<void>;
  codeToHtml(code: string, opts: { lang: string; theme: string }): string;
};

const THEME = "vitesse-light";

// explicit per-language import table so Vite can code-split each grammar
const GRAMMARS: Record<string, () => Promise<{ default: unknown }>> = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  svelte: () => import("shiki/langs/svelte.mjs"),
  astro: () => import("shiki/langs/astro.mjs"),
  vue: () => import("shiki/langs/vue.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  "objective-c": () => import("shiki/langs/objective-c.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  lua: () => import("shiki/langs/lua.mjs"),
  r: () => import("shiki/langs/r.mjs"),
  scala: () => import("shiki/langs/scala.mjs"),
  dart: () => import("shiki/langs/dart.mjs"),
};

let coreP: Promise<Highlighter> | null = null;
const grammarPs = new Map<string, Promise<void>>();

function ensureCore(): Promise<Highlighter> {
  coreP ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/themes/vitesse-light.mjs"),
  ]).then(([core, engine, theme]) =>
    core.createHighlighterCore({
      themes: [theme.default],
      langs: [],
      engine: engine.createJavaScriptRegexEngine(),
    }),
  );
  return coreP;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** returns shiki HTML; failures degrade to escaped plain text in the same shape */
export async function highlightCode(code: string, lang: LanguageDef): Promise<string> {
  const loader = GRAMMARS[lang.id];
  if (!loader) {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  try {
    const core = await ensureCore();
    let p = grammarPs.get(lang.id);
    if (!p) {
      p = loader().then(async (m) => {
        await core.loadLanguage(m.default);
      });
      grammarPs.set(lang.id, p);
    }
    await p;
    return core.codeToHtml(code, { lang: lang.id, theme: THEME });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}
