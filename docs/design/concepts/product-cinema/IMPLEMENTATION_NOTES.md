# Product Cinema — Implementation Notes

参照画像と `DESIGN_SPEC.md` から、ホームへ反映する構造を抽出した。参照PNGは比較用に限り、本番UIには埋め込まない。

## レイアウトとレスポンシブ

- コンテンツ順は Header → Hero → Axis → Capabilities → About → Contact。Footerは設けない。
- Headerにロゴや氏名の代替表示は置かず、PCはナビゲーションを中央、相談導線を右端に配置する。Mobileはメニューボタンだけを右端に置く。
- Headerは全幅のまま画面上端へ`sticky`追従させる。アンカー位置にはHeader高と24pxの余白を含め、移動先の見出しを隠さない。Liquid Glassの背景歪みを保つため、Header自体には`backdrop-filter`を重ねない。
- PCは最大1280px、12カラム相当、左右64pxを基準にする。Tabletは40px、Mobileは24px（320pxのみ20px）に縮める。
- Heroはカード化せず、PCは2行、Mobileは3行。PCは約72px、Mobileは約48px、行間1.08前後。PCではHeaderとHeroの合計を`100svh`に揃え、Axisは次の画面から始める。
- Hero背景には提供された白黒アートを全幅で配置する。左からの黒いscrimで本文のコントラストを固定し、Tablet / Mobileでは画像の不透明度を下げて文字を優先する。
- Heroの職種Eyebrow、Proof Strip、Selected Works、Writing、空のメディア・人物枠は表示しない。
- Axisは`SELECTED WORK / 01`、ロゴ、`構想から市場へ。`、16:9ティザー、説明、3つの事実、外部CTAで構成する。外部CTAはAxisアプリへのテキスト導線と、公開リポジトリ`Axis-pizza/Axis_MVP`へのGitHubアイコン導線を同じアクションレールにまとめる。
- PCのティザーはコンテンツ幅の82%で中央配置する。説明を上段、3つの事実とCTAを下段に置く二段の情報レールとし、Mobileは同じ読み順で縦積みにする。
- `logoSrc`、`videoSrc`、`posterSrc`はnullable。未設定時は存在しないアセットへの通信、`video`要素、再生ボタンを出さない。
- 設定済み動画は`IntersectionObserver`で表示面積55%以上からミュート再生し、15%以下で一時停止する。reduced motionと省データ設定では中央の手動再生ボタンを維持する。
- `/works`は同じAxisデータに加え、2026-08-27に公開対象として提供された4件の匿名実績、受賞3件、登壇2件を掲載する。個別詳細ルートは作らず、各案件の矢印も表示しない。
- `/works`のAxisはHomeと同じロゴを使用する。Axisアプリと公開GitHubリポジトリへの直接リンクは残すが、矢印記号は付けない。
- Capabilitiesは`CAPABILITY INDEX / 2026.08`を起点に、主要6技術のCORE STACKと3カテゴリ12技術のEXTENDED STACKで構成する。技術情報は`src/content/capability-index.ts`で管理し、Simple IconsまたはFont Awesome BrandsのSVGデータを共通`TechIcon`から`currentColor`で描画する。公式アイコンがないAWSには代替ロゴを作らず、プレーンテキストで表示する。
- COREはMobile 2列、Tablet / 1024pxで3列、1200px以上で6列。EXTENDEDはMobile 1列、Tablet 2列、1024px以上で3列にし、個別の箱やピルを使わず技術名と年数を左右に揃える。
- Aboutは写真のプレースホルダーを置かず、実在するプロフィール情報だけを表示する。
- Contactは利用できないCTAを置かず、窓口の準備状況を明記する。床面光はAxisより弱くする。

## トークン

- Canvas `#050505`、raised canvas `#090909`、surface `#0d0d0d`、media `#171717`。
- Text `#f1f0ec`、muted `#9b9b96`、subtle `#72726d`。
- Hairline `rgb(255 255 255 / 14%)`、strong hairline `rgb(255 255 255 / 28%)`。
- Radiusはcontrol 7px / surface 16px。影や過度に大きな角丸は使わない。
- 主要CTAは透明なLiquid Glass、Secondaryを下線＋矢印とする。最小高48px、タップ領域44px以上。
- Liquid GlassはSVG displacement filterをbackdropへ適用し、背景を屈折させる。文字と矢印はfilterの外側に置き、可読性を保つ。
- 見出しと強調文はShippori Mincho 500、本文・ナビ・操作・メタデータはZen Kaku Gothic New 400 / 500 / 700を`next/font`でセルフホストする。
- Body 16px / 1.75前後、H2はPC 40〜48px / Mobile 32〜36px。英語の強制uppercaseは使わない。
- 通常文は`line-break: strict`、`text-wrap: pretty`、`word-break: auto-phrase`を基準にする。数値、地名、担当範囲、`Demo Day`など意味上分割できない語は要素単位で折り返す。

## モーション

- Heroは行単位の見出し → 説明 → CTAを800ms前後で静かに表示する。文字単位には分解しない。
- Section revealはopacityと16px移動、500ms、once。SSR時も十分な不透明度で本文を残す。
- Hover / pressは100〜150ms。Liquid Glass内の矢印だけを小さく移動する。
- `prefers-reduced-motion` ではreveal、scale、メニュー遷移を即時化し、視差やscroll-linked motionは実装しない。
- Axisのスクロール連動は動画の再生状態だけを切り替え、要素位置やレイアウトを動かさない。

## メディアとコンテンツ境界

- AxisはDevnetで実資金取引ではないことを明示する。2026-08-27に公開対象として提供された`約1か月で再構築`、`Devnet 約400ユーザー`、`2,100件超のETF作成`以外の数値・成果・画面は作らない。
- 文面、事実、nullableなメディア設定、導線は `src/content/site.ts` に集約し、詳細ルートがない項目を架空リンクにしない。
- `SELECTED WORK / 01`と`LAUNCH TEASER / 00:42`はセクション識別・映像識別としてのみ使用する。意味のない大文字ラベル、連番、装飾用スラッシュ、Pending表記は追加しない。
- 将来の確認済みアセットは`public/media/axis/axis-logo.svg`、`axis-teaser.mp4`、`axis-teaser-poster.webp`へ置く。
