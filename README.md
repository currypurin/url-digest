# URL Digest

Markdown風のニュース本文を `#data=` に圧縮して埋め込み、GitHub Pages だけで共有できる静的ニュース一覧ページです。

## 使い方

1. GitHub Pages でこのリポジトリの root を公開する
2. ページを開く
3. タイトル、説明、Markdown風ニュース本文を入力する
4. `共有URLを作成` を押して生成された URL を共有する

## 入力例

```md
# トップニュース
### Helix-02, 掃除とベットメイキングを2分以内に実行させることを教えました。
https://x.com/Figure_robot/status/2052770982214172892
https://www.figure.ai/news/helix-02-bedroom-tidy

# その他
### CodexのGoals機能により、ARC-AGI-3で61%のスコア
https://x.com/patience_cave/status/2052772581888156128?s=20
```

## 対応URL

- 推奨: `https://USER.github.io/REPO/#data=...`
- 互換: `https://USER.github.io/REPO/?title=タイトル&desc=説明&u=https%3A%2F%2Fx.com%2F...`
- 短縮互換: `https://USER.github.io/REPO/?https://x.com/user/status/123&https://example.com/article`

X の投稿 URL は埋め込み表示し、埋め込みに失敗しても元リンクを残します。X 以外の URL は通常リンクカードとして表示します。
画像 URL と Markdown 画像記法（`![説明](./assets/example.png)`）はニュース項目内に横幅いっぱいで表示します。
