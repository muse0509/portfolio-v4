# パッケージ管理移行の調査記録

## 2026-10-26: pnpm継続採用の正式決定

**現在の方針は、パッケージ管理とworkspace管理へのpnpm継続採用です。** 既存のworkspace・CI・依存関係保護設定が整っており、今回のアプリケーションにBun固有の機能を必要としていないためです。Node.js 24.19.0／pnpm 11.22.0、単一の `pnpm-lock.yaml` と既存の保護設定を維持します。実際のmanifest・`.nvmrc`・CIの指定もこの方針と一致しています。

Bun移行は今後の必須タスクから外します。再評価は具体的な必要性が生じた場合に行う任意の検討です。Bun移行や開発ツールの入れ替えは、バックエンド基盤の検証を始める前提条件にしません。Turborepo・Lefthook・Oxlint・Oxfmtはいずれも未導入で、今回導入しません。

作業順は **リポジトリ整理（実施済み・未コミット差分あり）→ バックエンド基盤と認証の検証 → ブログAPI → フロントエンド実装** です。現在のNext.js / OpenNextと、未実装の将来構成の区別は [README](../README.md) と [アーキテクチャ方針](architecture.md) に従います。

以下は**2026-10-24時点の調査履歴**です。当時の結論は「移行保留」で、現在の結論は「pnpm継続採用」です。過去の調査結果・日付・検証結果・代替案はそのまま保存しており、以下の再検討条件や選択肢を今後の必須タスクとして扱いません。今回の変更は文書のみで、アプリの全テスト・ビルドは再実行していません。

---

実施日: 2026-10-24。**Bunへの移行は保留し、pnpm 11.22.0を維持する。** Bun 1.4.4では、lockfile内の既存バージョンの公開後待機時間と、公開日時が欠落した依存関係の拒否について、現在の保護を維持できない。依存の更新、保護設定の緩和、独自監査、外部サービス、二重管理による回避は行っていない。

## 出発点とバージョン

- ブランチ: `dependabot/npm_and_yarn/production-dependencies-3f5870b145`。HEAD: `f450b51`。既存のworkspace整理と文書更新の未コミット差分を出発点とした。
- 既存Next.js / OpenNextは `apps/web`。E2E・CI・単一の `pnpm-lock.yaml` はルート。ルートの重複したNext設定は既に削除済みで、`apps/api` と `packages/contracts` は未作成。
- 維持する実行環境は **Node.js 24.19.0 / pnpm 11.22.0**。検証時はインストール済みの指定Node.jsを選択し、`.nvmrc`・両manifestの指定を変更していない。
- 評価対象は公式安定版 **Bun 1.4.4**。採用版はない。公式releaseの公開日時は2026-10-22 10:11:32 UTC、tagは `bun-v1.4.4`、commitは `38afee6c84fcf48c0edb2466aa4b27d287a59c30`。以下の根拠はこのcommitに固定した。[公式リリース](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4)
- ローカルの通常PATHではBunを検出しなかったが、`~/.bun/bin/bun --version` は **1.4.3**、`--revision` は `1.4.3+c6da4a4d3` を返した。これは評価対象の1.4.4とは別であり、Bunの導入・更新・アプリ検証は行っていない。

ルートとWebのAGENTS・manifest、workspace設定、lockfile、CI、Playwright、ビルド・lint・型・unit設定、README、architecture、workspace-migrationを確認した。過去の検証記録は変更せず、今回の実測結果をこの文書に分けて記録する。

## 保護設定の対応

現在の明示設定は `pnpm-workspace.yaml`、両 `package.json`、lockfile、CIにある。リポジトリ内に追加の `.npmrc` やBun設定はない。表のBun欄は移行候補の評価であり、設定を追加済みという意味ではない。

| 現在の設定・値 | 目的 | Bun 1.4.4での対応と差 |
| --- | --- | --- |
| `minimumReleaseAge: 1440` | 公開から24時間未満のnpmバージョンを選ばない | Bunの数値は秒。`install.minimumReleaseAge = 86400` が時間量の対応。ただし新規解決にのみ適用されるため、単位変換だけでは同等でない |
| `minimumReleaseAgeStrict: true` | 年齢条件を自動で緩和しない。CI・非TTYでは失敗し、対話実行で若い版を採用するには明示承認を要する | 通常の新規解決は適合版がなければ失敗する。一方で既存lock版への例外があり、全経路の同等性はない。同名のBun設定は存在しない |
| `minimumReleaseAgeIgnoreMissingTime: false` | 公開日時を確認できないバージョンを拒否する | Bunは`time`欠落を通過させる。日時文字列の不正を拒否する動作とは別。同等の設定はなく、移行阻害要因 |
| `trustLockfile: false` | lockfileを無条件に信頼せず、固定済み依存も供給元の保護ポリシーの検証対象にする | Bunの既存lock版は年齢ゲート対象外。`--frozen-lockfile` は版・manifestの整合性を固定するもので、年齢再検査の代わりにならない。移行阻害要因 |
| `overrides.baseline-browser-mapping: 2.11.17` | 推移依存も指定版に固定する | Bunのルートmanifestの`overrides`で同じ指定を表現可能。ただし移行を行っていないため、Bunでの実解決は未検証 |
| `allowBuilds`: `esbuild`・`sharp`・`unrs-resolver`・`workerd`のみ`true` | 依存パッケージのlifecycle scriptの許可先を限定する | ルートmanifestの明示的な`trustedDependencies`に同じ4パッケージを列挙すれば許可リストを表現可能。省略時の組み込み許可リストは使用しない。移行後の実行結果は未検証 |
| `strictDepBuilds: true`（pnpm 11.22.0の既定値。リポジトリで上書きなし） | 未承認の依存ビルドがあるとinstallを失敗させる | Bunは未承認postinstallをブロックしても終了コード0を返す。許可範囲を合わせるだけでは失敗条件が一致しない |
| `packages: [apps/*, packages/*]` | workspaceの範囲を限定する | Bunのルートmanifestの`workspaces`で表現可能。空のアプリ・パッケージは不要 |
| lockfileの`autoInstallPeers: true` | peer依存を自動解決する | Bunもpeerを自動インストールするが、依存グラフの同等性は設定名だけでは保証できない。Bunでのpeer対応比較は未実施 |
| lockfileの`excludeLinksFromLockfile: false` | リンク情報をlockfileから除外しない | Bunは異なるlock形式を使用する。workspaceリンクを含む移行結果の確認が必要で、未実施 |
| Node.js `>=24.19.0 <25`、`.nvmrc: 24.19.0`、pnpm `11.22.0` | ローカルとCIのツールチェーンを固定する | 今回は変更しない。Bunを再評価する場合もNode.jsを維持し、実行時に`--bun`で強制しない |
| CIの`pnpm install --frozen-lockfile` | manifestとlockの不整合や意図しない解決変更を拒否する | Bunにもfrozen installはあるが、上記の年齢・日時欠落の保護の代替にはならない |

pnpm側は11.22.0の固定commit `93fcba42247e02ea06bc40cc9a25c207bb2a05ce`とローカルのインストール済み実装で確認した。[strictの処理](https://github.com/pnpm/pnpm/blob/93fcba42247e02ea06bc40cc9a25c207bb2a05ce/pnpm11/installing/commands/src/policyHandlers.ts)、[日時欠落時の検証](https://github.com/pnpm/pnpm/blob/93fcba42247e02ea06bc40cc9a25c207bb2a05ce/pnpm11/resolving/npm-resolver/src/createNpmResolutionVerifier.ts)を参照。

pnpmの`trustLockfile: false`は、毎回必ずレジストリから日時を取得し直すという意味ではない。[固定版の検証処理](https://github.com/pnpm/pnpm/blob/93fcba42247e02ea06bc40cc9a25c207bb2a05ce/pnpm11/installing/deps-installer/src/install/verifyLockfileResolutions.ts#L94)は結果の再利用を許す。今回のCIモードの実行ログにも、既に検証済みのlockfileに対する保護チェック結果の再利用が表示された。Bunとの比較は検証対象と失敗条件について行い、キャッシュ利用の有無と混同しない。

## 保留の根拠

Bun 1.4.4の[固定版install仕様](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/docs/pm/cli/install.mdx#L313)は秒単位を定義し、同ファイルの335行以降で新規解決だけへの適用と、`time`欠落の通過を明記する。[現行公式資料](https://bun.com/docs/pm/cli/install#minimum-release-age)も、この2点では固定版と一致した。

仕様の読み違いを避けるため、同じcommitの公式実装・テストも確認した。

- [固定版の公式テスト（2793行以降）](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/test/cli/install/minimum-release-age.test.ts#L2793)は、年齢条件なしでlockした若い版を、後からfrozenと年齢条件を指定しても成功させることを期待している。
- [公式テスト（3215行以降）](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/test/cli/install/minimum-release-age.test.ts#L3215)は、日時情報の欠落時に成功することを期待している。
- [解決処理](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/install/PackageManager/PackageManagerEnqueue.rs#L3740)には、年齢条件で拒否された後でもlockfileの既存版へフォールバックする経路がある。
- 通常の新規解決では、全候補が若すぎる場合に[エラーを返す](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/install/npm.rs#L2332)。適合版がないと常に年齢条件を緩めるわけではない。補助的な安定性探索の7日上限も、年齢ゲート自体の解除とは区別する。
- [設定パーサー](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/bunfig/bunfig.rs#L1582)には、pnpmの`minimumReleaseAgeStrict`・`minimumReleaseAgeIgnoreMissingTime`・`trustLockfile`に対応する同名設定がない。未対応の設定を`bunfig.toml`へ書いて対応済みとは扱わない。

lifecycleの[固定版仕様](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/docs/pm/lifecycle.mdx)では、明示した`trustedDependencies`は既定リストを置き換える。候補は`["esbuild", "sharp", "unrs-resolver", "workerd"]`の4件で、省略時の既定リストや全信頼は使わない。ただし、pnpmの[`strictDepBuilds`既定値](https://github.com/pnpm/pnpm/blob/93fcba42247e02ea06bc40cc9a25c207bb2a05ce/pnpm11/config/reader/src/index.ts#L210)と[未承認ビルドの失敗処理](https://github.com/pnpm/pnpm/blob/93fcba42247e02ea06bc40cc9a25c207bb2a05ce/pnpm11/installing/commands/src/handleIgnoredBuilds.ts#L25)に対し、[Bun公式テスト](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/test/cli/install/bun-install-lifecycle-scripts.test.ts#L229)は未承認postinstallをブロックしながら終了コード0を期待する。この失敗条件も同等でない。

さらに[固定版pnpm移行実装](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/install/pnpm.rs#L1816)が変換するのは`onlyBuiltDependencies`であり、現在使用中の`allowBuilds`の自動移送はない。[overridesの固定版仕様](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/docs/pm/overrides.mdx)やworkspaceの構文が対応していても、年齢ゲートと失敗条件の差は解消されない。

ここまでで移行条件を満たさないことが確定したため、Bunのインストール、隔離fixtureの作成、テスト用パッケージのscript実行、lockfile変換は行わなかった。上記は公式ソース・公式テストの読解による確認であり、そのテストをローカルで実行したという意味ではない。

## 依存関係と今回の差分

今回の開始時点を保存したファイルハッシュと比較し、`pnpm-lock.yaml`、両manifest、workspace設定、CI、アプリ設定・ソース・素材・既存テストを保持していることを確認した。直接・推移依存の版、peer対応、プラットフォーム別依存、取得元・integrityは、既存lockfile全文を変更していないため差分なし。`baseline-browser-mapping`はlockの解決結果でも2.11.17のまま。

Bun側の解決結果は存在しないため、「Bunへの移行前後で依存が同一」とは主張しない。公式の[pnpm lockfile移行機能](https://bun.com/docs/pm/lockfile#automatic-lockfile-migration)は確認したが実行していない。ルートの単一`pnpm-lock.yaml`と`pnpm-workspace.yaml`を残し、`bun.lock`・`bun.lockb`・アプリ専用lockfileは作成していない。

今回追加した変更は、この調査記録とREADME・ルートAGENTS・Web AGENTS・architectureからの案内のみ。過去のworkspace整理の差分は保持した。コマンド、Playwrightの起動、CIのSHA固定、Node.js、依存関係、保護設定、Next.jsガイドの管理ブロックは変更していない。

## 今回の検証

以下は過去の報告件数の転載ではなく、今回pnpmで実行した結果。すべてリポジトリルートから、Node.js 24.19.0 / pnpm 11.22.0で実行した。今回の実装変更はなく、文書のみを追加・更新した。

| 実行内容 | 結果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 成功。既存の2 workspace。lockfile・manifestの変更なし |
| `pnpm lint` | WebとルートE2E関連コードとも成功 |
| `pnpm typecheck` | Next.js route型生成・Web・ルートE2Eの型検査が成功 |
| `pnpm test` | 5ファイル・39件成功。過去の件数と同じ |
| `pnpm build:worker` | Next.js production buildとOpenNext Worker生成が成功 |
| `CI=1 pnpm test:e2e` | Chromiumで16件成功。過去の件数と同じ。既存サーバー再利用を無効にして起動 |
| ルートからの開発起動・引数転送 | E2Eログで`pnpm dev --hostname 127.0.0.1 --port 3000`からWeb、Nextへの転送を確認 |
| ルートE2Eの検査範囲 | ESLint APIとTypeScript設定読込で、`e2e/home.spec.ts`・`playwright.config.ts`が検査対象であることを確認 |
| React型の解決 | root・Web・Motion・Framer Motionからリポジトリ内の`@types/react` 19.3.0へ解決することを確認 |
| 生成物と検索除外 | 両ページの`noindex, nofollow`とrobotsの`Disallow: /`、Worker生成、6個の画像・動画のpublic/Worker assets間のバイト一致を確認 |

既存E2Eは`/`・`/works`、画像・動画、モバイルメニュー、画面幅、reduced motion等を検証する。問い合わせ処理は既存のfetchモックを使ったunit testで確認し、実メール送信はしていない。テストの追加・変更・無効化、型検査の緩和、UI・フォント変更はない。

今回のpnpm検証に失敗はなかった。E2Eでは`NO_COLOR`と`FORCE_COLOR`の併存警告が出たが、16件すべて成功した。ネットワーク・フォント取得・ブラウザ不足による未実施項目はない。

**未実施**: Bun 1.4.4でのinstall・script実行・アプリ検証、既存node_modulesや親ディレクトリに依存しないBunのfresh install、Bunの引数・cwd・終了コードと環境変数読込順序の検証。互換性確認で保留したため、成功扱いにしない。pnpmのアプリ環境ファイルの位置は引き続き`apps/web/.env.local`・`.dev.vars`で、実値ファイルは表示・コピーしていない。GitHub Actionsホスト、本番Cloudflare、実Turnstile・Resendも未検証。

## 外部設定と再検討条件

今回、外部設定は変更していない。**Bun移行に伴う外部変更は不要**で、pnpmのコマンドを維持する。既存workspace整理を反映する際の確認事項は引き続き、ルートで`pnpm install --frozen-lockfile`・`pnpm build:worker`、Wrangler設定`apps/web/wrangler.jsonc`、生成物`apps/web/.open-next/`である。[READMEの外部ビルド案内](../README.md#cloudflareと生成物)

次の選択肢を残す。

1. **現時点はpnpmを維持する。** 既存アプリの検証は通っており、pnpmのまま次のバックエンド基盤・認証検証を計画できる。今回は実装へ進まない。
2. **Bunが必要な保護を標準で提供した時点で再評価する。** 対象安定版を固定し、lock既存版への検査、日時欠落の拒否、適合版なしの失敗、lifecycleの許可と失敗条件を確認する。通過後に初めて公式lock移行、依存グラフ比較、秘密情報を含めないfresh install、Node.jsランタイムを維持した全script・環境変数・E2E検証を行う。実際に移行するときにCI・外部ビルドも固定版Bunへ揃える。
3. **外部の検証ゲートや独自監査を別途設計する。** 既存lock全体の公開日時と待機期間をfail-closedで確認する仕組みが候補になるが、Bunとの統合で同等性を保証できるかは未検証。新たな運用責務と範囲拡大になるため今回実装しない。pnpmとBunの二重管理も導入しない。

残る阻害要因はBun側の保護の差であり、現在のpnpm構成の動作不良ではない。ブランチ・HEADと既存差分を保ち、コミット・push・PR・デプロイなしのレビュー用差分を残す。
