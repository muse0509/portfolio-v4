# Workspace整理の検証記録

> 現行方針の参照（2026-10-26）: リポジトリ整理は実施済みで、未コミット差分を保持しています。パッケージ・workspace管理は [pnpm継続採用を正式決定](package-manager-migration.md) しました。以下は当時の作業・検証記録であり、Bun等のツール移行を次工程の前提にはしません。

実施日: 2026-10-21。Node.js 24.19.0 / pnpm 11.22.0。

開始時のブランチは `dependabot/npm_and_yarn/production-dependencies-3f5870b145`、作業ツリーに未コミット変更はありませんでした。ブランチ操作、コミット、push、PR作成、外部設定変更、デプロイは行っていません。

## 検証結果

各コマンドをリポジトリルートから実行しました。

| 検証 | 移動前 | 移動後 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 成功 | 成功 |
| `pnpm lint` | 成功 | Web・ルートE2Eとも成功 |
| `pnpm typecheck` | 成功 | Web・ルートE2Eとも成功 |
| `pnpm test` | 5ファイル・39件成功 | 同じ5ファイル・39件成功 |
| `pnpm build:worker` | 成功 | monorepoと `apps/web` を認識し成功 |
| `pnpm test:e2e` | 16件成功 | 同じ16件成功 |
| `pnpm build` | Worker build内でNext build成功 | 単独コマンドでも成功 |

既存E2Eで `/`、`/works`、画像・動画、各画面幅、モバイルメニュー、reduced motion、metadataのnoindexを確認しました。生成された両ページのnoindexと `robots.txt` の `Disallow: /` も確認しました。問い合わせ処理は既存のfetchモックを使ったunit testで検証し、実メール送信は行っていません。テストの追加・変更・無効化はありません。

## 設定と差分の確認

- ルートの `e2e/home.spec.ts` と `playwright.config.ts` がESLintのTypeScriptルールおよびTypeScriptの検査対象であることを設定APIで確認。
- `pnpm dev --help`、`pnpm build --help`、`pnpm test --help` とテストファイル指定の実行でWebへの引数転送を確認。E2Eのサーバー起動でもhostname・portの転送を確認。
- `pnpm start --hostname 127.0.0.1 --port 31847` で通常ビルドを起動し、`/` と `/works` の200応答・noindex、`robots.txt` の検索除外を確認。確認後はサーバーを停止。
- 移動した `src`、`public`、環境変数サンプル、Cloudflare型など50ファイルが元のファイルとバイト単位で一致。表示内容、問い合わせAPI、メディアは変更なし。
- 依存のspecifier、Node.js・pnpmバージョン、保護設定は不変。lockfileはimporterの分割だけで、`packages` と `snapshots` の解決結果は不変。
- WranglerのWorker・assets参照先が `apps/web/.open-next` 内の生成物に解決され、主要画像・動画が元のpublicファイルと一致。
- アプリ配下の生成物、`.env.local`、`.dev.vars`、`.dev.vars.*` がignore対象。lockfileはルートの1つだけ。`apps/api`・`packages/contracts` の空ディレクトリや仮実装は追加していない。

## 問題と未実施事項

移動前の検証に失敗はありませんでした。シェル既定のNode.jsは22でしたが、既存の指定バージョン24.19.0を選択してすべて検証しました。

移動直後の型検査では、Motionの型がリポジトリ外のReact 18型へ解決されて失敗しました。ルートにも既存の `@types/react` 19.3.0を残すことで、共有依存からの参照をReact 19型へ揃えて解消しました。アプリコードや検査の厳密さは変更していません。

ネットワーク・フォント取得・ブラウザ不足による未検証項目はありません。GitHub Actionsのホスト上での実行、本番Cloudflare環境、実Turnstile・Resendへの接続は未検証です。これらの外部実行・設定変更は今回の範囲外です。

後日の外部ビルド設定では、ルートでworkspace installとWorker buildを実行し、Wrangler設定を `apps/web/wrangler.jsonc`、生成物を `apps/web/.open-next/` に合わせてください。詳細は [READMEのCloudflare設定](../README.md#cloudflareと生成物) を参照してください。

今回のローカル構成に残る阻害要因はなく、次のバックエンド基盤・認証検証へ進める状態です。

---

## 2026-10-24: 設定・将来方針の追加整理

上段は2026-10-21の作業記録です。以下は今回あらためて実行した確認と検証の記録であり、過去の結果を流用していません。

### 作業開始時の状態

- 作業ディレクトリは `portfolio-v4`、ブランチは `dependabot/npm_and_yarn/production-dependencies-3f5870b145`、HEADは `f450b51`。既存のworkspace移行・文書更新を含む未コミット差分があり、その内容を引き継ぎました。
- Next.js / OpenNextは `apps/web`、E2E・CI・単一lockfileはルートに配置済みでした。`apps/api` と `packages/contracts` は未作成でした。
- ルートにも `next.config.ts` が存在しました。README・AGENTS等には将来のReact Router Framework Mode、PostgreSQL、Hyperdriveという旧案が残っていました。
- ローカルの指定値どおりNode.js 24.19.0 / pnpm 11.22.0を使用しました。GitHubの内容でローカルを置き換える操作はしていません。

### 今回追加した変更

ルートの `next.config.ts` を削除しました。このファイルはGitで追跡され、作業ファイル・index・HEADが同一で、固有の未コミット変更はありませんでした。`apps/web/next.config.ts` はその全設定（OpenNext開発初期化と `devIndicators: false`）を維持し、workspaceを対象とする `outputFileTracingRoot` を追加した内容でした。ルート設定へのimportや明示参照はなく、Webコマンド・Playwright・CIは `apps/web` の実行へ委譲しています。ビルド結果の `appDir` と設定値でもアプリ側が使用されることを確認し、アプリ側は変更していません。

READMEと両AGENTSを更新し、[アーキテクチャ方針](architecture.md) を追加しました。現行Next.js / OpenNext / pnpmと、将来のReact + TanStack Router、Hono、oRPC、D1、Drizzle、Better Auth + Passkey等を区別しています。公開SSR・Worker分離・Service Binding・非公開R2・Images bindingは将来の方針です。Bun等の開発ツール移行は未実施で、Better T Stackの生成処理も実行していません。旧要件・デザイン資料は履歴として残し、現行方針への参照を加えました。

そのほかの設定には修正が必要な不整合はなく、依存配置・バージョン・lockfile・pnpm保護設定・CI・テスト設定を維持しました。ルートにもある `@types/react` 19.3.0は、Motionから同じリポジトリ内の型へ解決されることを確認して残しています。

### 今回の変更前後の検証

すべてリポジトリルートから実行しました。問い合わせテストのfetchモックを確認してから実行し、デプロイや実メール送信は行っていません。

| 検証 | 今回の変更前 | 今回の変更後 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 成功 | 成功 |
| `pnpm lint` | Web・ルートとも成功 | Web・ルートとも成功 |
| `pnpm typecheck` | route型生成・Web・ルートとも成功 | route型生成・Web・ルートとも成功 |
| `pnpm test` | 5ファイル・39件成功 | 5ファイル・39件成功 |
| `pnpm build:worker` | 成功 | 成功 |
| `pnpm test:e2e` | 16件成功 | 16件成功 |

今回の件数は前回と同じでした。テストは追加・変更・無効化していません。通常のNext.jsビルドはWorker build内で実行されました。

- 既存E2Eの対象を照合し、`/`、`/works`、画像・動画、画面幅ごとのレイアウト、モバイルメニュー、reduced motion、トップのmetadata noindexを検証しました。問い合わせ処理はunit testのモックによる検証であり、本番メール配送の確認ではありません。
- ビルド済みの両ページのnoindex、`robots.txt` の `Disallow: /`、WranglerのWorker・assets参照先と主要画像・動画の一致を別途確認しました。
- `e2e/home.spec.ts` と `playwright.config.ts` がESLintのTypeScriptルールとルート型検査の対象であることを、変更前後で確認しました。
- `pnpm dev/build/start/typegen/test --help` をそれぞれ実行して引数転送を確認しました。E2E起動ログでもhostname・portがWebへ渡されることを確認しました。
- TypeScriptのaliasと生成型、Vitestの相対import・対象・cwd、OpenNextの出力、Wranglerの型生成先、CIのルート実行、環境変数サンプルの配置を確認しました。アプリ用環境変数は `apps/web/.env.local` / `.dev.vars` を使用し、実値ファイルは表示・コピーしていません。
- 今回の開始時との比較で、アプリ・素材・テスト・依存関係・CI・関連設定の64ファイルがバイト単位で不変でした。lockfileも全文が不変です。アプリ個別lockfile、別パッケージ管理ツールのlockfile、空のAPI/contracts、生成物や秘密情報は今回の差分に追加していません。

### 残る確認と次工程

今回の変更前後とも検証失敗はなく、ネットワーク・フォント・ブラウザ不足による未実施項目はありません。GitHub Actionsのホスト上での実行、Cloudflare本番環境、実Turnstile・Resendへの接続は今回も未検証です。将来の構成・認証・SSRの互換性を、今回の既存Next.jsアプリの検証結果から確認済みとは扱いません。

Cloudflare側の外部設定は変更していません。既存アプリの移動を反映する際は、ルートで `pnpm install --frozen-lockfile` と `pnpm build:worker` を実行し、Wrangler設定を `apps/web/wrangler.jsonc`、生成物を `apps/web/.open-next/` に合わせる必要があります。将来のWeb/API Worker分離、Service Binding、D1・非公開R2・Images bindingの作成・設定は後続工程です。

ローカル構成に次工程を妨げる問題はありません。バックエンド基盤・認証検証では、依存の互換性、D1とDrizzle・Better Auth + Passkeyの連携、Service Bindingを介したセッション・origin・cookie・パスキーのドメイン条件を確認し、未決定事項を仕様化する準備が必要です。検証項目は [アーキテクチャ方針](architecture.md) にまとめています。数値条件や外部bindingの具体値は今回決めていません。

ブランチとHEAD、既存の作業差分を保持し、コミット・push・PR作成をせず終了します。今回の完了からバックエンド・フロントエンド実装へ自動的には進みません。
