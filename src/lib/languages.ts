// curated snippet-language registry: suffix -> display name + highlight.js module
export type LanguageDef = {
  /** canonical stored suffix, e.g. "cpp" */
  suffix: string;
  /** display name shown in tags and the picker */
  name: string;
  /** highlight.js module name (differs for aliases like html -> xml) */
  hljs: string;
};

export const LANGUAGES: LanguageDef[] = [
  { suffix: "ts", name: "TypeScript", hljs: "typescript" },
  { suffix: "js", name: "JavaScript", hljs: "javascript" },
  { suffix: "py", name: "Python", hljs: "python" },
  { suffix: "cpp", name: "C++", hljs: "cpp" },
  { suffix: "c", name: "C", hljs: "c" },
  { suffix: "go", name: "Go", hljs: "go" },
  { suffix: "rs", name: "Rust", hljs: "rust" },
  { suffix: "java", name: "Java", hljs: "java" },
  { suffix: "kt", name: "Kotlin", hljs: "kotlin" },
  { suffix: "swift", name: "Swift", hljs: "swift" },
  { suffix: "objc", name: "Objective-C", hljs: "objectivec" },
  { suffix: "php", name: "PHP", hljs: "php" },
  { suffix: "rb", name: "Ruby", hljs: "ruby" },
  { suffix: "html", name: "HTML", hljs: "xml" },
  { suffix: "css", name: "CSS", hljs: "css" },
  { suffix: "json", name: "JSON", hljs: "json" },
  { suffix: "yaml", name: "YAML", hljs: "yaml" },
  { suffix: "toml", name: "TOML", hljs: "ini" },
  { suffix: "sql", name: "SQL", hljs: "sql" },
  { suffix: "sh", name: "Shell", hljs: "bash" },
  { suffix: "md", name: "Markdown", hljs: "markdown" },
  { suffix: "xml", name: "XML", hljs: "xml" },
  { suffix: "dockerfile", name: "Dockerfile", hljs: "dockerfile" },
  { suffix: "diff", name: "Diff", hljs: "diff" },
  { suffix: "lua", name: "Lua", hljs: "lua" },
  { suffix: "r", name: "R", hljs: "r" },
  { suffix: "scala", name: "Scala", hljs: "scala" },
  { suffix: "dart", name: "Dart", hljs: "dart" },
];

// alternative suffixes resolve to the same definition, e.g. "typescript" -> ts
const ALIASES: Record<string, string> = {
  typescript: "ts",
  jsx: "js",
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
