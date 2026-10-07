// curated snippet-language registry: suffix -> display name + shiki grammar
export type LanguageDef = {
  /** canonical stored suffix, e.g. "cpp" */
  suffix: string;
  /** display name shown in tags and the picker */
  name: string;
  /** shiki grammar id (VS Code language id) */
  id: string;
};

export const LANGUAGES: LanguageDef[] = [
  { suffix: "ts", name: "TypeScript", id: "typescript" },
  { suffix: "tsx", name: "TSX", id: "tsx" },
  { suffix: "js", name: "JavaScript", id: "javascript" },
  { suffix: "jsx", name: "JSX", id: "jsx" },
  { suffix: "svelte", name: "Svelte", id: "svelte" },
  { suffix: "astro", name: "Astro", id: "astro" },
  { suffix: "vue", name: "Vue", id: "vue" },
  { suffix: "cpp", name: "C++", id: "cpp" },
  { suffix: "c", name: "C", id: "c" },
  { suffix: "go", name: "Go", id: "go" },
  { suffix: "rs", name: "Rust", id: "rust" },
  { suffix: "java", name: "Java", id: "java" },
  { suffix: "kt", name: "Kotlin", id: "kotlin" },
  { suffix: "swift", name: "Swift", id: "swift" },
  { suffix: "objc", name: "Objective-C", id: "objective-c" },
  { suffix: "php", name: "PHP", id: "php" },
  { suffix: "rb", name: "Ruby", id: "ruby" },
  { suffix: "html", name: "HTML", id: "html" },
  { suffix: "css", name: "CSS", id: "css" },
  { suffix: "scss", name: "SCSS", id: "scss" },
  { suffix: "json", name: "JSON", id: "json" },
  { suffix: "yaml", name: "YAML", id: "yaml" },
  { suffix: "toml", name: "TOML", id: "toml" },
  { suffix: "sql", name: "SQL", id: "sql" },
  { suffix: "sh", name: "Shell", id: "shellscript" },
  { suffix: "md", name: "Markdown", id: "markdown" },
  { suffix: "xml", name: "XML", id: "xml" },
  { suffix: "dockerfile", name: "Dockerfile", id: "dockerfile" },
  { suffix: "diff", name: "Diff", id: "diff" },
  { suffix: "lua", name: "Lua", id: "lua" },
  { suffix: "r", name: "R", id: "r" },
  { suffix: "scala", name: "Scala", id: "scala" },
  { suffix: "dart", name: "Dart", id: "dart" },
];

// alternative suffixes resolve to the same definition, e.g. "typescript" -> ts
const ALIASES: Record<string, string> = {
  typescript: "ts",
  mjs: "js",
  cjs: "js",
  python: "py",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  hh: "cpp",
  h: "c",
  golang: "go",
  rust: "rs",
  kotlin: "kt",
  csharp: "cs",
  objectivec: "objc",
  ruby: "rb",
  htm: "html",
  yml: "yaml",
  shell: "sh",
  bash: "sh",
  zsh: "sh",
  markdown: "md",
  Dockerfile: "dockerfile",
};

const BY_SUFFIX = new Map<string, LanguageDef>(LANGUAGES.map((l) => [l.suffix, l]));

export function findLanguage(suffix: string | null | undefined): LanguageDef | null {
  if (!suffix) return null;
  const key = suffix.toLowerCase();
  return BY_SUFFIX.get(key) ?? BY_SUFFIX.get(ALIASES[key] ?? "") ?? null;
}
