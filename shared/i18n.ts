export type Lang = "zh-CN" | "ja" | "en";

export function pickLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t.startsWith("zh")) return "zh-CN";
    if (t.startsWith("ja")) return "ja";
    if (t.startsWith("en")) return "en";
  }
  return "en";
}

export type Messages = {
  placeholder: string;
  copy: string;
  copied: string;
  copyFailed: string;
  edit: string;
  save: string;
  cancel: string;
  editHint: string;
  sendFailed: string;
  saveFailed: string;
  justNow: string;
  empty: string;
  reconnecting: string;
  loginFailed: string;
  retry: string;
  dropHint: string;
  dropHere: string;
  download: string;
  uploadFailed: string;
  fileTooLarge: string;
  uploading: string;
  share: string;
  shareOn: string;
  shareOff: string;
  limitLabel: string;
  unlimited: string;
  loadOlder: string;
  items: string;
  shareViewTitle: string;
  more: string;
  delete: string;
  confirmDelete: string;
  deleteFailed: string;
  modeText: string;
  modeFiles: string;
};

export const messages: Record<Lang, Messages> = {
  "zh-CN": {
    placeholder: "输入文字，Shift+Enter 发送",
    copy: "复制",
    copied: "已复制",
    copyFailed: "复制失败",
    edit: "编辑",
    save: "保存",
    cancel: "取消",
    editHint: "Shift+Enter 保存 · Esc 取消",
    sendFailed: "发送失败，内容已放回输入框",
    saveFailed: "保存失败",
    justNow: "刚刚",
    empty: "还没有内容",
    reconnecting: "连接中断，正在重连…",
    loginFailed: "GitHub 登录失败。",
    retry: "重试",
    dropHint: "拖放、粘贴或点击选择文件",
    dropHere: "松开以上传文件",
    download: "下载",
    uploadFailed: "上传失败",
    fileTooLarge: "文件超过 75MB 上限",
    uploading: "上传中",
    share: "分享",
    shareOn: "开启外链",
    shareOff: "关闭外链",
    limitLabel: "次数限制",
    unlimited: "不限",
    loadOlder: "加载更早",
    items: "条",
    shareViewTitle: "分享的内容",
    more: "更多操作",
    delete: "删除",
    confirmDelete: "再点一次确认",
    deleteFailed: "删除失败",
    modeText: "文字模式",
    modeFiles: "文件模式",
  },
  ja: {
    placeholder: "テキストを入力（Shift+Enter で送信）",
    copy: "コピー",
    copied: "コピー済み",
    copyFailed: "コピー失敗",
    edit: "編集",
    save: "保存",
    cancel: "キャンセル",
    editHint: "Shift+Enter で保存・Esc でキャンセル",
    sendFailed: "送信に失敗しました。入力欄に戻しました",
    saveFailed: "保存に失敗しました",
    justNow: "たった今",
    empty: "まだ何もありません",
    reconnecting: "接続が切れました。再接続中…",
    loginFailed: "GitHub ログインに失敗しました。",
    retry: "再試行",
    dropHint: "ドラッグ＆ドロップ、貼り付け、またはクリックしてファイルを選択",
    dropHere: "ドロップしてアップロード",
    download: "ダウンロード",
    uploadFailed: "アップロードに失敗しました",
    fileTooLarge: "ファイルが 75MB の上限を超えています",
    uploading: "アップロード中",
    share: "共有",
    shareOn: "リンクを有効化",
    shareOff: "リンクを無効化",
    limitLabel: "回数制限",
    unlimited: "無制限",
    loadOlder: "さらに読み込む",
    items: "件",
    shareViewTitle: "共有されたテキスト",
    more: "その他の操作",
    delete: "削除",
    confirmDelete: "もう一度タップで確定",
    deleteFailed: "削除に失敗しました",
    modeText: "テキストモード",
    modeFiles: "ファイルモード",
  },
  en: {
    placeholder: "Type here — Shift+Enter to send",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    editHint: "Shift+Enter to save · Esc to cancel",
    sendFailed: "Send failed — text restored to the input",
    saveFailed: "Save failed",
    justNow: "just now",
    empty: "Nothing here yet",
    reconnecting: "Disconnected — reconnecting…",
    loginFailed: "GitHub sign-in failed.",
    retry: "Retry",
    dropHint: "Drop, paste, or click to pick files",
    dropHere: "Drop files to upload",
    download: "Download",
    uploadFailed: "Upload failed",
    fileTooLarge: "File exceeds the 75MB limit",
    uploading: "Uploading",
    share: "Share",
    shareOn: "Enable link",
    shareOff: "Disable link",
    limitLabel: "Max downloads",
    unlimited: "Unlimited",
    loadOlder: "Load older",
    items: "items",
    shareViewTitle: "Shared text",
    more: "More actions",
    delete: "Delete",
    confirmDelete: "Tap again to confirm",
    deleteFailed: "Delete failed",
    modeText: "Text mode",
    modeFiles: "File mode",
  },
};
