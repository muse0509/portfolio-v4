# Portfolio V4

エンジニア採用に向けて、菊田佑輔の開発実績、担当範囲、設計上の判断を伝える日本語のポートフォリオ・技術ブログを目指すリポジトリです。Solana・DeFiの経験を中心に紹介します。プロフィールと実績はコードで管理し、ブログ記事は将来自作する管理画面とDBで管理します。

現在は既存の **Next.js / OpenNextアプリを `apps/web` に配置したpnpm workspace** です。`apps/api` にHono / D1 / Drizzleの接続基盤と、Better Auth / Passkeyによるローカル管理者認証を実装しています。ホーム `/`、実績 `/works`、問い合わせAPI `/api/contact` は維持しています。管理者向けパスキー一覧・追加・削除と操作ごとの再認証APIも備えています。問い合わせフォームUI、ブログ、管理画面、全パスキー紛失時の復旧は未実装です。

## 現在の構成

```text
apps/web/
  src/app/                 App Router、metadata、robots、問い合わせAPI、認証API転送
  src/content/             プロフィール・実績・表示文言とunit test
  public/                  既存の画像・動画
  package.json             Web依存関係とアプリ用コマンド
  AGENTS.md                Next.js固有の作業案内
  next.config.ts           Next.js設定
  open-next.config.ts      OpenNext設定
  wrangler.jsonc           Workerとassetsの設定
  .env.example             Next.js向け環境変数サンプル
  .dev.vars.example        ローカルWorker向け環境変数サンプル
apps/api/
  src/                     Hono、Drizzle接続、管理者認証と生成スキーマ
  migrations/              認証・複数パスキー・管理操作の追加マイグレーション
  scripts/local-auth.ts    ローカルsecret準備と初回登録許可の発行
  tests/                   ローカルWorker・D1・認証の検証
  wrangler.jsonc           API WorkerとローカルD1の設定
  cloudflare-env.d.ts      Wranglerで生成したbinding・runtime型
e2e/                       Playwright smoke testとテスト専用認証fixture
playwright.config.ts       E2E設定と開発サーバー起動
playwright.auth.config.ts  認証用E2E設定（記録用のtrace・画像・動画は無効）
.github/workflows/         リポジトリ全体のCI
docs/                      要件、デザイン履歴、問い合わせ設計
package.json               workspace共通コマンドとE2E用依存関係
pnpm-workspace.yaml        apps/*、packages/* と依存保護設定
pnpm-lock.yaml             リポジトリ全体で単一のlockfile
```

TypeScript・ESLint・Vitest・PostCSSのWeb設定と型定義は `apps/web`、APIの設定は `apps/api` にあります。ルートのTypeScript・ESLint設定は、`e2e` とPlaywright設定を検査対象に残すためのものです。pnpmの共有依存から参照されるReact型がリポジトリ外の旧版へ解決されないよう、既存と同じ `@types/react` 19.3.0をルートにも配置しています。`packages/contracts` とoRPCは未導入です。

Node.js **24.19.0**、pnpm **11.22.0** を使用します。現在のアプリはNext.js App Router、React、strict TypeScript、Tailwind CSS、Motion、OpenNext、Wrangler、Vitestで構成され、E2EにはPlaywrightを使用します。APIはHono 4.13.14、Drizzle ORM 0.45.4、Better Auth・Passkeyプラグイン・Drizzle adapter 1.7.12を使用し、生成CLIは `auth` 1.7.12とDrizzle Kit 0.31.11に固定しています。依存バージョンは各 `package.json` と単一lockfileで管理します。`minimumReleaseAge`、`minimumReleaseAgeStrict`、`minimumReleaseAgeIgnoreMissingTime`、`trustLockfile`、`overrides`、`allowBuilds` の保護設定も維持します。

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

### ローカルAPIとの接続確認

2つのターミナルで、ルートからそれぞれ `pnpm dev:api`（127.0.0.1:8787）と `pnpm dev`（Next.js、localhost:3000）を起動します。`GET http://localhost:3000/api/health/backend` が `200 {"status":"ok"}` なら、WebのService Binding → Hono → Drizzle → ローカルD1の読み取り確認が成功しています。API停止・DB障害・不正な上流応答では503を返します。

OpenNextのビルド済みWorkerを確認する場合は、APIを起動したまま `pnpm build:worker` の後、別ターミナルで `pnpm dev:worker --port 8788` を実行し、`GET http://localhost:8788/api/health/backend` を確認します。Next.js開発サーバーとは別の実行方式です。Service BindingはAPI Worker名 `portfolio-v4-api` で解決し、通常のHTTP転送先は設定しません。

D1はAPIだけにバインドし、healthでは `SELECT 1` による読み取り確認を行います。認証用に `user`、`session`、`account`、`verification`、`passkey`、`bootstrap_grant`、`passkey_operation` の7テーブルがあります。ユーザーとパスキーは1対多で、credential IDは全ユーザーを通して一意です。初回マイグレーション適用済みのDBにも、`pnpm db:migrate:local` で未適用の追加マイグレーションを適用してください。`0001_multiple_passkeys.sql` はユーザー単位の一意インデックスだけを削除し、`0002_passkey_operations.sql` は管理操作の許可テーブルを追加します。既存データ、主キー・外部キー、検索用インデックスを保持します。DBの削除・初期化は不要です。ローカル状態は `apps/api/.wrangler/` に保存され、Git管理対象外です。DB IDはローカル用のダミー値で、リモートDBは未作成です。APIの `workers_dev` / `preview_urls` は無効、公開ルートは未設定ですが、未デプロイのため本番の到達性は未検証です。

### ローカル管理者認証

ルートから次の順に実行します。

```bash
pnpm auth:setup:local
pnpm db:migrate:local
pnpm auth:issue:local
```

`setup` は `apps/api/.dev.vars` がない場合だけランダムsecretを0600権限で作成し、既存ファイルを上書きしません。`issue` はサーバー設定の `ADMIN_USER_ID` に対する初回登録許可を発行し、`apps/api/.wrangler/registration-permit.txt` のパスだけを表示します。許可の原文は0600権限のこのファイル、DBにはハッシュだけを保存します。どちらのファイルもGit管理対象外です。原文をURL、コマンド引数、ログ、報告へ転記しないでください。

同じローカルDBへの `issue` は直列に実行してください。同時実行ではDBの再発行順序と許可ファイルの保存順序が逆転し、ファイルに無効な許可が残る可能性があります。この場合も登録は拒否されます。すべての発行処理が終了してから、改めて1回だけ再発行してください。

登録許可は10分で失効し、未使用なら再発行で以前の許可が無効になります。初回パスキー1本の保存と許可の消費はD1バッチで一体化し、消費更新が0件でもキーだけが確定しないようSQL内で検査します。登録完了は `bootstrap_grant.consumed_at` / `credential_id` に保持し、将来パスキーを削除してもこの記録を消去して初回登録を再開させない設計です。保存・消費後にセッション作成やログインが失敗した場合は通常のログインを再試行します。複数の保存済みパスキーによるログインには対応しますが、初回登録経路での追加登録と消費済み許可の再発行はできません。予備キーの管理には以下の専用APIを使います。全紛失時の復旧は未実装です。

管理APIは同一Origin・有効な管理者セッションを必要とし、Web → 固定Service Binding → API → D1を通ります。Better Auth標準の一覧・削除・名前変更経路は公開しません。一覧は `id`、`name`、`createdAt` のみを返します。

| 経路 | 入力・用途 |
| --- | --- |
| `GET /api/admin/passkeys` | 登録済みキーの一覧 |
| `POST /api/admin/passkeys/reauth/options` | `{operation: "add"}` または `{operation: "delete", passkeyId}`。`{operationId, options}` を返す |
| `POST /api/admin/passkeys/reauth/verify` | `{operationId, response}`。既存キーによる新しいWebAuthn認証を検証 |
| `POST /api/admin/passkeys/add/options` | `{operationId}`。追加キーの登録optionsを返す |
| `POST /api/admin/passkeys/add/verify` | `{operationId, response, name?}`。追加キーの保存と許可消費 |
| `POST /api/admin/passkeys/delete` | `{operationId, passkeyId}`。対象キーの削除と許可消費 |

POSTはJSONです。追加・削除は毎回再認証が必要で、通常ログインだけでは許可されません。再認証はUV必須で、ユーザー・セッション・操作・削除対象・チャレンジをサーバー側で結び付けます。`operationId` は検索用の識別子であり、単独では操作できません。秘密の操作許可値は発行しません。再認証がセッション作成まで成功した後、D1で新セッションへ操作を移し、元セッションを失効させてから新Cookieを返します。途中失敗では許可を有効にせず、元セッションを保持します。成功応答を失った場合は通常ログインからやり直してください。

許可は再認証成功から5分間、一つの操作に一回限り有効です。確定時にもセッションと再認証に使ったキーの存在を検査します。削除は対象と異なる残存キーによる再認証を必要とし、最後の1件は削除できません。削除・許可消費・現在以外の管理者セッションの失効を同じD1バッチで確定し、途中失敗や更新0件では全体をロールバックします。追加保存も許可消費と一体です。削除と通常ログインが競合した場合も、セッション保存時に検証済みキーの現存を確認します。初回登録完了記録は変更しません。

期限切れの操作行は一覧取得・再認証開始のたびに最大100件を期限順に削除し、セッション削除でも関連行を削除します。これは保存済みキー数の上限ではありません。呼び出し側は `unauthorized`（401）、`forbidden`（403）、`reauthentication_required` / `permission_expired`（403）、`deletion_not_permitted`（409）、`invalid_request`（400/413/415）、`unavailable`（503）を区別できます。管理画面は未実装です。

認証のローカルURLは **`http://localhost:8788`、RP IDは `localhost`** に固定しています。`pnpm dev:api` と、`pnpm dev --port 8788` またはビルド後の `pnpm dev:worker --port 8788` を別ターミナルで起動します。通常の `pnpm dev`（3000番）では上記healthの疎通を確認し、認証は8788番で検証してください。セッションはローカル検証用に8時間、更新間隔1時間、cookie cache無効で、チャレンジは固定版プラグインの既定値5分です。本番向けHTTPS / Secure Cookieの設定分岐はありますが、本番ドメインは未確定・未検証です。

初回登録・ログイン・再認証・予備キー追加/削除・ログアウトのブラウザ操作は、`pnpm build:worker` の後に `pnpm test:e2e:auth` で確認します。8788番を空けて実行してください。テストは独立したローカルWorker・D1とChromiumの仮想認証器を使います。操作用ページはPlaywright内だけのfixtureで、公開画面や本番ビルドに認証検証画面・管理画面は追加していません。

## ルートから実行するコマンド

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | Next.js開発サーバー |
| `pnpm dev:api` | Hono APIをローカルWorkerとして起動 |
| `pnpm dev:worker --port 8788` | ビルド済みOpenNext Workerをローカル起動 |
| `pnpm build` | Next.js production build |
| `pnpm build:worker` | OpenNext Worker build |
| `pnpm build:api` | API Workerのローカルビルド（dry-run、アップロードなし） |
| `pnpm start` | Next.js production server |
| `pnpm lint` | Web・API・ルートのE2E関連コードを検査 |
| `pnpm typegen` | WebのNext.js route type生成 |
| `pnpm typecheck` | Webのroute type生成、APIの生成型確認、Web・API・ルートE2Eの型検査 |
| `pnpm test` | WebのVitest unit test |
| `pnpm test:api` | APIのエラー処理と実ローカルD1を検証 |
| `pnpm test:integration` | ビルド済みWeb/APIのService BindingとD1を検証（先に `pnpm build:worker`） |
| `pnpm test:e2e` | ルートのPlaywright smoke test |
| `pnpm test:e2e:auth` | テスト専用fixtureで認証のブラウザ操作を検証（先に `pnpm build:worker`） |
| `pnpm auth:setup:local` | 未作成の場合だけAPIのローカルsecretを準備 |
| `pnpm auth:issue:local` | 設定済み管理者の初回登録許可をファイルへ発行 |
| `pnpm auth:schema:generate` | 固定版auth CLIと共有設定から認証スキーマを再生成 |
| `pnpm db:generate` | Drizzleスキーマからマイグレーションを生成 |
| `pnpm db:migrate:local` | APIのローカルD1へ未適用マイグレーションを適用 |
| `pnpm check` | lint・型・Web/APIテスト・両Worker build・Worker間接続テスト（E2Eは別途実行） |
| `pnpm preview` | Worker build後のローカルpreview |
| `pnpm deploy` | Worker buildとdeploy（明示的な実行指示がある場合のみ） |
| `pnpm cf-typegen` | `apps/web/cloudflare-env.d.ts` のCloudflare binding型生成 |
| `pnpm cf-typegen:api` | `apps/api/cloudflare-env.d.ts` のCloudflare binding・runtime型生成 |

Web用コマンドは `pnpm --filter @portfolio-v4/web ...` に明示的に委譲します。例えば `pnpm dev --hostname 127.0.0.1 --port 3100` は引数をWebの開発サーバーへ渡します。検査を分ける場合は `pnpm lint:web` / `pnpm lint:e2e`、`pnpm typecheck:web` / `pnpm typecheck:e2e` を使います。

初回のE2E実行前にChromiumがなければ、ルートで `pnpm exec playwright install chromium` を実行します。Playwrightはルートを作業ディレクトリとして `pnpm dev --hostname 127.0.0.1 --port 3000` を起動します。CIもルートからinstall・各検査・Worker build・E2Eを実行します。

APIのみの検査は `pnpm lint:api` / `pnpm typecheck:api` を使います。API・Worker間接続テストはWranglerのローカルtest harnessを利用し、テスト用D1は永続化しません。実メール送信、リモートD1接続、リモートマイグレーションは行いません。

## 開発中の検索除外と検証

- `apps/web/src/app/robots.ts`: すべてのクローラーに `/` を拒否
- `apps/web/src/app/layout.tsx`: metadataで `noindex, nofollow`

開発中は両方を維持します。本番公開直前のレビュー後に**両方を同時に解除**し、片方だけの解除はしません。

変更時は `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test:e2e`、`pnpm test:e2e:auth` をルートから実行し、認証とUI・メディア・モバイルメニュー・問い合わせAPIの既存動作を確認します。既存テストが対象にしている動作と照合し、テスト対象外の動作や、ネットワーク・ブラウザ不足などで実行できなかった検査は未検証として記録します。過去の検証結果は今回の結果と区別します。検証のためにテストを無効化したりUIやフォントを変更したりしません。

## Cloudflareと生成物

`apps/web/wrangler.jsonc` と `apps/web/open-next.config.ts` を使用します。Web用コマンドは `apps/web` で実行され、Workerは `apps/web/.open-next/worker.js`、assetsは `apps/web/.open-next/assets` に生成されます。Wrangler設定内の `.open-next/...` はアプリ基準の相対パスを維持しています。Next.jsのファイル追跡ルートにはリポジトリルートを指定しています。`.next`、`.open-next`、`.wrangler` などの生成物と秘密情報はGit管理しません。

今回、Cloudflareなどの外部設定は変更しません。後日のデプロイ前に、外部ビルド設定を次の配置に合わせて確認・更新してください。

- installとbuildの作業ディレクトリ: リポジトリルート
- install: `pnpm install --frozen-lockfile`、Worker build: `pnpm build:worker`
- Wrangler設定: `apps/web/wrangler.jsonc`（直接実行する場合は `apps/web` を作業ディレクトリにする）
- 生成物・assetsの参照先: `apps/web/.open-next/`
- 本番の環境変数・secret: 既存の対象Workerへの設定を維持し、ファイルには保存しない

`pnpm preview` はWorker環境を使用するため、接続先のbinding設定を確認して実行してください。deploy、push、PR作成、ブランチ操作、コミットはユーザーの明示指示がある場合にだけ行います。

## 今後の構成と作業順

以下は**将来の全体構成の方針**です。Hono・D1・Drizzle、Web/API間Service Binding、Better Auth / Passkeyの管理者認証はローカル基盤として実装しています。Next.js / OpenNext、pnpm workspace、問い合わせAPIを維持し、フロントエンド移行・管理画面・ブログ・認証の復旧機能は未実装です。

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

公開ページのSSRは将来実装する要件です。TanStack RouterをTanStack Startに読み替えず、実装方式は後続で検証します。pnpm・ESLint・Vitestなどの既存ツールを維持し、Turborepo・Lefthook・Oxlint・Oxfmtは今回導入しません。Bun移行や開発ツールの入れ替えは、バックエンド基盤の検証を始める前提条件ではありません。`packages/contracts` は導入時まで作成しません。

作業順は **リポジトリ整理（実施済み）→ バックエンド基盤と認証の検証 → ブログAPI → フロントエンド実装** です。現在はローカルの接続・管理者認証・再認証付きパスキー管理API・認証スキーマと追加マイグレーションまでを実装しています。本番設定と復旧方針は後続の検討事項です。見た目は画像生成で複数案を比較し、仕様を確定してから実装します。

## 文書の位置づけ

現在の配置・実行手順はこのREADME、作業上の制約は [AGENTS.md](AGENTS.md) を参照してください。詳細設計・調査・作業記録はリポジトリ外で管理します。既存 [アーキテクチャ方針](docs/architecture.md) と以下の資料は過去の記録として保持し、今回のAPI・認証追加は反映していません。Next.jsを変更する際は [apps/web/AGENTS.md](apps/web/AGENTS.md) と、その配下のインストール済みNext.jsガイドを読みます。

- [初期要件 v0.1](docs/requirements-v0.1.md): 過去の業務委託向け方針と初期基盤の履歴
- [UI画像生成ワークフロー](docs/ui-image-workflow.md): 既存案の検討履歴と、再設計時にも使用する比較手順
- [Product Cinema仕様](docs/design/concepts/product-cinema/DESIGN_SPEC.md) / [実装記録](docs/design/concepts/product-cinema/IMPLEMENTATION_NOTES.md): 今回維持する既存UIの資料
- [問い合わせセキュリティ設計](docs/contact-security.md): 現在の問い合わせAPIの仕様
- [Workspace整理の検証記録](docs/workspace-migration.md): 移動前後の検証結果、解消した問題、未実施の外部検証
- [パッケージ管理の決定と調査履歴](docs/package-manager-migration.md): 2026-10-26のpnpm継続採用決定と、2026-10-24のBun 1.4.4調査・pnpm検証記録

過去の要件・デザイン資料は削除せずに残します。`apps/web/public` 配下の素材READMEにある旧 `public/...` 表記は、リポジトリルートからは `apps/web/public/...` と読み替えてください。公開URLの `/images/...`、`/media/...` は変わりません。
