# 問い合わせセキュリティ設計

この文書は将来の `/contact` 実装方針です。現在はRoute Handler、フォーム、Zod、Turnstile、Resendを実装・導入しません。

## 予定項目

- 氏名
- 会社名／所属
- メール
- 問い合わせ種別
- 相談内容

必要最小限の項目だけを受け取り、任意項目を明示する。自動入力属性、ラベル、インラインエラー、エラー後の入力保持を用意する。

## 処理フロー

1. `/contact` のフォームから同一originのRoute HandlerへPOSTする。
2. `Content-Type` とContent-Lengthを確認し、許容body sizeを超える要求を読み込む前に拒否する。
3. `Origin` を正規化済みの許可originと完全一致で照合する。欠落・不一致は拒否する。
4. honeypotが埋まっていれば、外部サービスを呼ばず一般化した応答で終了する。
5. Cloudflare Turnstile tokenをサーバー側でsiteverifyし、期待するhostname/actionも照合する。
6. Zodで型、長さ、形式、列挙値をサーバー側検証する。クライアント検証は補助に留める。
7. Cloudflare環境に適したDurable ObjectへPIIを含まないrate-limit keyを送り、原子的に判定する。
8. 通過後のみ、サーバー側からResendを呼び出す。
9. クライアントへ成功または一般化したエラーを返す。

## Rate limit

Durable Objectを一貫したkeyへrouteし、時間窓と回数を原子的に更新する。keyはIPそのものを保存せず、ローテーション可能なサーバー秘密値を用いたHMACなどで短期識別子に変換する。問い合わせ本文、氏名、メールをrate-limit stateへ含めない。Turnstile前の軽い制限と送信直前の厳しい制限を分け、境界値、TTL、障害時の方針を実装時にテストで固定する。

## データとログ

- 問い合わせ本文、氏名、メール、所属をアプリログ、analytics、DB、Durable Objectへ保存しない。
- 配送に必要な瞬間だけメモリ上で扱い、Resendへ送った後は保持しない。
- ログはrequest ID、結果分類、遅延、PIIを含まないrate-limit結果に限定する。
- token、API key、環境変数、upstream response body、stack traceを利用者へ返さない。
- Resend API key、Turnstile secret、HMAC secretはCloudflare secretとして管理し、`NEXT_PUBLIC_` を付けない。

## 応答と障害

validation errorは項目単位で返すが、内部構造は露出しない。Turnstile、rate limiter、Resendの障害は利用者に再試行可能な一般メッセージを返し、秘密情報を含まない分類だけを記録する。メール配送の成否から内部アドレスやアカウント状態を推測できない応答にする。

## 実装前チェック

- 本番origin、Turnstile hostname/action、Resendの送信元domainを確定する
- body size、各項目の最大長、問い合わせ種別、rate-limit値を決める
- Cloudflare Durable Objectsのbindingとmigrationをレビューする
- spam、CSRF相当、oversized body、replay、rate-limit競合、upstream failureのテストを追加する
- privacy表記、保持方針、返信運用を確定する
