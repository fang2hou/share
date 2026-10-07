export const LANGUAGE_OPTIONS = [
  { id: "zh-CN", short: "简", name: "简体中文" },
  { id: "zh-TW", short: "繁", name: "繁體中文" },
  { id: "ja", short: "日", name: "日本語" },
  { id: "ko", short: "한", name: "한국어" },
  { id: "en", short: "En", name: "English" },
] as const;

export type Lang = "zh-CN" | "zh-TW" | "ja" | "ko" | "en";

export function pickLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t === "zh-tw" || t === "zh-hk" || t === "zh-mo" || t.startsWith("zh-hant")) return "zh-TW";
    if (t.startsWith("zh")) return "zh-CN";
    if (t.startsWith("ja")) return "ja";
    if (t.startsWith("ko")) return "ko";
    if (t.startsWith("en")) return "en";
  }
  return "en";
}

/** `{count}` template; `one` is only needed by locales that inflect for a count of 1. */
export type CountForms = { one?: string; other: string };

/** Replaces `{name}` placeholders; unknown names stay verbatim so a typo is visible in the UI. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

// Of the supported locales only English inflects, and its sole singular form is exactly 1,
// so Intl.PluralRules (and the locale it needs) would add nothing.
export function formatCount(forms: CountForms, count: number): string {
  return interpolate(count === 1 && forms.one ? forms.one : forms.other, { count });
}

export type Messages = {
  loading: string;
  // common actions and states
  copy: string;
  copied: string;
  copyFailed: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  download: string;
  retry: string;
  more: string;
  justNow: string;
  changeLanguage: string;

  // composer
  modeText: string;
  modeFiles: string;
  placeholder: string;
  filenamePlaceholder: string;
  suffixPlaceholder: string;
  searchSuffix: string;
  noSuffixMatches: string;
  clearSuffix: string;
  send: string;
  sendFailed: string;
  dropHint: string;
  dropHere: string;
  uploadOne: string;
  removeFile: string;
  multiUploadHint: string;
  fileCount: CountForms;
  clearFiles: string;
  upload: string;
  uploading: string;
  uploadFailed: string;
  fileTooLarge: string;
  tooManyFiles: string;

  // timeline and cards
  empty: string;
  reconnecting: string;
  itemCount: CountForms;
  loadOlder: string;
  editHint: string;
  saveFailed: string;
  confirmDelete: string;
  confirmDeleteKeys: string;
  deleteFailed: string;

  // file lists and preview
  selectAll: string;
  downloadZip: string;
  downloadEach: string;
  preview: string;
  closePreview: string;
  previewLoading: string;
  previewFailed: string;
  previewTruncated: string;
  previewPrevious: string;
  previewNext: string;

  // share panel
  share: string;
  closeShare: string;
  shareLink: string;
  protectedShare: string;
  openShare: string;
  limitLabel: string;
  unlimited: string;
  accessUsage: string;
  sharePassword: string;
  passwordHint: string;
  keepPassword: string;
  generatePassword: string;
  showPassword: string;
  hidePassword: string;
  copyInvitation: string;
  invitation: string;
  shareOn: string;
  shareOff: string;
  shareFailed: string;

  // public share page
  shareViewTitle: string;
  unlockTitle: string;
  unlockHint: string;
  unlock: string;
  unlockFailed: string;

  // auth
  loginFailed: string;
};

export const messages: Record<Lang, Messages> = {
  "zh-CN": {
    loading: "正在加载",
    copy: "复制",
    copied: "已复制",
    copyFailed: "复制失败",
    edit: "编辑",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    download: "下载",
    retry: "重试",
    more: "更多操作",
    justNow: "刚刚",
    changeLanguage: "切换语言",

    modeText: "文字模式",
    modeFiles: "文件模式",
    placeholder: "输入或粘贴文字",
    filenamePlaceholder: "文件名",
    suffixPlaceholder: "扩展名",
    searchSuffix: "搜索语言",
    noSuffixMatches: "没有匹配的语言",
    clearSuffix: "清除扩展名",
    send: "发送",
    sendFailed: "发送失败，内容已放回输入框。",
    dropHint: "拖放、粘贴或点击选择文件",
    dropHere: "松开即可上传",
    uploadOne: "上传此文件",
    removeFile: "移除文件",
    multiUploadHint: "文件会逐个上传，下载时可以选择是否打包为 ZIP。",
    fileCount: { other: "{count} 个文件" },
    clearFiles: "清空",
    upload: "上传",
    uploading: "上传中",
    uploadFailed: "上传失败",
    fileTooLarge: "单个文件不能超过 256 MB",
    tooManyFiles: "一次最多 100 个文件，请分批上传。",

    empty: "还没有内容",
    reconnecting: "连接中断，正在重连…",
    itemCount: { other: "{count} 条" },
    loadOlder: "加载更早的内容",
    editHint: "{saveKeys} 保存 · {escKeys} 取消",
    saveFailed: "保存失败",
    confirmDelete: "确认删除",
    confirmDeleteKeys: "再按一次 {keys} 删除",
    deleteFailed: "删除失败",

    selectAll: "全选",
    downloadZip: "打包下载",
    downloadEach: "逐个下载",
    preview: "预览",
    closePreview: "关闭预览",
    previewLoading: "正在加载预览…",
    previewFailed: "预览加载失败",
    previewTruncated: "分段预览，可切换查看完整内容。",
    previewPrevious: "上一段",
    previewNext: "下一段",

    share: "分享",
    closeShare: "关闭分享面板",
    shareLink: "分享链接",
    protectedShare: "密码保护",
    openShare: "有链接即可访问",
    limitLabel: "访问次数上限",
    unlimited: "不限",
    accessUsage: "访问次数：{used} / {max}",
    sharePassword: "访问密码",
    passwordHint: "6–128 个字符",
    keepPassword: "留空则保留当前密码",
    generatePassword: "生成随机密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    copyInvitation: "复制链接和密码",
    invitation: "{url}\n访问密码：{password}",
    shareOn: "开启分享",
    shareOff: "停止分享",
    shareFailed: "无法保存分享设置，请重试。",

    shareViewTitle: "分享的内容",
    unlockTitle: "需要密码",
    unlockHint: "这份内容受密码保护，请向分享者索取密码。",
    unlock: "查看内容",
    unlockFailed: "无法打开，请检查密码或稍后再试。",

    loginFailed: "GitHub 登录失败。",
  },
  "zh-TW": {
    loading: "載入中",
    copy: "複製",
    copied: "已複製",
    copyFailed: "複製失敗",
    edit: "編輯",
    save: "儲存",
    cancel: "取消",
    delete: "刪除",
    download: "下載",
    retry: "重試",
    more: "更多操作",
    justNow: "剛剛",
    changeLanguage: "切換語言",

    modeText: "文字模式",
    modeFiles: "檔案模式",
    placeholder: "輸入或貼上文字",
    filenamePlaceholder: "檔名",
    suffixPlaceholder: "副檔名",
    searchSuffix: "搜尋語言",
    noSuffixMatches: "找不到符合的語言",
    clearSuffix: "清除副檔名",
    send: "傳送",
    sendFailed: "傳送失敗，內容已放回輸入框。",
    dropHint: "拖放、貼上或點選以選擇檔案",
    dropHere: "放開即可上傳",
    uploadOne: "上傳此檔案",
    removeFile: "移除檔案",
    multiUploadHint: "檔案會逐一上傳，下載時可選擇是否打包成 ZIP。",
    fileCount: { other: "{count} 個檔案" },
    clearFiles: "全部清除",
    upload: "上傳",
    uploading: "上傳中",
    uploadFailed: "上傳失敗",
    fileTooLarge: "單一檔案不可超過 256 MB",
    tooManyFiles: "一次最多 100 個檔案，請分批上傳。",

    empty: "還沒有內容",
    reconnecting: "連線中斷，正在重新連線…",
    itemCount: { other: "{count} 筆" },
    loadOlder: "載入更早的內容",
    editHint: "{saveKeys} 儲存 · {escKeys} 取消",
    saveFailed: "儲存失敗",
    confirmDelete: "確認刪除",
    confirmDeleteKeys: "再按一次 {keys} 即可刪除",
    deleteFailed: "刪除失敗",

    selectAll: "全選",
    downloadZip: "打包下載",
    downloadEach: "逐一下載",
    preview: "預覽",
    closePreview: "關閉預覽",
    previewLoading: "正在載入預覽…",
    previewFailed: "預覽載入失敗",
    previewTruncated: "分段預覽，可切換查看完整內容。",
    previewPrevious: "上一段",
    previewNext: "下一段",

    share: "分享",
    closeShare: "關閉分享面板",
    shareLink: "分享連結",
    protectedShare: "密碼保護",
    openShare: "知道連結即可存取",
    limitLabel: "存取次數上限",
    unlimited: "不限",
    accessUsage: "存取次數：{used} / {max}",
    sharePassword: "分享密碼",
    passwordHint: "6–128 個字元",
    keepPassword: "留空即保留目前的密碼",
    generatePassword: "產生隨機密碼",
    showPassword: "顯示密碼",
    hidePassword: "隱藏密碼",
    copyInvitation: "複製連結與密碼",
    invitation: "{url}\n分享密碼：{password}",
    shareOn: "開啟分享",
    shareOff: "停止分享",
    shareFailed: "無法儲存分享設定，請再試一次。",

    shareViewTitle: "分享的內容",
    unlockTitle: "需要密碼",
    unlockHint: "這份內容受密碼保護，請向分享者索取密碼。",
    unlock: "查看內容",
    unlockFailed: "無法開啟，請確認密碼或稍後再試。",

    loginFailed: "GitHub 登入失敗。",
  },
  ja: {
    loading: "読み込み中",
    copy: "コピー",
    copied: "コピーしました",
    copyFailed: "コピーできませんでした",
    edit: "編集",
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    download: "ダウンロード",
    retry: "再試行",
    more: "その他の操作",
    justNow: "たった今",
    changeLanguage: "言語を変更",

    modeText: "テキストモード",
    modeFiles: "ファイルモード",
    placeholder: "テキストを入力または貼り付け",
    filenamePlaceholder: "ファイル名",
    suffixPlaceholder: "拡張子",
    searchSuffix: "言語を検索",
    noSuffixMatches: "一致する言語がありません",
    clearSuffix: "拡張子をクリア",
    send: "送信",
    sendFailed: "送信できませんでした。入力欄に内容を戻しました。",
    dropHint: "ドラッグ＆ドロップ、貼り付け、またはクリックしてファイルを選択",
    dropHere: "ドロップしてアップロード",
    uploadOne: "このファイルをアップロード",
    removeFile: "リストから外す",
    multiUploadHint:
      "ファイルは 1 つずつアップロードされます。ZIP にまとめるかどうかはダウンロード時に選べます。",
    fileCount: { other: "ファイル {count} 件" },
    clearFiles: "すべてクリア",
    upload: "アップロード",
    uploading: "アップロード中",
    uploadFailed: "アップロードできませんでした",
    fileTooLarge: "1 ファイルあたりの上限は 256 MB です",
    tooManyFiles: "一度にアップロードできるのは 100 ファイルまでです。何回かに分けてください。",

    empty: "まだ何もありません",
    reconnecting: "接続が切れました。再接続中…",
    itemCount: { other: "{count} 件" },
    loadOlder: "以前の項目を読み込む",
    editHint: "{saveKeys} で保存・{escKeys} でキャンセル",
    saveFailed: "保存できませんでした",
    confirmDelete: "削除を確定",
    confirmDeleteKeys: "もう一度 {keys} を押すと削除します",
    deleteFailed: "削除できませんでした",

    selectAll: "すべて選択",
    downloadZip: "ZIP でダウンロード",
    downloadEach: "個別にダウンロード",
    preview: "プレビュー",
    closePreview: "プレビューを閉じる",
    previewLoading: "プレビューを読み込み中…",
    previewFailed: "プレビューを読み込めませんでした",
    previewTruncated: "大きなファイルは分割して表示します。前後に移動して全体を確認できます。",
    previewPrevious: "前の部分",
    previewNext: "次の部分",

    share: "共有",
    closeShare: "共有設定を閉じる",
    shareLink: "共有リンク",
    protectedShare: "パスワードで保護",
    openShare: "リンクを知っている人に公開",
    limitLabel: "アクセス上限",
    unlimited: "無制限",
    accessUsage: "アクセス数：{used} / {max}",
    sharePassword: "パスワード",
    passwordHint: "6〜128 文字",
    keepPassword: "空欄なら現在のパスワードのまま",
    generatePassword: "ランダムなパスワードを生成",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    copyInvitation: "リンクとパスワードをコピー",
    invitation: "{url}\nパスワード：{password}",
    shareOn: "共有を開始",
    shareOff: "共有を停止",
    shareFailed: "共有設定を保存できませんでした。もう一度お試しください。",

    shareViewTitle: "共有された内容",
    unlockTitle: "パスワードが必要です",
    unlockHint:
      "この共有はパスワードで保護されています。共有した人にパスワードを確認してください。",
    unlock: "開く",
    unlockFailed:
      "開けませんでした。パスワードを確認するか、しばらくしてからもう一度お試しください。",

    loginFailed: "GitHub でログインできませんでした。",
  },
  ko: {
    loading: "불러오는 중",
    copy: "복사",
    copied: "복사됨",
    copyFailed: "복사하지 못했습니다",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    delete: "삭제",
    download: "다운로드",
    retry: "다시 시도",
    more: "더보기",
    justNow: "방금",
    changeLanguage: "언어 변경",

    modeText: "텍스트 모드",
    modeFiles: "파일 모드",
    placeholder: "텍스트를 입력하거나 붙여넣으세요",
    filenamePlaceholder: "파일 이름",
    suffixPlaceholder: "확장자",
    searchSuffix: "언어 검색",
    noSuffixMatches: "일치하는 언어가 없습니다",
    clearSuffix: "확장자 지우기",
    send: "전송",
    sendFailed: "전송하지 못했습니다. 입력한 내용은 입력란에 되돌려 두었습니다.",
    dropHint: "파일을 끌어다 놓거나 붙여넣거나 클릭해서 선택하세요",
    dropHere: "놓으면 업로드됩니다",
    uploadOne: "이 파일만 업로드",
    removeFile: "목록에서 제거",
    multiUploadHint:
      "파일은 하나씩 업로드됩니다. ZIP으로 묶을지는 다운로드할 때 선택할 수 있습니다.",
    fileCount: { other: "파일 {count}개" },
    clearFiles: "모두 지우기",
    upload: "업로드",
    uploading: "업로드 중",
    uploadFailed: "업로드하지 못했습니다",
    fileTooLarge: "파일 하나의 크기는 256 MB를 넘을 수 없습니다",
    tooManyFiles: "한 번에 최대 100개까지 업로드할 수 있습니다. 나눠서 업로드해 주세요.",

    empty: "아직 내용이 없습니다",
    reconnecting: "연결이 끊겼습니다. 다시 연결하는 중…",
    itemCount: { other: "{count}개" },
    loadOlder: "이전 항목 더 보기",
    editHint: "{saveKeys} 저장 · {escKeys} 취소",
    saveFailed: "저장하지 못했습니다",
    confirmDelete: "삭제 확인",
    confirmDeleteKeys: "{keys} 키를 한 번 더 누르면 삭제됩니다",
    deleteFailed: "삭제하지 못했습니다",

    selectAll: "전체 선택",
    downloadZip: "ZIP으로 다운로드",
    downloadEach: "하나씩 다운로드",
    preview: "미리 보기",
    closePreview: "미리 보기 닫기",
    previewLoading: "미리 보기를 불러오는 중…",
    previewFailed: "미리 보기를 불러오지 못했습니다",
    previewTruncated:
      "큰 파일은 나누어 표시합니다. 이전 또는 다음 부분으로 이동해 전체 내용을 확인하세요.",
    previewPrevious: "이전 부분",
    previewNext: "다음 부분",

    share: "공유",
    closeShare: "공유 설정 닫기",
    shareLink: "공유 링크",
    protectedShare: "비밀번호로 보호",
    openShare: "링크가 있는 사람에게 공개",
    limitLabel: "최대 열람 횟수",
    unlimited: "무제한",
    accessUsage: "열람 횟수: {used} / {max}",
    sharePassword: "비밀번호",
    passwordHint: "6~128자",
    keepPassword: "비워 두면 현재 비밀번호 유지",
    generatePassword: "무작위 비밀번호 생성",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    copyInvitation: "링크와 비밀번호 복사",
    invitation: "{url}\n비밀번호: {password}",
    shareOn: "공유 시작",
    shareOff: "공유 중지",
    shareFailed: "공유 설정을 저장하지 못했습니다. 다시 시도해 주세요.",

    shareViewTitle: "공유된 내용",
    unlockTitle: "비밀번호가 필요합니다",
    unlockHint: "비밀번호로 보호된 공유입니다. 공유한 사람에게 비밀번호를 요청하세요.",
    unlock: "열기",
    unlockFailed: "열 수 없습니다. 비밀번호를 확인하거나 잠시 후 다시 시도해 주세요.",

    loginFailed: "GitHub 로그인에 실패했습니다.",
  },
  en: {
    loading: "Loading",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    download: "Download",
    retry: "Retry",
    more: "More actions",
    justNow: "just now",
    changeLanguage: "Change language",

    modeText: "Text mode",
    modeFiles: "File mode",
    placeholder: "Type or paste text",
    filenamePlaceholder: "Filename",
    suffixPlaceholder: "Extension",
    searchSuffix: "Search",
    noSuffixMatches: "No matching languages",
    clearSuffix: "Clear extension",
    send: "Send",
    sendFailed: "Couldn't send. Your text is back in the box.",
    dropHint: "Drop, paste, or click to choose files",
    dropHere: "Drop files to upload",
    uploadOne: "Upload this file",
    removeFile: "Remove file",
    multiUploadHint: "Files upload one by one. You can bundle them into a ZIP when downloading.",
    fileCount: { one: "{count} file", other: "{count} files" },
    clearFiles: "Clear all",
    upload: "Upload",
    uploading: "Uploading",
    uploadFailed: "Upload failed",
    fileTooLarge: "Each file must be 256 MB or smaller",
    tooManyFiles: "You can upload up to 100 files at a time. Split them into smaller batches.",

    empty: "Nothing here yet",
    reconnecting: "Disconnected. Reconnecting…",
    itemCount: { one: "{count} item", other: "{count} items" },
    loadOlder: "Load older items",
    editHint: "{saveKeys} to save · {escKeys} to cancel",
    saveFailed: "Save failed",
    confirmDelete: "Confirm delete",
    confirmDeleteKeys: "Press {keys} again to delete",
    deleteFailed: "Delete failed",

    selectAll: "Select all",
    downloadZip: "Download as ZIP",
    downloadEach: "Download individually",
    preview: "Preview",
    closePreview: "Close preview",
    previewLoading: "Loading preview…",
    previewFailed: "Couldn't load the preview",
    previewTruncated:
      "Large files are shown in sections. Browse between sections to read the entire file.",
    previewPrevious: "Previous section",
    previewNext: "Next section",

    share: "Share",
    closeShare: "Close share panel",
    shareLink: "Share link",
    protectedShare: "Password protected",
    openShare: "Anyone with the link",
    limitLabel: "Access limit",
    unlimited: "Unlimited",
    accessUsage: "Accesses: {used} / {max}",
    sharePassword: "Password",
    passwordHint: "6–128 characters",
    keepPassword: "Leave blank to keep the current password",
    generatePassword: "Generate random password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    copyInvitation: "Copy link and password",
    invitation: "{url}\nPassword: {password}",
    shareOn: "Start sharing",
    shareOff: "Stop sharing",
    shareFailed: "Couldn't save share settings. Try again.",

    shareViewTitle: "Shared content",
    unlockTitle: "Password required",
    unlockHint: "This share is password-protected. Ask the sender for the password.",
    unlock: "Open",
    unlockFailed: "Couldn't open this share. Check the password or try again later.",

    loginFailed: "GitHub sign-in failed.",
  },
};
