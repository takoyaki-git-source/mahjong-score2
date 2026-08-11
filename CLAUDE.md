# mahjong-score2

麻雀のスコアを半荘ごとに記録し、様々な指標で成績を分析・可視化するWebアプリ。

**2016年11月〜2026年4月の実データ(857半荘分)が既にSupabaseに入っている。** ゼロからの構築ではなく、既存データ・既存ロジックの上にフロントエンドを構築するプロジェクト。

分析ロジック(集計・ストリーク計算など)はSupabaseのビューとして実装する方針を継続する。ほぼ全ての指標が全期間に対するSQL集計・ウィンドウ関数で完結する内容であり、フロントは`select`するだけで済むため。集計期間指定だけは関数化(引数で期間を受け取るRPC)が必要になる見込み。

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
- **閲覧(成績・分析画面)**: 誰でも閲覧可能。Vercelにデプロイして友人にもURLを共有する想定。
- → RLSポリシーは「SELECT: 誰でも許可」「INSERT/UPDATE/DELETE: authenticatedロールのみ許可」で設計する(設定済み)。

## Supabaseプロジェクト

- project_id: `enurjqgzyerukhbijzea` (region: ap-southeast-2, Postgres 17)
- URL: https://enurjqgzyerukhbijzea.supabase.co
- ⚠️ **現状、全テーブルでRLSが無効。まだ本番投入前に必ずRLSを有効化しポリシーを設定すること。**
- ⚠️ マイグレーション履歴なし(スキーマはSQL Editor等で直接作成されたと思われる)。今後の変更は `supabase/migrations` を作り、CLIまたはMCPの `apply_migration` でマイグレーションとして管理する。

### 既存テーブルと実際のデータ量

⚠️ **Supabase MCPの`list_tables`が返す行数は不正確な推定値(reltuples由来)で、当初は全テーブル0件と表示されていたが実際は下記の通り大量のデータが入っていた。** 今後もテーブルの行数を確認する際は`count(*)`で直接数えること。

| テーブル | 役割 | 実際の行数 | 備考 |
|---|---|---|---|
| `players` | 対局者マスタ | 26 | `player_id` PK, `name` unique |
| `mahjong_rules` | ルール設定(ウマ・オカ・トビ賞罰など) | 1 | `rule_id=1`("kurakuen_4p"): 開始点25000, オカ+20, ウマ+10/+5/-5/-10, トビ+10/-10 |
| `games` | 半荘(1ゲーム) | 857 | `game_id` は text PK、`YYYYMMDD_連番`形式(例: `20260811_01`)。全件`rule_id=1`。`played_at`は2016-11-05〜2026-04-30 |
| `results` | 半荘ごとの各プレイヤーの結果 | 3428 | 857×4と一致。全件`raw_score`がNULL(旧スプレッドシートに素点の記録が無かったため)。`rank`, `final_score`(ウマオカ後の最終スコア、1000点単位), `seat_order`(1〜4の制約あり) |
| `yakuman_events` | 役満記録 | 19 | `yakuman_type`, `player_id`(和了者), `target_player_id`(放銃者など、nullable) |

`tmp_results`(スプレッドシートインポート時のステージングテーブル、3428行)は`results`への変換が完了済みと確認できたため削除済み(`supabase/migrations/20260811020320_drop_tmp_results.sql`)。

なお当初`games`は858件だったが、最新の1件(`20260509_01`)は`raw_score`が入っており(他の857件は全てNULL)、`submit_game`関数の動作確認用テストデータと判明したため削除済み。プレイヤー自体(横田・山下・森内・若井)は実在の対局者なので`players`テーブルはそのまま。

### 既存の関数(書き込みロジック、構築済み)

`information_schema`/`pg_proc`調査で判明。半荘入力のメインロジックはほぼ完成している。

- **`generate_game_id(p_date date) → text`**: その日の`games`の件数を見て`YYYYMMDD_連番`形式のgame_idを発行
- **`submit_game(p_played_at, p_player1..4, p_score1..4, p_seat1..4, p_tobi_target, p_tobi_by) → text`**: 半荘結果をまとめて登録するRPC。
  - `mahjong_rules`から`rule_id = 1`のルールを固定で参照(設定済み)
  - `generate_game_id`でgame_id発行 → `games`にINSERT
  - 素点(`raw_score`)の降順・同点は`seat_order`昇順で着順(`rank`)を自動算出
  - `final_score = (raw_score - base_score) / 1000 + ウマ(+1位はオカも) + トビ賞罰` を算出して`results`にINSERT
  - フロントは基本この関数を呼ぶだけで半荘登録が完結する設計
  - **設計意図**: 新アプリでは半荘終了時の素点(そのままの点数)を入力するだけで、ウマ・オカ・トビの計算は`submit_game`が自動で行う。旧スプレッドシートはウマオカトビ計算後の最終ポイントしか記録していなかった(`raw_score`が過去データ全件NULLなのはこのため)ので、これは運用上の改善にあたる

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

⚠️ **既知の課題**:
- 全ビューが**全期間集計固定**で、「集計期間指定」の要件に未対応。期間指定に対応するには関数化(引数で期間を受け取る)かアプリ側フィルタが必要

✅ **対応済み**:
- トビには「飛んだ側」と「飛ばした側」があり、判定方法が異なる。
  - **飛んだ側 (`tobi_target_player_id`)**: 点数(素点 or 最終ポイント)から判定可能。過去データも新規データも`player_base_stats`の`final_score <= -50`閾値判定で統一してよい
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
- [ ] 集計期間指定に対応した関数/クエリの設計
- [ ] `/admin/login`ページ(ログインフォーム)
- [ ] 半荘結果の入力画面(`submit_game` RPCを呼ぶ)
- [ ] スプレッドシートのコピペインポート機能
- [ ] 成績分析・可視化画面(既存ビュー群を活用)
- [ ] Vercelデプロイ設定

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
