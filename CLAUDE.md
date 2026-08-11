# mahjong-score2

麻雀のスコアを半荘ごとに記録し、様々な指標で成績を分析・可視化するWebアプリ。

**2016年11月〜2026年5月の実データ(858半荘分)が既にSupabaseに入っている。** ゼロからの構築ではなく、既存データ・既存ロジックの上にフロントエンドを構築するプロジェクト。

## スタック

- **フロントエンド**: Next.js (App Router)
- **DB / Auth**: Supabase (Postgres)
- **デプロイ**: Vercel (GitHubリポジトリ連携で自動デプロイ)
- **リポジトリ**: https://github.com/takoyaki-git-source/mahjong-score2

## アクセスモデル

- **書き込み(半荘結果の入力・編集)**: 自分(オーナー)のみ。Supabase Authでログインした本人だけが可能。
- **閲覧(成績・分析画面)**: 誰でも閲覧可能。Vercelにデプロイして友人にもURLを共有する想定。
- → RLSポリシーは「SELECT: 誰でも許可」「INSERT/UPDATE/DELETE: authenticatedロールのみ許可」で設計する。

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
| `games` | 半荘(1ゲーム) | 858 | `game_id` は text PK、`YYYYMMDD_連番`形式(例: `20260811_01`)。全件`rule_id=1`。`played_at`は2016-11-05〜2026-05-09。`tobi_by_player_id` / `tobi_target_player_id` でトビの加害/被害を記録 |
| `results` | 半荘ごとの各プレイヤーの結果 | 3432 | 858×4と一致。`rank`, `raw_score`(素点、平均ちょうど25000), `final_score`(ウマオカ後の最終スコア、1000点単位), `seat_order`(1〜4の制約あり) |
| `yakuman_events` | 役満記録 | 19 | `yakuman_type`, `player_id`(和了者), `target_player_id`(放銃者など、nullable) |
| `tmp_results` | FK無しの一時テーブル | 3428 | `results`とほぼ同数。**過去データをGoogleスプレッドシートからインポートした際のステージング/バックアップだった可能性が高い。中身を精査するまで削除しない** |

### 既存の関数(書き込みロジック、構築済み)

`information_schema`/`pg_proc`調査で判明。半荘入力のメインロジックはほぼ完成している。

- **`generate_game_id(p_date date) → text`**: その日の`games`の件数を見て`YYYYMMDD_連番`形式のgame_idを発行
- **`submit_game(p_played_at, p_player1..4, p_score1..4, p_seat1..4, p_tobi_target, p_tobi_by) → text`**: 半荘結果をまとめて登録するRPC。
  - `mahjong_rules`から`rule_id = 1`のルールを固定で参照(設定済み)
  - `generate_game_id`でgame_id発行 → `games`にINSERT
  - 素点(`raw_score`)の降順・同点は`seat_order`昇順で着順(`rank`)を自動算出
  - `final_score = (raw_score - base_score) / 1000 + ウマ(+1位はオカも) + トビ賞罰` を算出して`results`にINSERT
  - フロントは基本この関数を呼ぶだけで半荘登録が完結する設計

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
- `player_base_stats`のトビ判定(`final_score <= -50`の閾値ベース)は意図的な設計と確認。`tobi_by_player_id`は`submit_game`呼び出し時の任意引数で、入力し忘れるとNULLのままになる。閾値ベースは常に入る`raw_score`から自動計算されるため入力漏れに強く、このままでよい
- 全18ビューに`security_invoker = true`を設定し`SECURITY DEFINER`警告を解消
- `generate_game_id` / `submit_game`に`search_path`を固定し警告を解消
- Security Advisorの警告は0件になった

## 過去データの取り込み

過去の成績はGoogleスプレッドシートで管理していた。既に2016-11-05〜2026-05-09分の858半荘はSupabaseに取り込み済み。**最終対局日(2026-05-09)以降、直近数ヶ月分がまだ未取り込みの可能性がある**(要確認)。

スプレッドシートの範囲をコピーしてテキストエリアに貼り付けるとタブ区切り(TSV)になるため、貼り付け→パース→プレビュー確認→`submit_game`呼び出し、という管理者専用のインポート機能を作る(継続的な追加取り込みにも使える)。

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
4. 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`(publishable key)をVercel/`.env.local`に設定。secret系のキーはコミットしない

## 現在のTODO

- [x] RLSの有効化とポリシー設定(read: public, write: authenticated)
- [x] ビューのSECURITY DEFINER/関数のsearch_path警告への対応
- [x] `mahjong_rules` にルール登録(`rule_id=1`のbase_scoreが30000→実データと矛盾していたため25000に修正)
- [ ] `tmp_results`の中身を精査(`results`との差分・重複を確認してから削除判断)
- [ ] 直近(2026-05-09以降)の未取り込みデータがあるか確認
- [ ] Supabase Authでオーナー用アカウントを1つ作成
- [ ] 集計期間指定に対応した関数/クエリの設計
- [ ] Next.jsプロジェクトの初期セットアップ
- [ ] 半荘結果の入力画面(`submit_game` RPCを呼ぶ)
- [ ] スプレッドシートのコピペインポート機能
- [ ] 成績分析・可視化画面(既存ビュー群を活用)
- [ ] Vercelデプロイ設定
