# Portfolio V4

エンジニア採用に向けて、菊田佑輔の開発実績、担当範囲、設計上の判断を伝える日本語のポートフォリオ・技術ブログを目指すリポジトリです。Solana・DeFiの経験を中心に紹介します。プロフィールと実績はコードで管理し、ブログ記事は将来自作する管理画面とDBで管理します。

現在は既存の **Next.js / OpenNextアプリを `apps/web` に配置したpnpm workspace** です。ホーム `/`、実績 `/works`、問い合わせAPI `/api/contact` を維持しています。問い合わせフォームUI、ブログ、管理画面、独立したAPIアプリは未実装です。この整理では画面・文言・メディア・アニメーションを変更しません。

## 現在の構成

```text
apps/web/
  src/app/                 App Router、metadata、robots、問い合わせAPI
  src/content/             プロフィール・実績・表示文言とunit test
  public/                  既存の画像・動画
  package.json             Web依存関係とアプリ用コマンド
  AGENTS.md                Next.js固有の作業案内
  next.config.ts           Next.js設定
  open-next.config.ts      OpenNext設定
  wrangler.jsonc           Workerとassetsの設定
  .env.example             Next.js向け環境変数サンプル
  .dev.vars.example        ローカルWorker向け環境変数サンプル
e2e/                       Playwright smoke test
playwright.config.ts       E2E設定と開発サーバー起動
.github/workflows/         リポジトリ全体のCI
docs/                      要件、デザイン履歴、問い合わせ設計
package.json               workspace共通コマンドとE2E用依存関係
pnpm-workspace.yaml        apps/*、packages/* と依存保護設定
pnpm-lock.yaml             リポジトリ全体で単一のlockfile
```

TypeScript・ESLint・Vitest・PostCSSのアプリ設定と型定義も `apps/web` にあります。ルートのTypeScript・ESLint設定は、`e2e` とPlaywright設定を検査対象に残すためのものです。pnpmの共有依存から参照されるReact型がリポジトリ外の旧版へ解決されないよう、既存と同じ `@types/react` 19.3.0をルートにも配置しています。`apps/api` と `packages/contracts` は導入時に作成するため、現時点では存在しません。

Node.js **24.19.0**、pnpm **11.22.0** を使用します。現在のアプリはNext.js App Router、React、strict TypeScript、Tailwind CSS、Motion、OpenNext、Wrangler、Vitestで構成され、E2EにはPlaywrightを使用します。依存バージョンは各 `package.json` と単一lockfileで管理し、この整理では変更しません。`minimumReleaseAge`、`minimumReleaseAgeStrict`、`minimumReleaseAgeIgnoreMissingTime`、`trustLockfile`、`overrides`、`allowBuilds` の保護設定も維持します。

2026-10-26に、**パッケージ管理とworkspace管理にはpnpmを継続採用する**と正式に決定しました。既存のworkspace・CI・依存関係保護設定が整っており、今回のアプリケーションにBun固有の機能を必要としていないためです。単一の `pnpm-lock.yaml` と既存の保護設定を維持します。Bun移行は今後の必須タスクから外し、具体的な必要性が生じた場合だけ任意に再評価します。2026-10-24の「移行保留」という調査結果は、[決定と調査履歴](docs/package-manager-migration.md) に残しています。

## セットアップ

リポジトリのルートで実行します。

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

環境変数が必要な場合は `apps/web/.env.example` を `apps/web/.env.local` へ、ローカルWorker用には `apps/web/.dev.vars.example` を `apps/web/.dev.vars` へコピーします。読み込み位置は `apps/web` です。実値を含むファイルはGit管理せず、ルートにアプリ用環境変数ファイルを置きません。問い合わせ処理の検証には既存のモックを使用し、実メールは送信しません。

## ルートから実行するコマンド

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | Next.js開発サーバー |
| `pnpm build` | Next.js production build |
| `pnpm build:worker` | OpenNext Worker build |
| `pnpm start` | Next.js production server |
| `pnpm lint` | WebとルートのE2E関連コードを検査 |
| `pnpm typegen` | WebのNext.js route type生成 |
| `pnpm typecheck` | Webのroute type生成・型検査とルートE2Eの型検査 |
| `pnpm test` | WebのVitest unit test |
| `pnpm test:e2e` | ルートのPlaywright smoke test |
| `pnpm check` | lint・型・unit・Worker build（E2Eは別途実行） |
| `pnpm preview` | Worker build後のローカルpreview |
| `pnpm deploy` | Worker buildとdeploy（明示的な実行指示がある場合のみ） |
| `pnpm cf-typegen` | `apps/web/cloudflare-env.d.ts` のCloudflare binding型生成 |

Web用コマンドは `pnpm --filter @portfolio-v4/web ...` に明示的に委譲します。例えば `pnpm dev --hostname 127.0.0.1 --port 3100` は引数をWebの開発サーバーへ渡します。検査を分ける場合は `pnpm lint:web` / `pnpm lint:e2e`、`pnpm typecheck:web` / `pnpm typecheck:e2e` を使います。

初回のE2E実行前にChromiumがなければ、ルートで `pnpm exec playwright install chromium` を実行します。Playwrightはルートを作業ディレクトリとして `pnpm dev --hostname 127.0.0.1 --port 3000` を起動します。CIもルートからinstall・各検査・Worker build・E2Eを実行します。

## 開発中の検索除外と検証

- `apps/web/src/app/robots.ts`: すべてのクローラーに `/` を拒否
- `apps/web/src/app/layout.tsx`: metadataで `noindex, nofollow`

開発中は両方を維持します。本番公開直前のレビュー後に**両方を同時に解除**し、片方だけの解除はしません。

変更時は `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test:e2e` をルートから実行し、UI・メディア・モバイルメニュー・問い合わせAPIの既存動作を確認します。既存テストが対象にしている動作と照合し、テスト対象外の動作や、ネットワーク・ブラウザ不足などで実行できなかった検査は未検証として記録します。過去の検証結果は今回の結果と区別します。検証のためにテストを無効化したりUIやフォントを変更したりしません。

## Cloudflareと生成物

`apps/web/wrangler.jsonc` と `apps/web/open-next.config.ts` を使用します。Web用コマンドは `apps/web` で実行され、Workerは `apps/web/.open-next/worker.js`、assetsは `apps/web/.open-next/assets` に生成されます。Wrangler設定内の `.open-next/...` はアプリ基準の相対パスを維持しています。Next.jsのファイル追跡ルートにはリポジトリルートを指定しています。`.next`、`.open-next`、`.wrangler` などの生成物と秘密情報はGit管理しません。

今回、Cloudflareなどの外部設定は変更しません。後日のデプロイ前に、外部ビルド設定を次の配置に合わせて確認・更新してください。

- installとbuildの作業ディレクトリ: リポジトリルート
- install: `pnpm install --frozen-lockfile`、Worker build: `pnpm build:worker`
- Wrangler設定: `apps/web/wrangler.jsonc`（直接実行する場合は `apps/web` を作業ディレクトリにする）
- 生成物・assetsの参照先: `apps/web/.open-next/`
- 本番の環境変数・secret: 既存の対象Workerへの設定を維持し、ファイルには保存しない

`pnpm preview` はWorker環境を使用するため、接続先のbinding設定を確認して実行してください。deploy、push、PR作成、ブランチ操作、コミットはユーザーの明示指示がある場合にだけ行います。今回の成果物は未コミットのレビュー可能な差分です。

## 今後の構成と作業順

以下は**将来の採用方針**です。現在のNext.js / OpenNext、pnpm workspace、問い合わせAPIを維持し、今回これらへの移行や機能実装は行いません。責務・検証事項は [アーキテクチャ方針](docs/architecture.md) を参照してください。

| 項目 | 採用方針 |
| --- | --- |
| 言語・フロントエンド | TypeScript / React + TanStack Router |
| バックエンド・API | Hono / oRPC |
| 認証 | Better Auth + Passkeyプラグイン |
| DB・ORM | Cloudflare D1（SQLite）/ Drizzle ORM |
| 画像保存・変換 | 非公開のCloudflare R2 / Cloudflare ImagesのWorkersバインディング |
| 実行基盤・接続 | Web WorkerとAPI Workerを分離し、WebからAPIへService Bindingで接続 |
| データアクセス | DB・R2・ImagesへのアクセスはAPI Workerに集約 |
| 静的ファイル・ログ | Workers Static Assets / Workers Logs |
| パッケージ・workspace管理 | pnpmを継続採用（現在も導入済み） |
| その他の開発ツール候補 | Turborepo / Lefthook / Oxlint / Oxfmt（いずれも未導入） |
| 初期構成の参考 | Better T Stack（既存リポジトリへの生成処理は実行しない） |

公開ページのSSRは将来実装する要件です。TanStack RouterをTanStack Startに読み替えず、実装方式は後続で検証します。pnpm・ESLint・Vitestなどの既存ツールを維持し、Turborepo・Lefthook・Oxlint・Oxfmtは今回導入しません。Bun移行や開発ツールの入れ替えは、バックエンド基盤の検証を始める前提条件ではありません。`apps/api`、`packages/contracts` の空ディレクトリや仮実装も追加しません。

作業順は **リポジトリ整理（実施済み・未コミット差分あり）→ バックエンド基盤と認証の検証 → ブログAPI → フロントエンド実装** です。今回は文書更新のみで、既存の問い合わせAPIを含むアプリの動作は変更しません。見た目は画像生成で複数案を比較し、トークン・モーションを含む仕様を確定してから実装します。今回の完了後にバックエンドやフロントエンドの実装へ自動的に進みません。

## 文書の位置づけ

現在の目的・構成はこのREADME、将来の採用方針・責務・移行順は [アーキテクチャ方針](docs/architecture.md)、作業上の制約は [AGENTS.md](AGENTS.md) を参照してください。Next.jsを変更する際は [apps/web/AGENTS.md](apps/web/AGENTS.md) と、その配下のインストール済みNext.jsガイドを読みます。

- [初期要件 v0.1](docs/requirements-v0.1.md): 過去の業務委託向け方針と初期基盤の履歴
- [UI画像生成ワークフロー](docs/ui-image-workflow.md): 既存案の検討履歴と、再設計時にも使用する比較手順
- [Product Cinema仕様](docs/design/concepts/product-cinema/DESIGN_SPEC.md) / [実装記録](docs/design/concepts/product-cinema/IMPLEMENTATION_NOTES.md): 今回維持する既存UIの資料
- [問い合わせセキュリティ設計](docs/contact-security.md): 現在の問い合わせAPIの仕様
- [Workspace整理の検証記録](docs/workspace-migration.md): 移動前後の検証結果、解消した問題、未実施の外部検証
- [パッケージ管理の決定と調査履歴](docs/package-manager-migration.md): 2026-10-26のpnpm継続採用決定と、2026-10-24のBun 1.4.4調査・pnpm検証記録

過去の要件・デザイン資料は削除せずに残します。`apps/web/public` 配下の素材READMEにある旧 `public/...` 表記は、リポジトリルートからは `apps/web/public/...` と読み替えてください。公開URLの `/images/...`、`/media/...` は変わりません。
