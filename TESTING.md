# 検証記録（独立HTMLページ版）

## 実施した検証

- `node --check site.js` による構文確認。
- 13個のHTMLを解析し、151個の内部リンク・参照アセット・ページ内アンカーの行き先を確認。重複IDや外部依存なし。
- PythonのHTTPクライアントで、全ページとCSS・JavaScript・SVGをサブディレクトリー配下から取得し、ローカルファイルとバイト一致することを確認。
- ChromiumのDOMに同じHTML/CSS/JavaScriptを読み込み、五つの仕掛けから手紙までの通し操作、誤答、全角・カタカナ・空白の正規化、BBSの文字列表示を確認。
- おみくじ、ねこの反応、Web Audioの明示的な再生・停止、星の動画版と番号版、ページ離脱イベント時のタイマー停止を確認。
- 保存APIのテストダブルで、ページ間の記録復元、旧v1形式の引き継ぎ、確認チェックを伴う削除、不正JSON、保存禁止時のプレイを確認。
- 全13ページを320 / 390 / 768 / 1280px幅で描画し、ページ全体の横方向のはみ出しがないことを確認。
- `site.js` を読み込まない状態でも、全ページの見出し・本文・通常リンクが存在することを確認。
- 上記の操作中、ブラウザーJavaScript例外は0件。
- デスクトップ・モバイルのトップページと、日記のスクリーンショットを確認。

## 制約

この作業環境のChromiumではHTTP/file URLへの遷移が `ERR_BLOCKED_BY_ADMINISTRATOR` で拒否されるため、ブラウザーの検証は `--dom-only` で実施しました。

これは公開サイト経由の検証ではありません。HTTP配信の確認はPythonのクライアントによるものです。DOMモードの保存・ページ間引き継ぎはテストダブルを使用しており、実際のlocalStorageやブラウザー履歴を使った再読み込み・戻る操作の確認とは区別します。テストダブルは公開サイトには含みません。

公開URLでの配信、実ブラウザーでのページ遷移・戻る・リロード、実機Safariやタッチ操作、ページを閉じて再訪した際の保存は別途確認が必要です。

## 再実行

通常の開発環境：

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/check_site.py
```

ブラウザーのURL遷移が禁止された環境：

```sh
python tests/check_site.py --dom-only --screenshots /tmp/hoshizora-previews
```

通常モードはローカルHTTPサーバーを起動し、実URLでの遷移・リロード・戻る操作・JavaScript無効の表示もチェックします。通常モードは今回の制限環境では実行できていません。
