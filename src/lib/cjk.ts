// pangu-style display spacing: a visible space between CJK and latin/numerals.
// Display-only by design — callers render the output but never store or copy it.

const HAN = "\\u3400-\\u4dbf\\u4e00-\\u9fff";
const HALF = "A-Za-z0-9";
const URL_RE = /https?:\/\/[\x21-\x7e]+/g;
const PAIRS = [new RegExp(`([${HAN}])([${HALF}])`, "g"), new RegExp(`([${HALF}])([${HAN}])`, "g")];

export function spaceCjk(text: string): string {
  // URLs stay verbatim; park them behind NUL-delimited placeholders first
  const urls: string[] = [];
  const nul = String.fromCharCode(0);
  let out = text.replaceAll(URL_RE, (m) => `${nul}${urls.push(m) - 1}${nul}`);
  for (const re of PAIRS) out = out.replace(re, "$1 $2");
  const restore = new RegExp(`${nul}(\\d+)${nul}`, "g");
  return out.replace(restore, (_, i) => urls[Number(i)] ?? "");
}
