%EF%BB%BF# 設計書（Chrome拡張: Save Page to Drive）

バージョン: 0.1
作成日: 2025-10-28
対象: Manifest V3 / Google Chrome

## 1. 概要
- 目的: アクティブタブのWebページをPDF化し、指定のGoogleドライブフォルダへ保存。
- 方式: 優先は Chrome DevTools Protocol（CDP）`Page.printToPDF` を `chrome.debugger` 経由で呼び出し。失敗・不許可時は `html2canvas + jsPDF` にフォールバック。
- 認証: `chrome.identity` による OAuth2（スコープ: `https://www.googleapis.com/auth/drive.file`）。

## 2. 全体アーキテクチャ
- コンポーネント
  - Service Worker（背景処理、PDF生成、Driveアップロード、設定/権限管理）
  - ポップアップUI（ワンクリック保存、直近状態表示、簡易設定）
  - オプションページ（保存先フォルダ、命名規則、PDFオプション、通知、言語）
  - コンテキストメニュー（このページをDriveへPDF保存）
  - フォールバック用コンテンツスクリプト（DOM→Canvas→PDF）
- データフロー（要約）
  1) ユーザー操作 → 2) PDF生成（CDP or フォールバック） → 3) Driveへアップロード → 4) 通知/リンク提示

## 3. ディレクトリ構成（提案）
- ルート
  - `manifest.json`
  - `assets/icons/`（アイコン各サイズ）
  - `src/background/worker.js`（Service Worker）
  - `src/popup/`（`index.html`, `popup.js`, `popup.css`）
  - `src/options/`（`index.html`, `options.js`, `options.css`）
  - `src/content/fallback-capture.js`（フォールバック描画）
  - `src/lib/auth.js`（identityラッパ）
  - `src/lib/drive.js`（Drive API呼び出し）
  - `src/lib/pdf.js`（CDP印刷/制御）
  - `src/lib/fallback-pdf.js`（html2canvas+jsPDF生成）
  - `_locales/en/messages.json`, `_locales/ja/messages.json`

## 4. マニフェスト設計（MV3）
- 権限
  - `permissions`: `identity`, `storage`, `scripting`, `contextMenus`, `notifications`, `debugger`, `activeTab`
  - `host_permissions`: 最小限（フォールバック注入先が必要な場合は `https://*/*`, `http://*/*` を検討。原則 `activeTab` を優先）
- 背景
  - `background.service_worker`: `src/background/worker.js`
- アクション
  - `action.default_popup`: `src/popup/index.html`
- オプション
  - `options_page`: `src/options/index.html`
- i18n
  - `_locales` 配下にキー定義
- OAuth2（Identity API）
  - `oauth2.client_id`: `YOUR_CLIENT_ID.apps.googleusercontent.com`
  - `oauth2.scopes`: `["https://www.googleapis.com/auth/drive.file"]`
- CSP/外部接続
  - `host_permissions`/`externally_connectable` は不要予定
  - `connect-src`: `https://www.googleapis.com` を許可

例: `manifest.json`（抜粋）
```
{
  "manifest_version": 3,
  "name": "Save Page to Drive",
  "version": "0.1.0",
  "action": { "default_popup": "src/popup/index.html" },
  "background": { "service_worker": "src/background/worker.js" },
  "permissions": [
    "identity", "storage", "scripting", "contextMenus",
    "notifications", "debugger", "activeTab"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/drive.file"]
  },
  "icons": { "16": "assets/icons/16.png", "32": "assets/icons/32.png", "128": "assets/icons/128.png" }
}
```

## 5. 設定・データモデル
- ストレージ: `chrome.storage.sync`
- キー: `settings:v1`
- 構造（例）
```
{
  folderId: string,                 // DriveフォルダID
  fileNamePattern: string,          // 例: "{title}_{datetime:YYYYMMDD-HHmmss}.pdf"
  pdfOptions: {
    landscape: boolean,
    printBackground: boolean,
    paper: "A4" | "Letter",
    margin: "default" | "none" | "narrow"
  },
  notifications: { enabled: boolean, copyLinkOnSuccess: boolean },
  language: "ja" | "en",
  preferFallback: boolean           // CDP不可/不許可時に利用
}
```
- 命名テンプレート
  - トークン: `{title}`, `{urlHost}`, `{datetime:...}`
  - 無効文字は `_` へ置換。重複時は `(n)` 連番付与。

## 6. ユースフロー詳細
- 初回設定
  1) ポップアップ/オプションでフォルダID入力
  2) テスト保存で `identity.getAuthToken({interactive:true})` を要求
  3) 成功後、設定保存
- 保存（基本）
  1) ツールバーボタン/メニュークリック（ユーザー操作）
  2) `chrome.debugger.attach(tabId)` → `Page.printToPDF` 呼び出し
  3) base64 PDF取得 → `chrome.debugger.detach`
  4) `identity.getAuthToken()` → Drive `files.create`（multipart/related）
  5) 通知表示、必要ならリンクコピー
- フォールバック
  1) `scripting.executeScript` で `fallback-capture.js` 注入
  2) DOM→Canvas→ページ分割→PDFバイナリ生成
  3) 以降は同上でアップロード

## 7. API I/F 設計
- メッセージ種別（例）
  - `SAVE_PAGE_REQUEST`: { tabId?: number, overrideOptions?: Partial<Settings> }
  - `SAVE_PAGE_RESULT`: { ok: true, fileId: string, webViewLink?: string } | { ok: false, error: Code }
  - `GET_SETTINGS` / `SAVE_SETTINGS`
- Drive API
  - エンドポイント: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`
  - ヘッダ: `Authorization: Bearer <token>`, `Content-Type: multipart/related; boundary=...`
  - パート1（JSON）: `{ name, parents: [folderId], mimeType: "application/pdf" }`
  - パート2（PDF）: `application/pdf` のバイナリ

## 8. PDF生成（CDP）
- attach: `chrome.debugger.attach({tabId}, "1.3")`
- enable: `chrome.debugger.sendCommand({tabId}, "Page.enable")`
- print: `chrome.debugger.sendCommand({tabId}, "Page.printToPDF", {
    landscape, printBackground, displayHeaderFooter: false,
    paperWidth: A4.w, paperHeight: A4.h,
    marginTop, marginBottom, marginLeft, marginRight
  })`
- 結果: `{ data: base64string }`
- detach: `chrome.debugger.detach({tabId})`
- 備考: ユーザー操作に紐づけ、エラー時は明示メッセージ。

## 9. フォールバックPDF（html2canvas + jsPDF）
- `scripting.executeScript` で1回限り注入（`activeTab`）
- ビューポートを分割スクロールしてキャプチャし、ページサイズに分割
- 大ページでのメモリ圧迫対策: チャンク保存/逐次破棄

## 10. UI設計（概要）
- ポップアップ `src/popup/index.html`
  - 要素: 保存ボタン、保存先名（フォルダID短縮表示）、直近結果/エラー
  - クイック設定: 背景印刷ON/OFF、横向きON/OFF
- オプション `src/options/index.html`
  - 入力: フォルダID、命名規則、PDFオプション、通知、言語
  - 検証: フォルダ存在チェック（`files.get`）
- コンテキストメニュー
  - `chrome.contextMenus.create({ id: "save-pdf", contexts:["page"], title: i18n("saveToDrive") })`

## 11. 通知/進捗
- `chrome.notifications` で状態表示
  - 進行中: indeterminate
  - 成功: タイトル＋Driveリンク（クリックで開く）
  - 失敗: エラーコード/簡易対処

## 12. エラー分類と対処
- `AUTH_REQUIRED`, `TOKEN_EXPIRED` → 再同意
- `FOLDER_NOT_FOUND` → 入力見直し
- `RATE_LIMITED`, `NETWORK_ERROR` → バックオフ（指数、最大3回）
- `CDP_FAILED` → フォールバックへ切替
- `PDF_TOO_LARGE` → 分割 or 設定変更提案

## 13. ロギング/診断
- レベル: `error`, `warn`, `info`（デバッグはオプトイン）
- 収集: クライアント内のみ、第三者送信なし
- 問題報告支援: 設定・環境の匿名化出力（ユーザー明示操作）

## 14. 国際化
- `_locales/ja/messages.json`, `_locales/en/messages.json`
- キー例: `save_to_drive`, `saving`, `saved`, `error_auth`, `error_rate_limited`

## 15. セキュリティ/プライバシー
- 最小権限主義（`debugger` はユーザー操作時のみ使用し即 detach）
- トークンは `chrome.identity` の管理に依存し、恒久保存しない
- Driveは `drive.file` スコープでユーザーの作成ファイルのみに限定

## 16. Service Workerの寿命対策
- 処理の分割を避け、1トランザクションで完了
- 長時間化する場合は進捗通知更新で活動を維持
- 不測の停止は再実行ガイダンスを提示

## 17. テスト計画（要点）
- 正常: 短ページ/長ページ、SPA、背景印刷ON/OFF、縦横
- 異常: 認証拒否、フォルダ権限不足、ネットワーク断、レート制限
- 回帰: 設定移行、i18n、通知、メニュー

## 18. 実装タスク（MVP）
1) `manifest.json` 雛形
2) Service Worker: SAVE_PAGE 処理（CDP→Drive）
3) ポップアップ: ボタン/状態表示
4) オプション: フォルダID/簡易設定
5) 通知・エラー・リトライ
6) i18n 最小実装（ja/en）

## 19. 例: メッセージ契約（擬似型）
```
type Settings = {
  folderId: string;
  fileNamePattern: string;
  pdfOptions: { landscape: boolean; printBackground: boolean; paper: "A4"|"Letter"; margin: "default"|"none"|"narrow" };
  notifications: { enabled: boolean; copyLinkOnSuccess: boolean };
  language: "ja"|"en";
  preferFallback: boolean;
};

type SavePageRequest = { type: "SAVE_PAGE_REQUEST"; tabId?: number; overrideOptions?: Partial<Settings> };

type SavePageResult =
  | { type: "SAVE_PAGE_RESULT"; ok: true; fileId: string; webViewLink?: string }
  | { type: "SAVE_PAGE_RESULT"; ok: false; error: string; reason?: string };
```

## 20. 今後の拡張
- Google Picker APIによるフォルダ選択UI
- バッチ保存（複数タブ/ウィンドウ）
- ルールベース保存（URL→保存先/命名）
- メタデータ（Drive カスタムプロパティ）

---
この設計は `Docs/requirements.md` を前提にMVPを迅速に実装できるよう最小構成で定義しています。詳細は実装段階で補足/更新します。
