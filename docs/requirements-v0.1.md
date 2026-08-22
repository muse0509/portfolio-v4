# Portfolio V4 要件 v0.1

更新日: 2026-08-23

## 目的

業務委託案件の獲得につながる日本語ポートフォリオを構築する。主なポジショニングは「事業を理解し、0→1を実装まで持ち切るフルスタックエンジニア」。HeroではFull-Stack Engineerを主軸とし、TypeScript / React / Next.jsを中心に見せる。Solana / Web3は強い差別化要素として扱うが、Web3専用サイトにはしない。

## 今回の範囲

- Next.js App Router、strict TypeScript、Tailwind CSS 4の実装基盤
- Cloudflare Workers向けOpenNext / Wrangler構成
- Foundation page、content分離、開発中の検索除外
- Vitest / Playwright / GitHub Actions / Dependabot
- UI画像生成と問い合わせ機能の設計文書

今回、最終UI、問い合わせフォーム、Axisケーススタディ本文、画像生成、deployは行わない。

## デザイン原則

- Premium Monochrome。ダーク基調のモノトーン、十分な余白、明確な情報階層とタイポグラフィを重視する。
- Appleの製品ページに感じる品質水準を参考にするが、デザインやアセットをコピーしない。
- 過剰なグラデーション、ネオン、ターミナル風UIを避ける。
- Three.js / WebGLを装飾目的で導入しない。
- アニメーションは意味のある状態変化に限定し、`prefers-reduced-motion` に対応する。
- セマンティックHTML、キーボード操作、WCAG AA相当のコントラストを基準にする。

## Homeの将来構成

1. Hero
2. Proof Strip
3. Axis Flagship Case Study
4. Trust Proof
5. Selected Works
6. Capabilities
7. Process
8. About
9. Writing
10. Availability / Contact

## Axisの証拠方針

Axisは最重要ケーススタディとする。現在公開されているDevnet版を実績として扱い、Devnetであり実資金取引ではないことを明記する。UIの証拠には検証済みの実在スクリーンショットだけを使う。生成画像で実在UIを捏造せず、数値は一次資料で出典確認できるまで断定しない。

## 技術要件

- Node.js 24 / pnpm 11
- Next.js App Router / React / strict TypeScript
- Tailwind CSS 4 / Motion for React
- Cloudflare Workers / OpenNext for Cloudflare / Wrangler
- ESLint / Vitest / Playwright
- React Compilerは互換性の裏付けが得られるまで無効
- Zod / Turnstile / Resendは問い合わせ実装時にだけ導入
- Sites、Vinext、Vercel固有構成、shadcn/ui、Three.js、不要な状態管理は現段階で導入しない

## コンテンツ要件

Foundation pageには次を表示する。

- `FULL-STACK ENGINEER / PORTFOLIO V4`
- `構想を、動くプロダクトまで。`
- `事業を理解し、要件定義から設計・実装・改善までを一貫して進めるフルスタックエンジニア。`
- 次工程でUIコンセプト画像を生成することを示す小さなステータス

サイト文言は可能な限り `src/content/site.ts` で管理する。

## 開発・公開要件

- 開発中はrobotsとmetadataの両方で `noindex, nofollow` 相当を維持する。
- 秘密情報、個人メール、問い合わせPIIをリポジトリへ入れない。
- `portfolio_no.3` および兄弟ディレクトリを変更しない。
- foundation段階ではpush、PR、deployを行わない。
- 本番公開前に検索除外を二箇所とも解除し、Axisの表現と証拠を再レビューする。

## 完了条件

lint、型チェック、unit test、OpenNext Worker buildが成功し、Playwright smoke testが存在して可能な環境では成功すること。CIとDependabotが設定され、ドキュメントと実装が一致し、秘密情報や未検証の実績表現を含まず、ローカルコミット後の作業ツリーがクリーンであること。
