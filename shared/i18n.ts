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
  filesUnit: string;
  send: string;
  upload: string;
  clearFiles: string;
  removeFile: string;
  zipNameLabel: string;
  placeholderPlain: string;
  changeLanguage: string;
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
    filesUnit: "个文件",
    send: "发送",
    upload: "上传",
    clearFiles: "清空",
    removeFile: "移除文件",
    zipNameLabel: "打包文件名",
    placeholderPlain: "输入文字",
    changeLanguage: "切换语言",
  },
  "zh-TW": {
    placeholder: "輸入文字，Shift+Enter 傳送",
    copy: "複製",
    copied: "已複製",
    copyFailed: "複製失敗",
    edit: "編輯",
    save: "儲存",
    cancel: "取消",
    editHint: "Shift+Enter 儲存 · Esc 取消",
    sendFailed: "傳送失敗，內容已放回輸入框",
    saveFailed: "儲存失敗",
    justNow: "剛剛",
    empty: "還沒有內容",
    reconnecting: "連線中斷，正在重新連線…",
    loginFailed: "GitHub 登入失敗。",
    retry: "重試",
    dropHint: "拖放、貼上或點擊選擇檔案",
    dropHere: "放開以上傳檔案",
    download: "下載",
    uploadFailed: "上傳失敗",
    fileTooLarge: "檔案超過 75MB 上限",
    uploading: "上傳中",
    share: "分享",
    shareOn: "開啟連結",
    shareOff: "關閉連結",
    limitLabel: "次數上限",
    unlimited: "不限",
    loadOlder: "載入更早",
    items: "筆",
    shareViewTitle: "分享的內容",
    more: "更多操作",
    delete: "刪除",
    confirmDelete: "再點一次確認",
    deleteFailed: "刪除失敗",
    modeText: "文字模式",
    modeFiles: "檔案模式",
    filesUnit: "個檔案",
    send: "傳送",
    upload: "上傳",
    clearFiles: "清空",
    removeFile: "移除檔案",
    zipNameLabel: "壓縮檔名稱",
    placeholderPlain: "輸入文字",
    changeLanguage: "切換語言",
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
    filesUnit: "個のファイル",
    send: "送信",
    upload: "アップロード",
    clearFiles: "クリア",
    removeFile: "ファイルを削除",
    zipNameLabel: "ZIP ファイル名",
    placeholderPlain: "テキストを入力",
    changeLanguage: "言語を変更",
  },
  ko: {
    placeholder: "텍스트 입력 (Shift+Enter로 전송)",
    copy: "복사",
    copied: "복사됨",
    copyFailed: "복사 실패",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    editHint: "Shift+Enter 저장 · Esc 취소",
    sendFailed: "전송 실패 — 입력란에 복원했습니다",
    saveFailed: "저장 실패",
    justNow: "방금",
    empty: "아직 내용이 없습니다",
    reconnecting: "연결이 끊겼습니다. 다시 연결하는 중…",
    loginFailed: "GitHub 로그인에 실패했습니다.",
    retry: "다시 시도",
    dropHint: "드래그 앤 드롭, 붙여넣기 또는 클릭으로 파일 선택",
    dropHere: "놓아서 파일 업로드",
    download: "다운로드",
    uploadFailed: "업로드 실패",
    fileTooLarge: "파일이 75MB 제한을 초과했습니다",
    uploading: "업로드 중",
    share: "공유",
    shareOn: "링크 활성화",
    shareOff: "링크 비활성화",
    limitLabel: "최대 횟수",
    unlimited: "무제한",
    loadOlder: "이전 내용 불러오기",
    items: "개",
    shareViewTitle: "공유된 내용",
    more: "기타 작업",
    delete: "삭제",
    confirmDelete: "한 번 더 눌러 확인",
    deleteFailed: "삭제 실패",
    modeText: "텍스트 모드",
    modeFiles: "파일 모드",
    filesUnit: "개의 파일",
    send: "전송",
    upload: "업로드",
    clearFiles: "모두 지우기",
    removeFile: "파일 제거",
    zipNameLabel: "ZIP 파일 이름",
    placeholderPlain: "텍스트 입력",
    changeLanguage: "언어 변경",
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
    filesUnit: "files",
    send: "Send",
    upload: "Upload",
    clearFiles: "Clear",
    removeFile: "Remove file",
    zipNameLabel: "ZIP name",
    placeholderPlain: "Type here",
    changeLanguage: "Change language",
  },
};
