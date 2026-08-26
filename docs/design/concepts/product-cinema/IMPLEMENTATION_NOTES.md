# Product Cinema — Implementation Notes

6枚の参照画像と `DESIGN_SPEC.md` から、ホーム初期実装へ反映する構造を抽出した。参照PNGは比較用に限り、本番UIには埋め込まない。

## レイアウトとレスポンシブ

- コンテンツ順は Header → Hero → Proof → Axis → Evidence → Timeline → Selected Works → Capabilities → Process → About / Writing → Contact → Footer。
- PCは最大1280px、12カラム相当、左右64pxを基準にする。Tabletは40px、Mobileは24px（320pxのみ20px）に縮める。
- Heroはカード化せず、PC / Mobileとも2行。PCは約72px、Mobileは約48px、行間1.08前後。下端にProofまたはAxisへの導入が見える空白量にする。
- Proof StripはPCで3列、Mobileで3行。各項目は同じ高さと罫線で揃え、装飾より短い事実ラベルを優先する。
- AxisメディアはPC 16:9、Mobile 16:10。中央の弱い白黒スポットライトと床面光だけを許可し、実在画面へ置換できる比率を固定する。
- EvidenceはPCで3列、Mobileで1列。列間は強いカード境界ではなくhairlineで分ける。
- TimelineはPCで横方向の6工程、Mobileで縦方向。点とhairlineで連続性を示す。
- Selected WorksはPCで本文とメディアを左右交互に配置し、Mobileでは全件「本文→メディア」に統一する。
- ProjectプレースホルダーはAxisより低い視覚重量になる横長16:5、PortraitはPCで1:1、Mobileで横長16:5とし、実素材への交換時も比率を固定する。
- Capabilitiesは全幅の編集的な行。ProcessはPCで4列、Mobileで縦Timelineにする。
- About / WritingはPCで分割、Mobileでは最終版 `home-mobile-03-final.png` に合わせてAbout→Writingの縦積みにする。
- Contactは見出しとCTAを主役にした広い帯。Mobileの見出しは意図的に2行、CTAは全幅。床面光はAxisより弱くする。

## トークン

- Canvas `#050505`、raised canvas `#090909`、surface `#0d0d0d`、media `#171717`。
- Text `#f1f0ec`、muted `#9b9b96`、subtle `#72726d`。
- Hairline `rgb(255 255 255 / 14%)`、strong hairline `rgb(255 255 255 / 28%)`。
- Radiusはcontrol / mediaとも2px。影や大きな角丸は使わない。
- CTAはPrimaryをoff-white面＋dark text、Secondaryを下線＋矢印。最小高48px、タップ領域44px以上。
- Eyebrow 12〜13px / 0.14em、Body 16px / 1.75前後、H2はPC 40〜48px / Mobile 32〜36px。

## モーション

- Heroはeyebrow → 行単位の見出し → 説明 → CTAを800ms前後で静かに表示する。文字単位には分解しない。
- Section revealはopacityと16px移動、500ms、once。SSR時も十分な不透明度で本文を残す。
- Hover / pressは100〜150ms。Axisメディアのみhover可能なPCで最大1.01 scaleを許可する。
- `prefers-reduced-motion` ではreveal、scale、メニュー遷移を即時化し、視差やscroll-linked motionは実装しない。

## メディアとコンテンツ境界

- Axis、Project 02 / 03、Portraitは共通 `MediaPlaceholder` で表示し、装飾としてアクセシビリティツリーから除外する。
- AxisはDevnetで実資金取引ではないことだけを明示し、未確認の数値・成果・画面は作らない。
- 仮文面と導線は `src/content/site.ts` に集約し、詳細ルートがない項目を架空リンクにしない。
