# Product Cinema — Design Specification v0.1

## 目的

日本の発注者が、菊田佑輔を「事業理解から設計・実装・公開まで任せられる
フルスタックエンジニア」と短時間で判断できるホーム画面を作る。
Axisは旗艦実績として扱うが、サイト全体をWeb3ポートフォリオにはしない。

## 視覚原則

- 深い黒の一枚のアプリ面に、検証済みの情報とタイポグラフィを静かに配置する。
- 高級感は余白、階層、罫線、光量差で作る。
- 意味のない英大文字、連番、斜線、ステータス、非リンク矢印を装飾に使わない。
- カードを並べず、全幅バンドと編集的な行、ひとつのAxis Featured Workで情報を整理する。
- Axisはロゴ、短いステートメント、16:9メディア、説明・事実・CTAの順に見せる。
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

  --radius-control: 7px;
  --radius-surface: 16px;
  --line: 1px;
}
```

色はモノトーンのみ。色付きネオン、紫・青のWeb3グラデーション、茶系の高級感表現は使わない。
Axis Featured Workには装飾グラデーションを使わず、黒の光量差とhairlineだけで構成する。

## タイポグラフィ

- 見出しと強調文はShippori Mincho、本文とUIはZen Kaku Gothic Newを使用する。
- H1: PC 72px前後 / Mobile 48px前後。2行、標準字間、line-height 1.05〜1.12。
- H2: PC 40〜48px / Mobile 32〜36px。
- Body: 16px / line-height 1.7〜1.85。
- Nav: 13〜14px。
- 英字を使う場合も、固有名詞や技術名を除いて大文字化しない。
- 極細ウェイト、負のletter-spacing、読めない低コントラストは避ける。
- 日本語本文はphrase-aware wrappingを使い、助詞・句読点・中黒だけが行末や次行に孤立しないようにする。固定改行はHeroなど構図上の意図がある見出しに限定する。

## レイアウト

- PC: 最大1280px、12カラム、左右64pxを基準にする。
- Tablet: 左右40px。
- Mobile: 390px基準、左右24px。必要な場合のみ20pxまで縮小する。
- PCではHeaderとHeroの合計を画面高1枚に揃え、Axisは次の画面から始める。
- Headerは画面上端へ追従させ、アンカー移動時はHeader高と24pxの余白を確保して見出しを隠さない。
- Tablet / Mobileではコンテンツの読みやすさを優先し、Axisの導入が画面下に見えてよい。
- AxisはPCで幅75〜82%の16:9メディアを中央に置く。映像未設定時は通信を行わない静かなプレースホルダーとし、再生操作を表示しない。
- 映像設定時は表示面積55%以上でミュート再生し、15%以下まで離れたら一時停止する。`prefers-reduced-motion`または省データ設定では自動再生せず、手動再生を残す。
- CTAの最小高さは48px。モバイルの主要CTAは全幅。
- セクションを浮いたカードにせず、ページの帯または罫線で区切る。

## ホーム構成

1. Site Header
2. Hero
3. Axis Cinematic Featured Work
4. Capabilities
5. About
6. Contact Status

## 実績ページ構成

- `/works`は個別ケーススタディへの中継ではなく、このページだけで全実績を読み切れる構成にする。
- 冒頭の担当領域、Axisの旗艦実績、その他4件の時系列一覧、受賞・登壇の順に配置する。
- AxisはHomeと同じ検証済みロゴ・説明・3つの事実・外部リンクを再利用する。
- 各プロジェクトをリンク化せず、末尾の矢印や`CASE STUDY`導線を置かない。番号は時系列の識別にのみ使う。
- 機密案件は固有名詞や画面を出さず、公開可能な役割・成果・担当領域だけを記載する。

## レスポンシブ

- Desktopの横並びを単純縮小しない。
- Axisの説明、事実、CTAはモバイルで縦積みにする。
- 3つの事実はPC / Tabletで3列、Mobileで1列にする。
- Capabilitiesは技術経験をCORE STACKとEXTENDED STACKへ分ける。COREはMobile 2列、Tablet 3列、1200px以上で6列。EXTENDEDはMobile 1列、Tablet 2列、Desktop 3列とし、技術名と年数を左右で比較できる行にする。
- CapabilitiesではSimple IconsまたはFont Awesome BrandsのSVGデータを`currentColor`で描画し、公式アイコンがない技術は文字だけで表示する。カード、ピル、ブランドカラー、グラデーション、発光、Liquid Glassは使わない。
- Aboutはモバイルで1カラムにする。
- Contact見出しはモバイルで意図的に2行にする。
- 375px〜1440pxで水平スクロールを発生させない。

## モーション

- Hover / press: 120〜180ms。
- UI状態変化: 220〜320ms。
- セクション表示: 500〜700ms、12〜24px以内の移動。
- Hero: 800〜1000ms。文字単位ではなく行単位。
- Mobileでは視差とsticky連動を無効化する。
- `prefers-reduced-motion` を尊重し、JS失敗時も本文を表示する。
- スクロール連動はAxis動画の再生・一時停止という状態変化に限定し、位置・scale・視差には連動させない。
- スクロールジャック、タイプライター、磁石ボタン、独自カーソル、粒子、常時ノイズは使わない。

## 実画像の扱い

- Axis映像が未設定の間は、生成UIを置かず、`video`要素も生成しない16:9の静かな面だけを表示する。
- ロゴ未設定時は文字の`AXIS`へフォールバックする。検証済みアセット追加後だけ画像・映像パスを有効化する。
- 本人写真がない状態では、写真枠を置かずテキストだけのプロフィールにする。
- 生成されたプロダクトUIや人物を、実績証明として公開しない。

## 実装禁止事項

- 参照PNGを背景画像としてページ全体に貼る。
- 架空の数値、顧客、レビュー、賞、経験年数を表示する。
- ターミナル風UI、コードレイン、Web3ネオン、3D端末モック。
- 一般的なGlassmorphism、巨大な角丸、カードウォール、装飾用WebGL。Liquid Glassは主要導線に限り、透明な背景屈折として使用できる。
- 主要コンテンツをJavaScript実行前に非表示のままにする。
