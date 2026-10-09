# 問い合わせメールのセキュリティ設計

`POST /api/contact` は、将来の `/contact` フォームから受け取った問い合わせを検証し、Resend REST APIで `CONTACT_TO_EMAIL` へ転送するRoute Handlerです。フォームUI、添付ファイル、自動返信、問い合わせ内容の永続化はこの実装に含みません。

## API contract

- Method: `POST`
- Path: `/api/contact`
- Content-Type: `application/json`（charsetパラメータは許可）
- Request Origin: `CONTACT_ALLOWED_ORIGINS` のいずれかと完全一致
- Body上限: UTF-8で10KB。raw textを読み、`TextEncoder` で計測してからJSONをparseする
- Response: JSONのみ、すべて `Cache-Control: no-store`

後続のフォームUIは次のpayloadを送ります。任意項目を使わない場合は省略するか空文字を送れます。空文字はサーバーで省略扱いになります。

```ts
type ContactRequest = {
  name: string; // trim後1〜80文字
  email: string; // 有効なメール形式、最大254文字
  company?: string; // 最大120文字
  category:
    | "product-development"
    | "existing-product"
    | "solana-web3"
    | "engineering-engagement"
    | "speaking-media"
    | "other";
  message: string; // trim後20〜4,000文字
  startTiming?: string; // 最大80文字
  availability?: string; // 最大80文字
  budget?: string; // 最大100文字
  referenceUrl?: string; // http/https、最大2,048文字
  privacyAccepted: true;
  turnstileToken: string; // 最大2,048文字
  website?: string; // honeypot。利用者には入力させない
};
```

成功時とhoneypot検知時は、どちらも `200 { "ok": true }` を返します。失敗時は次の形です。

```json
{
  "ok": false,
  "code": "INVALID_REQUEST",
  "message": "入力内容を確認してください。",
  "fieldErrors": {}
}
```

アプリが返すcodeとstatusは次のとおりです。

| code | status | 用途 |
| --- | ---: | --- |
| `INVALID_CONTENT_TYPE` | 415 | JSON以外 |
| `PAYLOAD_TOO_LARGE` | 413 | 10KB超過 |
| `INVALID_REQUEST` | 400 | JSON parseまたはZod検証失敗 |
| `ORIGIN_REJECTED` | 403 | Origin欠落・不一致・設定不正 |
| `VERIFICATION_FAILED` | 403 | Turnstile失敗・timeout・応答不正 |
| `SEND_FAILED` | 502 | Resendの非2xx・network error・設定不正 |

`RATE_LIMITED` はCloudflare側のrate limiting ruleが返す `429` 用です。アプリ内に共有不能な `Map` や永続ストレージを追加していません。

## 処理順序

1. `Content-Type` を確認する。
2. `Origin` を許可リストと完全一致で照合する。欠落も拒否する。
3. `Content-Length` の明らかな超過を先に拒否し、raw bodyをUTF-8 byte数で再確認する。
4. JSONをparseする。
5. `website` に値があれば外部通信せず擬似成功を返す。
6. Zodのstrict schemaで型、文字数、URL scheme、enum、同意、unknown fieldを検証する。
7. Turnstile Siteverifyでtoken、action、hostnameを検証する。
8. Resend REST APIでplain-textメールを送る。

## OriginとCORS

`CONTACT_ALLOWED_ORIGINS` は、scheme・host・portを含む完全なoriginをカンマ区切りで設定します。ワイルドカード、path、trailing slash、prefix一致は許可されません。

```dotenv
CONTACT_ALLOWED_ORIGINS=https://portfolio.example,https://www.portfolio.example
```

同一originのPOSTを前提とし、ワイルドカードCORS headerは返しません。localhostを使う環境では、必要なoriginを明示的に追加します。

## Turnstile

サーバーは `https://challenges.cloudflare.com/turnstile/v0/siteverify` をJSONのPOSTで呼び出し、次をすべて要求します。

- `success === true`
- `action === "contact"`
- `hostname` が `TURNSTILE_ALLOWED_HOSTNAMES` の完全一致リストに含まれる

後続UIのTurnstile widgetにも必ず `action: "contact"` を設定します。tokenは単回利用で約5分で失効するため、送信失敗後はUI側でwidgetをresetして新しいtokenを取得します。

Cloudflare経由で `CF-Connecting-IP` が存在する場合だけ `remoteip` としてSiteverifyへ渡します。IP、token、secret、Siteverify responseは保存・ログ出力しません。timeout、network error、非2xx、不正JSONはfail closedで `VERIFICATION_FAILED` になります。

## Resend

Resend SDKは使わず、`POST https://api.resend.com/emails` を `fetch` で呼び出します。

- `from`: `CONTACT_FROM_EMAIL`
- `to`: `CONTACT_TO_EMAIL`
- `reply_to`: Zod検証済みの問い合わせ者メール
- `subject`: `[Portfolio] {categoryLabel} — {sanitizedName}`
- `text`: 必須項目と値がある任意項目だけを含むplain text

ユーザー入力を `from` に使いません。件名からCR、LF、制御文字を除去し、2xxだけを成功として扱います。provider response body、API key、stack traceは利用者へ返しません。HTML、自動返信、添付ファイルは送信しません。

本番前にResendで `CONTACT_FROM_EMAIL` の送信元domainを認証します。Resendが案内するSPFとDKIMのDNS recordを登録し、検証完了を確認してください。DMARCも送信domainの運用方針に合わせてDNSへ設定し、最初はレポートを確認できるpolicyから段階的に強化します。`CONTACT_TO_EMAIL` はコードへ書かず、Cloudflareのsecretとして設定します。

## Rate limit

rate limitはリポジトリ内には実装しておらず、公開前にCloudflare WAFのrate limiting ruleとして設定します。Worker内 `Map`、KV、D1、R2、Durable Objectsは使用しません。

初期設定候補:

- Expression: `http.request.uri.path eq "/api/contact" and http.request.method eq "POST"`
- Counting characteristic: source IP
- Threshold: 10分間に5回
- Action: Block、status `429`
- 利用中のCloudflare planがcustom responseを許可する場合のbody:

```json
{
  "ok": false,
  "code": "RATE_LIMITED",
  "message": "送信回数が多すぎます。時間をおいて再度お試しください。",
  "fieldErrors": {}
}
```

custom responseのContent-Typeは `application/json`、可能なら `Cache-Control: no-store` も設定します。Cloudflare planで10分windowやcustom bodyを設定できない場合は、利用可能な最も近いwindowを採用し、公開前のsecurity reviewで差分を記録します。ルールはCloudflare dashboardまたは別管理のIaCで適用し、実際に有効になったことを429で確認するまで「実装済み」と扱いません。

## 環境変数

| 変数 | 公開範囲 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | browserへ公開 | 後続UIのwidget site key。build時に設定 |
| `TURNSTILE_SECRET_KEY` | secret | Siteverify secret |
| `TURNSTILE_ALLOWED_HOSTNAMES` | server | 許可hostnameのカンマ区切り完全一致リスト |
| `CONTACT_ALLOWED_ORIGINS` | server | 許可originのカンマ区切り完全一致リスト |
| `RESEND_API_KEY` | secret | Resend API key |
| `CONTACT_TO_EMAIL` | secret | 問い合わせ配送先 |
| `CONTACT_FROM_EMAIL` | server | Resendで認証済みの送信元 |

`.env.example` と `.dev.vars.example` にはダミー値だけを置きます。ローカルの `next dev` ではignore対象の `.env.local`、OpenNextのローカルWorkerではignore対象の `.dev.vars` へコピーして実値または各providerのtest値へ置き換えます。本番のsecretはCloudflare dashboardまたは `wrangler secret put` で設定し、ファイル、Git、client bundleへ含めません。`NEXT_PUBLIC_` をsecretへ付けてはいけません。

## データとログ

問い合わせ本文、氏名、メール、会社名、IPはDB、KV、D1、R2、Durable Objects、アプリログ、analyticsへ保存しません。配送処理中のメモリとResendへのrequestにだけ存在します。このRoute Handlerは問い合わせpayload、IP、token、provider responseをログ出力しません。Resend側の保持とアクセス権限はResendの設定・契約に従うため、本番運用時に別途確認します。

## ローカル開発と検証

unit testではTurnstileとResendの `fetch` をmockし、実ネットワークや実メール送信を行いません。

1. `.env.example` を `.env.local` へ、必要なら `.dev.vars.example` を `.dev.vars` へコピーする。
2. ダミー値をCloudflare Turnstileのtest key、localhost hostname、Resendの安全なtest設定へ置き換える。
3. `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm build:worker`、`pnpm test:e2e` を実行する。

## Production smoke test

公開前にYusuke本人が次を確認します。実在する第三者の個人情報は使いません。

1. Resendの送信domain認証、SPF、DKIM、DMARCを確認する。
2. Cloudflareへ全環境変数とsecretを設定し、`CONTACT_ALLOWED_ORIGINS` と `TURNSTILE_ALLOWED_HOSTNAMES` を本番値だけにする。
3. Turnstile widgetのactionが `contact` であることを確認する。
4. Cloudflare WAF rate limitを有効化する。
5. 本番フォームから専用のtest問い合わせを1件送り、受信、件名、plain-text本文、Reply-Toを確認する。
6. Origin欠落・不一致、期限切れまたは再利用token、10KB超過、6回目の連続送信がそれぞれ403、413、429になることを確認する。
7. Cloudflareとアプリのlogに氏名、メール、本文、IP、secret、tokenが出ていないことを確認する。
