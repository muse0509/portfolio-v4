# Portfolio V4

業務委託案件の獲得を目的とする、日本語の個人ポートフォリオです。「事業を理解し、0→1を実装まで持ち切るフルスタックエンジニア」を軸に、TypeScript / React / Next.jsを中心とした実装力と、Solana / Web3の専門性を伝えます。

現在は実装基盤の段階です。最終UI、問い合わせフォーム、Axisケーススタディ本文は、UIコンセプトの比較・採用後に実装します。

## 技術スタック

- Node.js 24.19.0 / pnpm 11.22.0
- Next.js 16.3.2 / React 19.2.8 / TypeScript 5.9.3
- Tailwind CSS 4.3.3 / Motion 13.1.1
- OpenNext for Cloudflare 1.20.2 / Wrangler 4.125.0
- ESLint 9.39.5 / Vitest 4.1.11 / Playwright 1.62.1

Next.js 16はOpenNextのサポート対象です。OpenNext 1.20.2が要求する `next >=16.2.11` と `wrangler ^4.86.0` の範囲内で固定しています。React Compilerは有効化していません。

## セットアップ

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

ローカルWorker環境変数が必要になった場合のみ、`.dev.vars.example` を `.dev.vars` にコピーしてください。実値を含む `.env*` と `.dev.vars` はコミットしません。

## コマンド

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | Next.js開発サーバー |
| `pnpm build` | Next.js production build |
| `pnpm build:worker` | OpenNext Worker build |
| `pnpm start` | Next.js production server |
| `pnpm lint` | ESLint |
| `pnpm typegen` | Next.js route type生成 |
| `pnpm typecheck` | route type生成後のTypeScript検証 |
| `pnpm test` | Vitest unit test |
| `pnpm test:e2e` | Playwright smoke test |
| `pnpm check` | lint・型・unit・Worker build |
| `pnpm preview` | Worker build後のローカルpreview |
| `pnpm deploy` | Worker buildとdeploy（今回は未実行） |
| `pnpm cf-typegen` | Cloudflare binding型生成 |

初回のE2E実行前は、ローカルChromiumがなければ `pnpm exec playwright install chromium` を実行します。

## ディレクトリ

```text
src/app/                  App Router、metadata、robots、global CSS
src/content/              サイト文言とunit test
e2e/                      Playwright smoke test
docs/                     要件、UI画像、問い合わせ設計
public/images/concepts/   生成するUIコンセプト候補
public/images/product/    検証済みの実在プロダクト画像
```

## 開発中の検索除外

開発中は二重に検索公開を防いでいます。

- `src/app/robots.ts`: すべてのクローラーに `/` を拒否
- `src/app/layout.tsx`: metadataで `noindex, nofollow`

本番公開時は、公開直前レビューを行ったうえで**両方を同時に解除**してください。片方だけの解除は禁止です。

## Cloudflare

`wrangler.jsonc` と `open-next.config.ts` はCloudflare Workers向けです。`pnpm preview` と `pnpm deploy` は外部状態を変え得るため、意図を確認してから使用してください。このfoundation作業ではdeployしません。

## 仕様

- [要件 v0.1](docs/requirements-v0.1.md)
- [UI画像生成ワークフロー](docs/ui-image-workflow.md)
- [問い合わせセキュリティ設計](docs/contact-security.md)

次工程は、UI要件を固定し、PC・モバイルのコンセプト画像を3方向生成することです。
