# mahjong-score2

麻雀のスコアを半荘ごとに記録し、様々な指標で成績を分析・可視化するWebアプリ。

**2016年11月〜2026年4月の実データ(857半荘分)が既にSupabaseに入っている。** ゼロからの構築ではなく、既存データ・既存ロジックの上にフロントエンドを構築するプロジェクト。

分析ロジック(集計・ストリーク計算など)はSupabaseの関数/ビューとして実装する方針。ほぼ全ての指標がSQL集計・ウィンドウ関数で完結する内容であり、フロントは`rpc`/`select`するだけで済むため。集計期間指定は`player_stats_for_period`等のパラメータ化関数として実装済み(下記参照)。

## スタック

- **フロントエンド**: Next.js 16 (App Router, Turbopack, TypeScript, Tailwind CSS v4, `src/`ディレクトリ構成)
- **DB / Auth**: Supabase (Postgres)
- **デプロイ**: Vercel (GitHubリポジトリ連携で自動デプロイ)
- **リポジトリ**: https://github.com/takoyaki-git-source/mahjong-score2

⚠️ **Next.js 16は学習データにある情報から破壊的変更が多い**(例: `middleware.ts`→`proxy.ts`へ改名、`LayoutProps`等のルート型は`next dev`/`next build`実行時に自動生成される等)。コードを書く前に`node_modules/next/dist/docs/`配下の同梱ドキュメントを確認すること。

### 開発環境メモ

- Node.jsは`nvm`経由でv24系を使用(`agent-browser`がNode24+必須のため、v22から切り替え)。`nvm alias default 24`済み
- `agent-browser`(nextjs:next-dev-loopスキルが使うブラウザ自動操作CLI)導入済みだが、**このMacのOS(Darwin 21.6.0 = macOS Monterey 12.x)が古く、Chrome for Testing最新版が起動できない**(VideoToolboxのシンボル不足でクラッシュ)。ブラウザ経由のランタイム検証は現状不可。`/_next/mcp`(`get_compilation_issues`/`get_routes`)と`npm run build`/`curl`での確認で代替する
- npmのグローバルインストールで`EACCES`(`/usr/local/lib/node_modules`の所有者がroot)が出ることがある。`sudo chown -R 501:20 "/Users/sanae/.npm"`等の対応が必要な場合、ターミナルアプリから実行してもらう(この実行環境の`!`実行はパスワード入力不可)

## アクセスモデル

- **書き込み(半荘結果の入力・編集)**: 自分(オーナー)のみ。Supabase Authでログインした本人だけが可能。
  - オーナーアカウント作成済み: `takoyaki0204@gmail.com`(Supabaseダッシュボードから作成、`role: authenticated`)。Next.js側では`supabase.auth.signInWithPassword({ email, password })`でログインする想定
  - 入力・編集系のページは`/admin`配下に置く方針。`src/proxy.ts`(旧middleware)で`/admin`配下のみ未ログイン時に`/admin/login`へリダイレクトする(それ以外の全ページは未ログインでも閲覧可能)
- **閲覧(成績・分析画面)**: 誰でも閲覧可能。Vercelにデプロイして友人にもURLを共有する想定。トップページ(`/`)が成績一覧、`/players/[id]`が個人詳細
- → RLSポリシーは「SELECT: 誰でも許可」「INSERT/UPDATE/DELETE: authenticatedロールのみ許可」で設計する(設定済み)。

### 実装済みページ

- `src/app/page.tsx`(トップページ、`/`): 成績一覧。`PeriodSelector`で期間指定(全期間/直近1年/今年/カスタム。直近3ヶ月はユーザー希望で削除)し、`player_stats_for_period` RPCの結果を`Leaderboard`コンポーネントで表示
- `src/components/Leaderboard.tsx`: 成績一覧テーブル(Client Component)。列見出しクリックでソート(トグルで昇順/降順)、列ごとにベスト(緑)/ワースト(赤)をハイライト(半荘数・名前・最終対局日は対象外)。「最低半荘数」フィルタで少数対局のプレイヤーを除外可能(ベストワースト判定にも反映される)。「最終対局日」列あり
- `src/app/players/[id]/page.tsx`: プレイヤー個人の詳細ページ。基本集計(率系のカードは`28.6% (245回)`のように件数も併記、最終対局日含む)・連続記録・日別集計・役満(回数・発生率に加え、日付/役満名/放銃者orツモの個別一覧も表示)・対戦相手別成績(`matchup_stats_for_period`)を表示。同じ`PeriodSelector`で期間指定可能
- `src/app/yakuman/page.tsx`: 役満記録一覧(公開ページ)。`yakuman_events`を`games`(日付)・`players`(和了者・放銃者)とPostgRESTの埋め込みクエリ(`!fk制約名`で明示指定、`player_id`/`target_player_id`の2つのFKがあるため)で結合。日付降順で表示(時刻は`src/lib/format.ts`の`dateOnly()`で除去)、放銃者が無ければ「ツモ」
- `src/components/PeriodSelector.tsx` / `src/lib/period.ts`: 期間指定UI(共通コンポーネント)。プリセットはリンク、カスタム期間は`<input type="date">`を使ったGETフォーム(JS不要)。`globals.css`に`color-scheme: light`/`dark`を設定していないとダークモード時にブラウザ標準のカレンダーアイコンが背景に同化して見えなくなる不具合があったため設定済み
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
  - `final_score = (raw_score - base_score) / 1000 + ウマ[順位] - オカ/4 + (1位のみ+オカ全額) + トビ賞罰`
  - ⚠️ **オカの計算に一度バグがあった**: 当初は1位に+オカを足すだけで誰からも引いていなかったため、半荘ごとに合計が+オカ分だけ増えてゼロサムになっていなかった(過去データは合計0のはずなのに矛盾)。「全員から一律オカ/4を引き、1位にオカ全額を足す」に修正しゼロサムになることを確認済み
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
- [ ] Vercelデプロイ設定

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
