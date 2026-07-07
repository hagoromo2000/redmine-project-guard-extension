# Redmine Project Guard

Redmineのヘッダーに表示される `.current-project` を見て、利用者が設定したプロジェクトのページだけ警告バーを表示するChrome拡張です。

## ダウンロード

GitHubの `Code` > `Download ZIP` か、以下のリンクからzipファイルをダウンロードしてください。
- [ダウンロードリンク](https://github.com/hagoromo2000/redmine-project-guard-extension/archive/refs/heads/main.zip)

## 使い方

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効にする
3. ダウンロードしたzipを展開する
4. 「パッケージ化されていない拡張機能を読み込む」から、展開したディレクトリを選ぶ
5. 拡張機能の「詳細」> 「拡張機能のオプション」を開く
6. 利用する「Redmine URL」と「警告対象プロジェクト名」を設定する

※「警告対象プロジェクト名」とは、redmineヘッダーに最も大きく表示されている項目を指します。何を指定して良いかわからない場合は、詳しくは以下判定対象を参照のもと、ブラウザの検証ツールから該当文字列をご確認ください。

## 設定項目

- `Redmine URL`: 利用者自身のRedmine URL
- `警告対象プロジェクト名`: `.current-project` に表示されるプロジェクト名
- `判定方法`: `含む`、`完全一致`、`ワイルドカード`
- `警告メッセージ`: 警告バーに表示する文言
- `警告バーの位置`: `上部と下部`、`上部のみ`、`下部のみ`
- `警告色` / `文字色`: 警告バーの色

## 判定対象

Redmineの以下のようなHTMLを想定しています。

```html
<span class="current-project">Example Project</span>
```

オプション画面で設定した警告対象プロジェクト名と `.current-project` のテキストを比較し、一致したルールの警告バーを表示します。

## ホスト権限

この拡張は、リポジトリ内に特定のRedmineホスト名を持ちません。

オプション画面でRedmine URLを保存すると、そのURLに対するアクセス許可をChromeが確認します。許可後、そのホストにだけcontent scriptを登録します。
