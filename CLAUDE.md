# mahjong-score2

麻雀のスコアを半荘ごとに記録し、様々な指標で成績を分析・可視化するWebアプリ。

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

### 既存テーブル(構築途中、データは未投入)

| テーブル | 役割 | 備考 |
|---|---|---|
| `players` | 対局者マスタ | `player_id` PK, `name` unique |
| `mahjong_rules` | ルール設定(ウマ・オカ・トビ賞罰など) | `base_score`(デフォルト30000), `oka`, `uma_1`〜`uma_4`, `tobi_penalty`, `tobi_reward` |
| `games` | 半荘(1ゲーム) | `game_id` は text PK。`rule_id` で `mahjong_rules` を参照。`tobi_by_player_id` / `tobi_target_player_id` でトビの加害/被害を記録 |
| `results` | 半荘ごとの各プレイヤーの結果 | `rank`, `raw_score`(素点), `final_score`(ウマオカ後の最終スコア), `seat_order`(1〜4の制約あり) |
| `yakuman_events` | 役満記録 | `yakuman_type`, `player_id`(和了者), `target_player_id`(放銃者など、nullable) |
| `tmp_results` | インポート用の一時テーブル(FK無し) | **削除予定**。過去データはGoogleスプレッドシートからのコピペインポート機能で取り込み直す |

## 過去データの取り込み

過去の成績はGoogleスプレッドシートで管理していた。スプレッドシートの範囲をコピーしてテキストエリアに貼り付けるとタブ区切り(TSV)になるため、貼り付け→パース→プレビュー確認→`players`/`games`/`results`へのINSERT、という管理者専用のインポート機能を作る。

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

- [ ] `tmp_results` テーブルの削除
- [ ] RLSの有効化とポリシー設定(read: public, write: authenticated)
- [ ] Supabase Authでオーナー用アカウントを1つ作成
- [ ] `mahjong_rules` に自分たちのグループのルール(ウマ・オカ等)を1行登録
- [ ] Next.jsプロジェクトの初期セットアップ
- [ ] 半荘結果の入力画面
- [ ] スプレッドシートのコピペインポート機能
- [ ] 成績分析・可視化画面
- [ ] Vercelデプロイ設定
