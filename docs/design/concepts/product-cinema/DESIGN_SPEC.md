# Product Cinema — Design Specification v0.1

## 目的

日本の発注者が、菊田佑輔を「事業理解から設計・実装・公開まで任せられる
フルスタックエンジニア」と短時間で判断できるホーム画面を作る。
Axisは旗艦実績として扱うが、サイト全体をWeb3ポートフォリオにはしない。

## 視覚原則

- 深い黒の展示空間に、実績画像とタイポグラフィを静かに配置する。
- 高級感は余白、階層、罫線、光量差で作る。
- カードを並べず、全幅バンドと編集的な行で情報を整理する。
- Axisのメディア面だけに、ごく控えめなスポットライトを与える。
- Appleの素材・画面構成・コピーは模倣しない。

## 推奨トークン

```css
:root {
  --color-canvas: #050505;
  --color-canvas-raised: #090909;
  --color-surface: #0d0d0d;
  --color-media: #171717;
  --color-text: #f1f0ec;
  --color-muted: #9b9b96;
  --color-subtle: #666662;
  --color-hairline: rgb(255 255 255 / 14%);
  --color-hairline-strong: rgb(255 255 255 / 28%);
  --color-action: #f1f0ec;
  --color-action-text: #11110f;

  --content-max: 1280px;
  --gutter-desktop: 64px;
  --gutter-tablet: 40px;
  --gutter-mobile: 24px;

  --radius-control: 2px;
  --radius-media: 2px;
  --line: 1px;
}
```

色はモノトーンのみ。色付きネオン、紫・青のWeb3グラデーション、茶系の高級感表現は使わない。
メディア背面の白黒ラジアルライトだけは、ごく低い不透明度で使用できる。

## タイポグラフィ

- 日本語はシステムサンセリフを第一段階で使用する。
- H1: PC 72px前後 / Mobile 48px前後。2行、標準字間、line-height 1.05〜1.12。
- H2: PC 40〜48px / Mobile 32〜36px。
- Body: 16px / line-height 1.7〜1.85。
- Eyebrow: 12〜13px / uppercase / letter-spacing 0.12〜0.16em。
- Nav: 13〜14px。
- 極細ウェイト、負のletter-spacing、読めない低コントラストは避ける。

## レイアウト

- PC: 最大1280px、12カラム、左右64pxを基準にする。
- Tablet: 左右40px。
- Mobile: 390px基準、左右24px。必要な場合のみ20pxまで縮小する。
- Heroの1画面内に、次のProofまたはAxisセクションの一部を見せる。
- Axisメディア: PC 16:9、Mobile 16:10を基準に安定したaspect-ratioを指定する。
- CTAの最小高さは48px。モバイルの主要CTAは全幅。
- セクションを浮いたカードにせず、ページの帯または罫線で区切る。

## ホーム構成

1. Site Header
2. Hero
3. Proof Strip
4. Axis Flagship
5. Axis Evidence / Responsibility Timeline
6. Selected Works
7. Capabilities
8. Process
9. About / Writing
10. Contact CTA
11. Footer

## レスポンシブ

- Desktopの横並びを単純縮小しない。
- Proofはモバイルで3行に積む。
- AxisのContext / Role / Outcomeはモバイルで縦積み。
- Responsibility TimelineはPCで横、モバイルで縦。
- Selected Worksはモバイルで本文→メディアの順に統一する。
- AboutとWritingはモバイルで必ず1カラムにする。
- Contact見出しはモバイルで意図的に2行にする。
- 375px〜1440pxで水平スクロールを発生させない。

## モーション

- Hover / press: 120〜180ms。
- UI状態変化: 220〜320ms。
- セクション表示: 500〜700ms、12〜24px以内の移動。
- Hero: 800〜1000ms。文字単位ではなく行単位。
- Axisのみ、PCで最大2%のscaleまたは4〜8pxの視差を許容する。
- Mobileでは視差とsticky連動を無効化する。
- `prefers-reduced-motion` を尊重し、JS失敗時も本文を表示する。
- スクロールジャック、タイプライター、磁石ボタン、独自カーソル、粒子、常時ノイズは使わない。

## 実画像への置換

- `ACTUAL AXIS SCREENSHOT`: 実在するAxisの画面を使用する。
- `PROJECT 02 / 03`: 実績内容が確定してから実画像と説明を追加する。
- `REAL PORTRAIT`: 本人写真を使用するか、写真なしのAboutへ変更する。
- 生成されたプロダクトUIや人物を、実績証明として公開しない。

## 実装禁止事項

- 参照PNGを背景画像としてページ全体に貼る。
- 架空の数値、顧客、レビュー、賞、経験年数を表示する。
- ターミナル風UI、コードレイン、Web3ネオン、3D端末モック。
- Glassmorphism、巨大な角丸、カードウォール、装飾用WebGL。
- 主要コンテンツをJavaScript実行前に非表示のままにする。
