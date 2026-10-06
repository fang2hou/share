// keyboard hint rendering: macOS uses its glyph system (⌘ ⇧ ⏎ ⎋), everyone
// else gets spelled-out keys
const platform: string =
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
  navigator.platform ??
  "";

export const isMac = /mac/i.test(platform);

export const keys = {
  copy: isMac ? "⌘C" : "Ctrl+C",
  edit: isMac ? "⌘E" : "Ctrl+E",
  share: isMac ? "⌘⇧C" : "Ctrl+Shift+C",
  del: isMac ? "⌘D" : "Ctrl+D",
  save: isMac ? "⇧⏎" : "Shift+Enter",
  esc: isMac ? "⎋" : "Esc",
} as const;
