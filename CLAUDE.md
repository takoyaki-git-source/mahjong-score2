# mahjong-score2

麻雀のスコアを半荘ごとに記録し、様々な指標で成績を分析・可視化するWebアプリ。

**2016年11月〜2026年4月の実データ(857半荘分)が既にSupabaseに入っている。** ゼロからの構築ではなく、既存データ・既存ロジックの上にフロントエンドを構築するプロジェクト。

分析ロジック(集計・ストリーク計算など)はSupabaseの関数/ビューとして実装する方針。ほぼ全ての指標がSQL集計・ウィンドウ関数で完結する内容であり、フロントは`rpc`/`select`するだけで済むため。集計期間指定は`player_stats_for_period`等のパラメータ化関数として実装済み(下記参照)。

## スタック

- **フロントエンド**: Next.js 16 (App Router, Turbopack, TypeScript, Tailwind CSS v4, `src/`ディレクトリ構成)
- **DB / Auth**: Supabase (Postgres)
- **デプロイ**: Vercel — **本番: https://mahjong-score2.vercel.app**(GitHubリポジトリ連携済み、`main`へのpushで自動デプロイ)
  - Vercelプロジェクト: `takoyaki0204-1024s-projects/mahjong-score2`。Vercel CLIでログイン済み(`vercel whoami` → `takoyaki0204-1024`)、`.vercel/project.json`でリンク済み
  - 環境変数(`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SITE_PASSWORD`)はVercel側のProduction/Preview/Development全環境に設定済み
  - `vercel.json`で`regions: ["syd1"]`を指定(Supabaseがap-southeast-2/Sydneyのため、Vercel Functionsもシドニーにピン留めしてDBとの往復レイテンシを削減。Hobbyプランでも単一リージョン指定は可能。⚠️ Routing Middleware(`src/proxy.ts`)はこの設定に関わらず全リージョンにデプロイされる仕様のため、regions指定だけではmiddleware自体のレイテンシは改善しない)
- **リポジトリ**: https://github.com/takoyaki-git-source/mahjong-score2

⚠️ **Next.js 16は学習データにある情報から破壊的変更が多い**(例: `middleware.ts`→`proxy.ts`へ改名、`LayoutProps`等のルート型は`next dev`/`next build`実行時に自動生成される等)。コードを書く前に`node_modules/next/dist/docs/`配下の同梱ドキュメントを確認すること。

### 開発環境メモ

- Node.jsは`nvm`経由でv24系を使用(`agent-browser`がNode24+必須のため、v22から切り替え)。`nvm alias default 24`済み
- `agent-browser`(nextjs:next-dev-loopスキルが使うブラウザ自動操作CLI)導入済みだが、**このMacのOS(Darwin 21.6.0 = macOS Monterey 12.x)が古く、Chrome for Testing最新版が起動できない**(VideoToolboxのシンボル不足でクラッシュ)。ブラウザ経由のランタイム検証は現状不可。`/_next/mcp`(`get_compilation_issues`/`get_routes`)と`npm run build`/`curl`での確認で代替する
- npmのグローバルインストールで`EACCES`(`/usr/local/lib/node_modules`の所有者がroot)が出ることがある。`sudo chown -R 501:20 "/Users/sanae/.npm"`等の対応が必要な場合、ターミナルアプリから実行してもらう(この実行環境の`!`実行はパスワード入力不可)

## デザイン

frontend-designスキルで検討したビジュアルデザインを適用済み。麻雀牌そのものの色(生成り/象牙色の牌、發の緑、中の赤)を土台にした配色。

- **配色トークン**(`src/app/globals.css`の`:root`、dark modeは`@media (prefers-color-scheme: dark)`で上書き): `--background`(生成り/暗い緑黒), `--foreground`, `--foreground-soft`(補助テキスト), `--accent`(中の赤、警告/ワースト/CTA), `--accent-2`(發の緑、ベスト/成功), `--gold`/`--silver`/`--bronze`(金銀銅、`TileBadge`の1〜3位に対応), `--line`(罫線), `--surface`(カード背景)。Tailwindの`@theme inline`で`bg-accent`等のユーティリティにマッピング
- **フォント**: 見出し=Shippori Mincho(`--font-display`)、本文=Zen Kaku Gothic New(`--font-sans`)、数値=Geist Mono(`--font-mono`、tabular-nums)。⚠️ **Shippori Mincho/Zen Kaku Gothic Newは`next/font/google`の型定義に`japanese`サブセットが無く(`latin`/`latin-ext`のみ)ビルドエラーになるため、`next/font/google`を使わず`src/app/layout.tsx`の`<head>`内に`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">`で直接読み込んでいる。`globals.css`側は`--font-display-family`/`--font-sans-family`にフォント名文字列を直書きして`@theme inline`でマッピング
- 本文背景に薄い格子模様(牌が並ぶ卓面をイメージ、`body`の`background-image`)
- `src/components/TileBadge.tsx`: 牌を模した角丸バッジで順位を表示(成績一覧の`#`列、ヒーローのpodium)。1〜3位はgold/silver/bronze、他はニュートラル
- `src/components/SiteHeader.tsx` / `AdminHeader.tsx`: 公開ページ/管理ページ共通のヘッダー(ロゴ文字列「麻雀成績」+ナビ)。アイコンは付けていない
- ⚠️ 判子(朱肉のスタンプ)モチーフの`HankoStamp`コンポーネントを一度作ったが、ユーザーに「よくわからないので不要」とフィードバックされ**全箇所から削除・コンポーネント自体も削除済み**。今後この方向のモチーフは避ける
- `Leaderboard`のヒーロー表示は**平均pt上位3人(金銀銅のpodium)**。足切り基準(その期間の参加者の半荘数の**中央値の半分未満・最低5半荘のフロア**、かつ**参加日数2日未満**)を満たさない人は対象外(該当者が0人ならフォールバックで全員を対象)。足切りの実数値は画面に明示表示し、下の表にも同じ足切りを適用するかはチェックボックスで切り替え可能
- 期間指定に年単位ボタン(2016〜2026等)を追加。`available_years()` RPCで`games`テーブルから存在する年を動的に取得し`PeriodSelector`に渡す
- プレイヤー名などのリンクは常時`underline decoration-line`(下線を常時薄く表示、hoverで`text-accent`+`decoration-accent`)にしている。⚠️ 以前は`hover:underline`のみでhover専用スタイルだったが、スマホ(タッチデバイス)では常にhover状態が無いため「クリックできることが分からない」とフィードバックがあり修正

## アクセスモデル

- **書き込み(半荘結果の入力・編集)**: 自分(オーナー)のみ。Supabase Authでログインした本人だけが可能。
  - オーナーアカウント作成済み: `takoyaki0204@gmail.com`(Supabaseダッシュボードから作成、`role: authenticated`)。Next.js側では`supabase.auth.signInWithPassword({ email, password })`でログインする想定
  - 入力・編集系のページは`/admin`配下に置く方針。`src/proxy.ts`(旧middleware)で`/admin`配下のみ未ログイン時に`/admin/login`へリダイレクトする(それ以外の全ページは未ログインでも閲覧可能)
- **閲覧(成績・分析画面)**: 友人には合言葉(共有パスワード)を伝えて見てもらう想定。トップページ(`/`)が成績一覧、`/players/[id]`が個人詳細
  - サイト全体(`/admin`含む全ページ)を`SITE_PASSWORD`環境変数による合言葉ゲートで保護。`src/lib/supabase/proxy.ts`の`updateSession`冒頭で、`site_auth`Cookieの値が`SITE_PASSWORD`と一致しなければ`/enter`(`src/app/enter/page.tsx`)へリダイレクトする。`/enter`はServer Action(`src/app/enter/actions.ts`の`unlock`)でパスワードを検証し、一致すればhttpOnly Cookie(180日)をセットして元のページへ戻す
  - `SITE_PASSWORD`が未設定ならゲート自体が無効(ローカル開発で毎回入力しなくて済む)。Cookieの`secure`属性は本番のみ有効(`NODE_ENV === 'production'`、ローカルのhttp開発でも動くように)
  - 認可の粒度は個人ごとのID/PWではなく友人グループ全体で1つの合言葉(採用理由: 26人分のアカウント登録は「気軽に成績を見る」用途に対して過剰な摩擦になるため)。この合言葉ゲートと`/admin`のSupabase Auth(オーナーのみ)は独立した別レイヤー
  - ⚠️ Vercel純正のDeployment Protection(パスワード保護)は本番ドメインに使うにはPro以上限定(Hobbyでは非対応、Proでも$150/月のAdvanced Deployment Protectionアドオンが必要)と判明したため、自前のCookieゲートを実装する方針にした
- → RLSポリシーは「SELECT: 誰でも許可」「INSERT/UPDATE/DELETE: authenticatedロールのみ許可」で設計する(設定済み)。合言葉ゲートはアプリ層の保護であり、RLS/Data APIレベルでは変わらずanonキーで直接SELECTは可能な点に注意(友人限定の運用を想定した簡易的な保護)。

### 実装済みページ

- `src/app/page.tsx`(トップページ、`/`): 成績一覧。`PeriodSelector`で期間指定(全期間/直近1年/今年/年単位ボタン`available_years()`/カスタム。直近3ヶ月はユーザー希望で削除)し、`player_stats_for_period` RPCの結果を`Leaderboard`コンポーネントで表示
- `src/components/Leaderboard.tsx`: 成績一覧テーブル(Client Component)。
  - 列見出しクリックでソート(トグルで昇順/降順)、列ごとにベスト(緑)/ワースト(赤)をハイライト(半荘数・名前・最終対局日は対象外)
  - ヒーロー表示は**平均pt上位3人(金銀銅)**。足切り基準(その期間の参加者の半荘数の中央値の半分未満・最低5半荘、かつ参加日数2日未満は除外)を画面に明示表示。この足切りをチェックボックスで下の表(ハイライト・ソート含む)にも適用できる(旧「最低半荘数」数値フィルタはユーザー希望で廃止)
- `src/app/players/[id]/page.tsx`: プレイヤー個人の詳細ページ。
  - 基本集計(率系のカードは`28.6% (245回)`のように件数も併記、最終対局日含む)。最高/最低ptと日別最高/最低ptには**発生日**を、連続記録には**期間(開始日〜終了日)と半荘数**をcaptionとして表示(`results`テーブルを個別取得して`findMaxStreak`等でJS側で算出。`player_stats_for_period`は最大値の数値しか返さないため)
  - 「推移」セクションに`TrendChart`を3つ配置: 累計pt推移、平均pt(直近20半荘の移動平均)、平均着順(同、`higherIsBetter=false`)。累積平均ではなく移動平均を採用(対局数が多い人ほど累積平均は終盤動かなくなり「最近の調子」が見えなくなるため)
  - 役満(回数・発生率に加え、日付/役満名/放銃者orツモの個別一覧も表示)・対戦相手別成績(`matchup_stats_for_period`)を表示。同じ`PeriodSelector`で期間指定可能
- `src/components/TrendChart.tsx`: 折れ線グラフ(Client Component、依存ライブラリ無しの自前SVG実装、dataviz skillのマーク仕様に準拠)。crosshair+tooltip、2pxライン、末尾に直接ラベル。⚠️ Server ComponentからClient Componentへは関数をpropsで渡せない(シリアライズ不可)ため、`valueFormat`/`dateFormat`のような関数ではなく`format: 'pt'|'rank'`や`monthly: boolean`のような文字列/真偽値のpropsでフォーマットを制御する設計にしている
- `src/app/yakuman/page.tsx`: 役満記録一覧(公開ページ)。`yakuman_events`を`games`(日付)・`players`(和了者・放銃者)とPostgRESTの埋め込みクエリ(`!fk制約名`で明示指定、`player_id`/`target_player_id`の2つのFKがあるため)で結合。日付降順で表示(時刻は`src/lib/format.ts`の`dateOnly()`で除去)、放銃者が無ければ「ツモ」
- `src/components/PeriodSelector.tsx` / `src/lib/period.ts`: 期間指定UI(共通コンポーネント)。プリセットはリンク、カスタム期間は`<input type="date">`を使ったGETフォーム(JS不要)。`globals.css`に`color-scheme: light`/`dark`を設定していないとダークモード時にブラウザ標準のカレンダーアイコンが背景に同化して見えなくなる不具合があったため設定済み
- `src/app/enter/page.tsx` / `src/app/enter/actions.ts`: サイト全体の合言葉ゲート画面。フォーム送信は`'use server'`のServer Action(`unlock`)で、`SITE_PASSWORD`と一致すれば`site_auth` Cookie(httpOnly, 180日)をセットして`next`パラメータの元のページへ戻す
- `src/app/manifest.ts`: PWA用Webマニフェスト(`MetadataRoute.Manifest`)。`name`/`icons`(192/512/maskable)/`theme_color`/`display: standalone`を定義。`public/icon-192.png` `icon-512.png` `icon-maskable-512.png` `apple-touch-icon.png`は麻雀の「中」牌をモチーフにしたSVGから`qlmanage`(macOSのQuickLook、SVGラスタライズ用に代用)+`sips`でリサイズ生成したもの。`src/app/layout.tsx`の`metadata`(`manifest`/`icons`/`appleWebApp`)と`viewport`(`themeColor`)で読み込む。オフライン対応のService Workerまでは実装していない(Supabaseのライブデータに依存するアプリのため、インストール可能にする軽量PWA化のみを目的とした)
- `src/lib/types.ts`: Supabase未生成型(Database型)の代わりに、RPCの戻り値を手動で型定義(`PlayerStats`/`MatchupStats`/`PlayerYakumanStats`)。`supabase-js`の`.returns<T>()`はDatabase型generic無しだと型エラーになるため、`await`後に`as T[]`でキャストする方式を採用
- `src/app/admin/login/page.tsx`: ログインフォーム(Client Component、`supabase.auth.signInWithPassword`)
- `src/app/admin/page.tsx`: 半荘入力画面(Server Componentで`players`/`mahjong_rules`/`player_recent_year_games`/`player_base_stats`を取得し`GameForm`に渡す)。プレイヤーの並び順は「直近1年の参加数→累計参加数→五十音順(`Intl.Collator('ja')`による近似。読み仮名列が無いため完全な五十音順ではない)」
- `src/app/admin/GameForm.tsx`: 入力フォーム本体(Client Component)。「素点(自動計算)」/「ポイント(計算済み)」のモード切り替え、対局日、**適用ルール選択**、4人分のプレイヤー選択と点数(またはポイント)、トビ加害(任意、1人まで)、**役満(任意、複数追加可・和了者/役満名/放銃者)**を入力。素点モードは`submit_game`、ポイントモードは`submit_game_points`を呼ぶ(どちらも`p_yakuman`にjsonb配列で渡し、半荘・結果・役満を同一トランザクションで登録)。素点モードのみ入力が揃うと`compute_game_results`をデバウンス呼び出しして登録前にプレビュー表示。合計点数チェック(素点は100,000、ポイントは0からのズレを警告)。実機で動作確認済み
- `src/app/admin/LogoutButton.tsx`: ログアウトボタン
- `src/app/admin/management/page.tsx`(旧`settings`。ユーザー希望で「管理」に改名): プレイヤー管理・ルール管理・データエクスポートを表示
- `src/app/admin/management/PlayerManager.tsx`: プレイヤー一覧表示+新規追加フォーム
- `src/app/admin/management/RuleForm.tsx` / `RuleManager.tsx`: ルールの一覧・追加・編集(ルールごとに独立して編集可能、新規追加も可能)
- `src/app/admin/management/export/route.ts`: 全テーブル(`players`/`mahjong_rules`/`games`/`results`/`yakuman_events`)をJSONでエクスポートするRoute Handler。PostgRESTのデフォルト1000件上限があるため`.range()`でページングして全件取得。Supabase以外にもバックアップを残したいというユーザーの要望で追加

## Supabaseプロジェクト

- project_id: `enurjqgzyerukhbijzea` (region: ap-southeast-2, Postgres 17)
- URL: https://enurjqgzyerukhbijzea.supabase.co
- **Freeプラン**。「Leaked Password Protection」等、一部のAuth設定はProプラン以上限定で現状は有効化できない
- RLSは全テーブルで有効化済み(read: public, write: authenticated)。今後のスキーマ変更は`supabase/migrations`にファイルを追加し、MCPの`apply_migration`で適用する(履歴は`list_migrations`で確認可能)

### 既存テーブルと実際のデータ量

⚠️ **Supabase MCPの`list_tables`が返す行数は不正確な推定値(reltuples由来)で、当初は全テーブル0件と表示されていたが実際は下記の通り大量のデータが入っていた。** 今後もテーブルの行数を確認する際は`count(*)`で直接数えること。

| テーブル | 役割 | 実際の行数 | 備考 |
|---|---|---|---|
| `players` | 対局者マスタ | 26 | `player_id` PK, `name` unique |
| `mahjong_rules` | ルール設定(ウマ・オカ・トビ賞罰など) | 1(複数登録・選択に対応済み) | `rule_id=1`("kurakuen_4p"): 開始点25000, オカ+20, ウマ+10/+5/-5/-10, トビ+10/-10。`/admin/settings`で追加・編集可能、半荘登録時に`/admin`でどのルールを適用するか選択できる |
| `games` | 半荘(1ゲーム) | 857 | `game_id` は text PK、`YYYYMMDD_連番`形式(例: `20260811_01`)。全件`rule_id=1`。`played_at`は2016-11-05〜2026-04-30 |
| `results` | 半荘ごとの各プレイヤーの結果 | 3428 | 857×4と一致。全件`raw_score`がNULL(旧スプレッドシートに素点の記録が無かったため)。`rank`, `final_score`(ウマオカ後の最終スコア、1000点単位), `seat_order`(1〜4の制約あり) |
| `yakuman_events` | 役満記録 | 19 | `yakuman_type`, `player_id`(和了者), `target_player_id`(放銃者など、nullable) |

`tmp_results`(スプレッドシートインポート時のステージングテーブル、3428行)は`results`への変換が完了済みと確認できたため削除済み(`supabase/migrations/20260811020320_drop_tmp_results.sql`)。

なお当初`games`は858件だったが、最新の1件(`20260509_01`)は`raw_score`が入っており(他の857件は全てNULL)、`submit_game`関数の動作確認用テストデータと判明したため削除済み。プレイヤー自体(横田・山下・森内・若井)は実在の対局者なので`players`テーブルはそのまま。

### 既存の関数(書き込みロジック)

- **`generate_game_id(p_date date) → text`**: その日の`games`の件数を見て`YYYYMMDD_連番`形式のgame_idを発行
- **`compute_game_results(p_rule_id, p_player1..4, p_score1..4, p_seat1..4, p_tobi_target, p_tobi_by) → table(player_id, seat_order, raw_score, rank, final_score)`**: 素点からウマ・オカ・トビ込みの最終ポイントを計算する純粋関数(INSERTしない)。`submit_game`と`/admin`のプレビュー表示の両方から呼ばれる、計算ロジックの単一の実装元。
  - 着順(`rank`)は素点降順・同点は`seat_order`昇順
  - **2〜4位**: `final_score = round_go_roku(round_go_roku(raw_score / 1000) - base_score/1000 + ウマ[順位] - オカ/4 + トビ賞罰)`。**素点を先に1000点単位へ五捨六入してから**base_score等を引く(素点の百の位そのものを丸める、という仕様の文字通りの意味)。先に差分`(raw_score - base_score)/1000`を計算してから丸める実装だと、差分がbase_scoreをまたいで符号反転する場合(例: 素点8500→差分-16500)に丸め方向が変わってしまい結果が変わるため、素点→丸め→減算の順序が必須
  - **1位**: 独立には丸めず、`final_score = -(2〜4位のfinal_scoreの合計)`。ウマ・オカは元々ゼロサムだが、4人それぞれを独立に五捨六入すると合計が0からズレる(丸め誤差)。慣習的に1位がその端数を吸収する形にすることで必ずゼロサムになる
  - ⚠️ **オカの計算に一度バグがあった**: 当初は1位に+オカを足すだけで誰からも引いていなかったため、半荘ごとに合計が+オカ分だけ増えてゼロサムになっていなかった(過去データは合計0のはずなのに矛盾)。「全員から一律オカ/4を引き、1位にオカ全額を足す」に修正しゼロサムになることを確認済み
  - ⚠️ **トビ罰(-10)が一度全く適用されないバグがあった**(2026-08-15判明・修正): `p_tobi_target`(飛んだ側)と一致するかで判定していたが、`GameForm`は常に`p_tobi_target: null`を渡す設計(飛んだ側は素点から自動判定する方針、下記参照)だったため条件が常にfalseになり、素点がマイナスでも罰則が入らなかった。`raw_score < 0`で直接判定するように修正
  - ⚠️ **端数処理を四捨五入→五捨六入に変更**(2026-08-15、`round_go_roku(numeric) → integer`ヘルパーを追加。符号ごとの絶対値に対し端数.5以下切り捨て・.6以上切り上げ)。**この変更を最初に実装した際、差分計算後にまとめて丸める版を一度リリースしたが、ユーザーが手計算した実際の半荘(2026-08-15の20260815_02, 20260815_11)の値と食い違うことを指摘されて発覚**: 素点が1位以外の場合に限らず素点自体を先に丸めるべきで、かつ1位は独立に丸めず端数吸収役にする必要があった(上記2点)。この2段階の修正を経て確定。影響を受けた2026-08-15分12半荘(素点入力モード)の`results.rank`/`final_score`は最終版の関数で2回再計算しUPDATE済み。過去857半荘はポイントのみ形式(素点自体が無い)でこの関数を経由しないため影響なし
- **`submit_game(p_played_at, p_rule_id, p_player1..4, p_score1..4, p_seat1..4, p_tobi_target, p_tobi_by, p_yakuman) → text`**: 半荘結果をまとめて登録するRPC。`generate_game_id`でgame_id発行→`games`にINSERT→`compute_game_results`の結果を`results`にINSERT→`p_yakuman`があれば`yakuman_events`にもINSERT。
  - **設計意図**: 新アプリでは半荘終了時の素点(そのままの点数)を入力するだけで、ウマ・オカ・トビの計算は自動で行う。旧スプレッドシートはウマオカトビ計算後の最終ポイントしか記録していなかった(`raw_score`が過去データ全件NULLなのはこのため)ので、これは運用上の改善にあたる
  - `p_rule_id`はハードコードではなくパラメータ化済み(複数ルールを切り替えて使える)
  - `p_yakuman`: `[{"player_id": int, "yakuman_type": text, "target_player_id": int|null}, ...]`形式のjsonb配列(デフォルト`[]`)。半荘・結果・役満をまとめて1回のRPC呼び出しでアトミックに登録できる
- **`submit_game_points(p_played_at, p_rule_id, p_player1..4, p_points1..4, p_seat1..4, p_tobi_target, p_tobi_by, p_yakuman) → text`**: `submit_game`と対になる、ポイント直接入力用のRPC。
  - ウマ・オカ・トビの自動計算はしない。`final_score`にポイントをそのまま入れ、`raw_score`はNULL(過去データと同じ形)
  - `rank`はポイント降順・同点は`seat_order`昇順で自動算出
  - `p_yakuman`は`submit_game`と同じ形式
  - 用途: 2026-08-10分など「ウマオカトビ計算済みのポイントしか手元にない」半荘を記録する場合

⚠️ **既存のPL/pgSQL関数を書き換える際の注意**: `CREATE OR REPLACE FUNCTION`は引数リストが変わると新しいオーバーロードを追加するだけで古い方が残ってしまう。引数を追加/変更する場合は先に`DROP FUNCTION`すること。また関数本体内のSQL文(INSERT列数など)はCREATE時に検証されず、実際に呼び出すまでエラーに気づけない(過去に列数不一致のバグを一度作り込んだ)。関数を変更したら**必ず実際に呼び出してテストし、テストデータは削除すること**。

### 既存のビュー(分析ロジック、構築済み)

同じ調査で18個のビューが判明。指標リストのほとんどが既にSQLで実装済み。

| ビュー | 内容 |
|---|---|
| `player_base_stats` | 半荘数・総得点・平均/最高/最低得点・順位別回数と率・連対率・トビ回数/率 |
| `player_daily_stats` / `player_daily_summary` | 参加日数・日別最高/最低得点・プラス/マイナス日数と率 |
| `player_top_streak` / `player_last_streak` / `player_no_top_streak` / `player_no_last_streak` | 連続トップ/ラス/ノートップ/ノーラス数(最大値) |
| `player_top_streak_blocks` / `_distribution` / `_distribution_rate`(last版も同様) | 連続記録の全ブロックと分布 |
| `matchup_base` / `matchup_stats` | 対戦相手別の平均着順・トップ率・ラス率 |
| `player_yakuman_stats` | 役満率 |
| `player_stats_all` / `player_stats_full` | 上記の統合ビュー |
| `player_recent_year_games` | 直近1年の参加半荘数(新規追加、`/admin`のプレイヤー並び替え用) |

### 期間指定対応の関数(新規追加)

上記ビューは全期間集計固定なので、`p_start`/`p_end`(どちらもNULL可、NULL/NULLで全期間)を受け取るSQL関数を別途追加した。フロントの成績一覧・個人詳細ページはこちらを使う。

- **`player_stats_for_period(p_start, p_end)`**: `player_stats_full`ビュー相当を期間指定対応にしたもの。基本集計・着順系・日別集計系・連続記録系に加え`last_played`(期間内の最終対局日)も含む
- **`matchup_stats_for_period(p_start, p_end)`**: `matchup_stats`ビュー相当
- **`player_yakuman_stats_for_period(p_start, p_end)`**: `player_yakuman_stats`ビュー相当

全期間(NULL/NULL)で呼んだ結果が既存の全期間ビューと一致することを確認済み(トップ/ラス経験が無いプレイヤーの連続記録が`NULL`ではなく`0`になる点のみ意図的な差分)。

⚠️ **既知の課題**:
- 上記3関数で「集計期間指定」の主要な要件はカバーしたが、連続記録の分布(`_distribution`系)や`player_stats_all`相当はまだ期間指定版を作っていない(必要になったら追加)

### Rating(天鳳風レーティング、段位戦)

- **`player_rating_history(p_player_id DEFAULT NULL, p_as_of date DEFAULT NULL)`**: 全857半荘をgame_id昇順(=時系列)で1回だけ通しでループし、各対局ごとのRating変動を計算するPL/pgSQL関数(計算式はマイグレーション`20260812010000_add_player_rating.sql`のコメント参照)。逐次計算(卓内の相互作用に依存)のため期間指定はできず、常に対局履歴の先頭から通しで計算する。`p_player_id`指定時は出力のみそのプレイヤーに絞る(状態計算自体は全プレイヤー分行う)。`p_as_of`指定時は`played_at <= p_as_of`の対局のみで計算する(=その日時点のRatingが求まる)
- **`player_current_ratings(p_as_of date DEFAULT NULL)`**: 各プレイヤーの最新Ratingを1行ずつ返す(`player_rating_history`の各プレイヤーの最終行)。成績一覧で使用
- **成績一覧・個人詳細ページでのRating表示**: 通常は`p_as_of: null`(現在値)。**年単位ボタン(`period=2020`等)で絞り込んだ場合のみ**`p_as_of`にその年の12/31を渡し、その年末時点のRatingを表示する(`src/lib/period.ts`の`yearPeriodEnd()`で判定)。それ以外の期間指定(全期間/直近1年/今年/カスタム/直近N半荘)は「現在値からしか計算しようがない」ため対象外で、常に現在値のまま(画面にもその旨を注記表示)

✅ **対応済み**:
- トビには「飛んだ側」と「飛ばした側」があり、判定方法が異なる。
  - **飛んだ側 (`tobi_target_player_id`)**: 点数(素点 or 最終ポイント)から判定可能。過去データも新規データも`player_base_stats`の`final_score <= -50`閾値判定で統一してよい。この方針により`/admin`の入力フォームでは飛んだ側の入力欄は設けていない(常に`p_tobi_target: null`で`submit_game`を呼ぶ。複数人が同時に飛ぶケースにも対応できる)
  - **飛ばした側 (`tobi_by_player_id`)**: 誰の手で飛ばされたかは点数からは分からず、`submit_game`呼び出し時に明示入力するしかない。過去データ(過去のスプレッドシートはウマオカトビ計算後の最終ポイントのみで素点自体が無かった)にはこの情報がほぼ無いため、「トビらせた回数」のような加害側の集計は将来作っても過去分は正確にカウントできない(仕様上の制約であり不具合ではない)
- 全18ビューに`security_invoker = true`を設定し`SECURITY DEFINER`警告を解消
- `generate_game_id` / `submit_game`に`search_path`を固定し警告を解消
- Security Advisorの警告は0件になった

## 過去データの取り込み

過去の成績はGoogleスプレッドシートで管理していた。既に2016-11-05〜2026-04-30分の857半荘はSupabaseに取り込み済み。

**未取り込み分**: 2026-08-10(昨日)の10半荘が未取り込み。ただしこれも過去データと同じ「ウマオカトビ計算後のポイントのみ」形式で、素点(raw_score)は無い。ユーザーは後でテストがてら入力予定。

→ この形式のデータは`submit_game`(素点入力→自動計算)では扱えない。過去857半荘と同じく、`rank`/`final_score`を直接指定してINSERTする経路(`raw_score`はNULL)が必要。スプレッドシートのコピペインポート機能は、この「ポイントのみ」形式に対応させる(素点ベースの新規入力とは別の入力経路として設計する)。

## 分析したい指標

- **集計期間指定**: 任意の期間で絞り込んで以下を集計できること

### 基本集計
- 半荘数
- 総得点
- 平均得点
- 最高得点
- 最低得点

### 着順系
- 順位分布(1〜4位それぞれの回数)
- 順位率(各順位の割合)
- 連対率(1位+2位で終わった割合)
- トビ回数
- トビ率

### 連続記録系
- 連続トップ数(最大連続1位回数)
- 連続ラス数(最大連続最下位回数)
- 連続ノートップ数(最大連続で1位を取れなかった回数)
- 連続ノーラス数(最大連続でラスを回避した回数)

### 日別集計系
- 参加日数
- 日別最高得点
- 日別最低得点
- プラス日数(その日のトータル収支がプラスだった日数)
- マイナス日数
- プラス日数率
- マイナス日数率

### その他
- 対戦相手別の成績
- 役満記録一覧
- ルール(セット)別の集計

→ 集計期間指定はどの指標にも横断的にかかる前提。着順・連続記録・日別集計は「1日に複数半荘やる」運用を前提に、半荘単位と日単位の両方の粒度を持たせる設計にする。

## 開発フロー

1. ローカルで実装 → `git commit`
2. リモートへの`git push`は毎回ユーザーに確認してから行う
3. Vercel側でGitHub連携の自動デプロイを設定(未設定なら要セットアップ)
4. 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(publishable key、`sb_publishable_...`形式)を`.env.local`(gitignore済み)とVercelに設定。`.env.local.example`に空の雛形あり。secret系のキーはコミットしない
5. Supabaseクライアントは`src/lib/supabase/{client,server,proxy}.ts`に用意済み(`@supabase/ssr`公式パターン)。Server ComponentsやRoute Handlersでは`server.ts`の`createClient()`、Client Componentsでは`client.ts`のものを使う

## 現在のTODO

- [x] RLSの有効化とポリシー設定(read: public, write: authenticated)
- [x] ビューのSECURITY DEFINER/関数のsearch_path警告への対応
- [x] `mahjong_rules` にルール登録(`rule_id=1`のbase_scoreが30000→実データと矛盾していたため25000に修正)
- [x] `tmp_results`の中身を精査・削除(`results`への変換完了を確認済み)
- [x] テスト用の半荘データ(`20260509_01`)を削除
- [x] Supabase Authでオーナー用アカウントを1つ作成(`takoyaki0204@gmail.com`)
- [x] 直近の未取り込みデータを確認(2026-08-10分、10半荘。ポイントのみ形式、ユーザーが後で入力予定)
- [x] Next.jsプロジェクトの初期セットアップ(App Router, TypeScript, Tailwind, `@supabase/ssr`クライアント3種、`/admin`保護用proxy.ts)
- [x] `/admin/login`ページ(ログインフォーム)
- [x] 半荘結果の入力画面(`/admin`、`submit_game` RPCを呼ぶ。動作確認済み)
- [x] 入力画面に素点/ポイントのモード切り替えを追加(`submit_game_points`関数を新規追加)
- [ ] 2026-08-10分の10半荘をポイントモードで入力(ユーザー作業)
- [x] Supabase Authの「Leaked Password Protection」警告 → **Proプラン以上限定機能で現プランでは有効化不可と判明。対応不可のため保留**
- [x] オカ計算のバグ修正(非ゼロサムだったのをゼロサムに)
- [x] 半荘登録時にルールを選択可能にする(`p_rule_id`パラメータ化)
- [x] 設定画面でルールの追加・編集を独立してできるように(`RuleManager`/`RuleForm`)
- [x] 登録前のポイントプレビュー(`compute_game_results`を切り出してRPCプレビューに利用)
- [x] `/admin`のプレイヤー選択プルダウンを直近1年参加数→累計参加数→五十音順(近似)でソート
- [x] 集計期間指定に対応した関数/クエリの設計(`player_stats_for_period` / `matchup_stats_for_period` / `player_yakuman_stats_for_period`)
- [x] 成績分析・可視化画面(トップページ=成績一覧、`/players/[id]`=個人詳細。期間指定UI付き)
- [x] 入力フォームに役満の入力欄を追加(`submit_game`/`submit_game_points`に`p_yakuman`パラメータを追加)
- [x] 成績一覧に列ごとのベスト/ワーストハイライトを追加
- [x] 成績一覧の列見出しクリックでソート
- [x] 成績一覧に最低半荘数フィルタを追加(極端に少ない対局数がベストワーストに影響しないように)
- [x] 「直近3ヶ月」プリセットを削除
- [x] 成績一覧・個人詳細に「最終対局日」を追加
- [x] 役満記録の閲覧ページ(`/yakuman`、日付・役満・和了者・放銃者)
- [x] Supabase以外へのバックアップ手段としてデータエクスポート機能(`/admin/management`、JSON全件出力)
- [x] `/yakuman`の日付から時刻表示を除去
- [x] 個人詳細ページに役満の個別一覧(回数だけでなく)を追加
- [x] 個人詳細ページの率カードに件数を併記
- [ ] スプレッドシートのコピペインポート機能 → **ユーザー希望で保留**
- [x] Vercelデプロイ設定(本番: https://mahjong-score2.vercel.app、GitHub連携で`main`へのpush=自動デプロイ)
- [x] ページ遷移が「もっさりしてる」問題への対応 → `vercel.json`でVercel FunctionsをSupabaseと同じシドニー(`syd1`)にピン留め + `src/lib/supabase/proxy.ts`が全ページで不要なSupabase認証往復をしていたのを`/admin`配下のみに限定。本番で3.3秒→0.7秒程度まで改善確認
- [x] スマホでプレイヤー名等のリンクがクリックできると分かりづらい問題 → `hover:underline`のみだったリンクを常時`underline decoration-line`表示に変更
- [x] PWA化(ホーム画面に追加してインストール可能に) → `src/app/manifest.ts` + アイコン一式(`public/icon-*.png`、麻雀の「中」牌モチーフ)。オフラインキャッシュ(Service Worker)は非対応(ライブデータ前提のため)
- [x] サイトの公開範囲を絞る(合言葉ゲート) → `SITE_PASSWORD`環境変数+`src/app/enter/`によるサイト全体Cookieゲートを追加。Vercel純正のパスワード保護はHobbyでは本番ドメインに使えないため自前実装を選択(ユーザーとの相談の上)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
