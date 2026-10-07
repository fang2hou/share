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
  tooManyFiles: string;
  keepPassword: string;
  protectedShare: string;
  openShare: string;
  shareAccessHint: string;
  sharePassword: string;
  passwordHint: string;
  generatePassword: string;
  showPassword: string;
  hidePassword: string;
  shareFailed: string;
  copyInvitation: string;
  unlockTitle: string;
  unlockHint: string;
  unlock: string;
  unlockFailed: string;
  multiUploadHint: string;
  uploadOne: string;
  downloadSelected: string;
  downloadZip: string;
  downloadEach: string;
  selectAll: string;
  preview: string;
  closePreview: string;
  transferFailed: string;

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
  changeLanguage: string;
  confirmDeleteKeys: string;
  filenamePlaceholder: string;
  suffixPlaceholder: string;
  searchSuffix: string;
  noSuffixMatches: string;
  clearSuffix: string;
};

export const messages: Record<Lang, Messages> = {
  "zh-CN": {
    tooManyFiles: "一组最多 100 个文件，请分批上传。",
    keepPassword: "留空保留当前密码",
    protectedShare: "密码保护",
    openShare: "持有链接即可访问",
    shareAccessHint: "接收者输入密码后才能查看内容或下载文件。",
    sharePassword: "分享密码",
    passwordHint: "6–128 个字符",
    generatePassword: "生成密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    shareFailed: "分享设置保存失败，请重试",
    copyInvitation: "复制链接和密码",
    unlockTitle: "输入密码，查看分享",
    unlockHint: "这份内容受密码保护，请向分享者获取密码。",
    unlock: "查看内容",
    unlockFailed: "暂时无法打开，请检查密码或稍后重试。",
    multiUploadHint: "每个文件单独上传，下载时再决定是否打包。",
    uploadOne: "上传此文件",
    downloadSelected: "下载所选文件",
    downloadZip: "打包为 ZIP",
    downloadEach: "逐个下载",
    selectAll: "全选",
    preview: "预览",
    closePreview: "关闭预览",
    transferFailed: "操作失败，请重试",

    placeholder: "请在这里输入文字",
    copy: "复制",
    copied: "已复制",
    copyFailed: "复制失败",
    edit: "编辑",
    save: "保存",
    cancel: "取消",
    editHint: "{saveKeys} 保存 · {escKeys} 取消",
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
    changeLanguage: "切换语言",
    confirmDeleteKeys: "再按一次 {keys} 删除",
    filenamePlaceholder: "文件名",
    suffixPlaceholder: "后缀",
    searchSuffix: "搜索",
    noSuffixMatches: "没有匹配的语言",
    clearSuffix: "清除后缀",
  },
  "zh-TW": {
    tooManyFiles: "每組最多 100 個檔案，請分批上傳。",
    keepPassword: "留白保留目前的密碼",
    protectedShare: "密碼保護",
    openShare: "知道連結即可存取",
    shareAccessHint: "收件者輸入密碼後，才能查看內容或下載檔案。",
    sharePassword: "分享密碼",
    passwordHint: "6–128 個字元",
    generatePassword: "產生密碼",
    showPassword: "顯示密碼",
    hidePassword: "隱藏密碼",
    shareFailed: "分享設定儲存失敗，請重試",
    copyInvitation: "複製連結與密碼",
    unlockTitle: "輸入密碼，查看分享",
    unlockHint: "這份內容受密碼保護，請向分享者索取密碼。",
    unlock: "查看內容",
    unlockFailed: "目前無法開啟，請確認密碼或稍後再試。",
    multiUploadHint: "每個檔案分別上傳，下載時再決定是否壓縮。",
    uploadOne: "上傳此檔案",
    downloadSelected: "下載所選檔案",
    downloadZip: "打包成 ZIP",
    downloadEach: "逐一下載",
    selectAll: "全選",
    preview: "預覽",
    closePreview: "關閉預覽",
    transferFailed: "操作失敗，請重試",

    placeholder: "請在這裡輸入文字",
    copy: "複製",
    copied: "已複製",
    copyFailed: "複製失敗",
    edit: "編輯",
    save: "儲存",
    cancel: "取消",
    editHint: "{saveKeys} 儲存 · {escKeys} 取消",
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
    changeLanguage: "切換語言",
    confirmDeleteKeys: "再按一次 {keys} 刪除",
    filenamePlaceholder: "檔名",
    suffixPlaceholder: "後綴",
    searchSuffix: "搜尋",
    noSuffixMatches: "沒有匹配的語言",
    clearSuffix: "清除後綴",
  },
  ja: {
    tooManyFiles: "1回にまとめられるのは100ファイルまでです。分けてアップロードしてください。",
    keepPassword: "空欄のままなら現在のパスワードを維持",
    protectedShare: "パスワードで保護",
    openShare: "リンクを知っている人に公開",
    shareAccessHint: "内容の表示やファイルのダウンロードにはパスワードが必要です。",
    sharePassword: "共有パスワード",
    passwordHint: "6〜128文字",
    generatePassword: "パスワードを生成",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    shareFailed: "共有設定を保存できませんでした。もう一度お試しください",
    copyInvitation: "リンクとパスワードをコピー",
    unlockTitle: "パスワードを入力して開く",
    unlockHint: "この共有はパスワードで保護されています。共有した人に確認してください。",
    unlock: "内容を表示",
    unlockFailed: "開けませんでした。パスワードを確認するか、しばらくしてからお試しください。",
    multiUploadHint:
      "ファイルは個別にアップロードします。ZIPにまとめるかはダウンロード時に選べます。",
    uploadOne: "このファイルをアップロード",
    downloadSelected: "選択したファイルをダウンロード",
    downloadZip: "ZIPにまとめる",
    downloadEach: "個別にダウンロード",
    selectAll: "すべて選択",
    preview: "プレビュー",
    closePreview: "プレビューを閉じる",
    transferFailed: "操作に失敗しました。もう一度お試しください",

    placeholder: "ここにテキストを入力",
    copy: "コピー",
    copied: "コピー済み",
    copyFailed: "コピー失敗",
    edit: "編集",
    save: "保存",
    cancel: "キャンセル",
    editHint: "{saveKeys} で保存・{escKeys} でキャンセル",
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
    shareViewTitle: "共有された内容",
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
    changeLanguage: "言語を変更",
    confirmDeleteKeys: "{keys} をもう一度押して削除",
    filenamePlaceholder: "ファイル名",
    suffixPlaceholder: "拡張子",
    searchSuffix: "検索",
    noSuffixMatches: "一致する言語がありません",
    clearSuffix: "拡張子をクリア",
  },
  ko: {
    tooManyFiles: "한 묶음에 최대 100개 파일을 올릴 수 있습니다. 나눠서 업로드해 주세요.",
    keepPassword: "비워 두면 현재 비밀번호 유지",
    protectedShare: "비밀번호로 보호",
    openShare: "링크가 있는 사람에게 공개",
    shareAccessHint: "내용을 보거나 파일을 다운로드하려면 비밀번호가 필요합니다.",
    sharePassword: "공유 비밀번호",
    passwordHint: "6~128자",
    generatePassword: "비밀번호 생성",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    shareFailed: "공유 설정을 저장하지 못했습니다. 다시 시도해 주세요",
    copyInvitation: "링크와 비밀번호 복사",
    unlockTitle: "비밀번호를 입력해 열기",
    unlockHint: "비밀번호로 보호된 공유입니다. 공유한 사람에게 비밀번호를 요청하세요.",
    unlock: "내용 보기",
    unlockFailed: "열 수 없습니다. 비밀번호를 확인하거나 잠시 후 다시 시도해 주세요.",
    multiUploadHint: "파일은 각각 업로드됩니다. ZIP으로 묶을지는 다운로드할 때 선택할 수 있습니다.",
    uploadOne: "이 파일 업로드",
    downloadSelected: "선택한 파일 다운로드",
    downloadZip: "ZIP으로 묶기",
    downloadEach: "개별 다운로드",
    selectAll: "전체 선택",
    preview: "미리 보기",
    closePreview: "미리 보기 닫기",
    transferFailed: "실패했습니다. 다시 시도해 주세요",

    placeholder: "여기에 텍스트를 입력하세요",
    copy: "복사",
    copied: "복사됨",
    copyFailed: "복사 실패",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    editHint: "{saveKeys} 저장 · {escKeys} 취소",
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
    changeLanguage: "언어 변경",
    confirmDeleteKeys: "{keys}를 다시 눌러 삭제",
    filenamePlaceholder: "파일명",
    suffixPlaceholder: "확장자",
    searchSuffix: "검색",
    noSuffixMatches: "일치하는 언어가 없습니다",
    clearSuffix: "확장자 지우기",
  },
  en: {
    tooManyFiles: "A collection can contain up to 100 files. Upload them in smaller groups.",
    keepPassword: "Leave blank to keep the current password",
    protectedShare: "Password protected",
    openShare: "Anyone with the link",
    shareAccessHint: "Recipients need the password to view content or download files.",
    sharePassword: "Share password",
    passwordHint: "6–128 characters",
    generatePassword: "Generate password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    shareFailed: "Could not save sharing settings. Try again.",
    copyInvitation: "Copy link and password",
    unlockTitle: "Enter the password to open this share",
    unlockHint: "This share is protected. Ask the sender for the password.",
    unlock: "View content",
    unlockFailed: "Could not open this share. Check the password or try again later.",
    multiUploadHint: "Files upload individually. Choose whether to ZIP them when downloading.",
    uploadOne: "Upload this file",
    downloadSelected: "Download selected files",
    downloadZip: "Download as ZIP",
    downloadEach: "Download individually",
    selectAll: "Select all",
    preview: "Preview",
    closePreview: "Close preview",
    transferFailed: "Something went wrong. Try again.",

    placeholder: "Type your text here",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    editHint: "{saveKeys} to save · {escKeys} to cancel",
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
    limitLabel: "Max accesses",
    unlimited: "Unlimited",
    loadOlder: "Load older",
    items: "items",
    shareViewTitle: "Shared content",
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
    changeLanguage: "Change language",
    confirmDeleteKeys: "Press {keys} again to delete",
    filenamePlaceholder: "Filename",
    suffixPlaceholder: "Suffix",
    searchSuffix: "Search",
    noSuffixMatches: "No matching languages",
    clearSuffix: "Clear suffix",
  },
};
