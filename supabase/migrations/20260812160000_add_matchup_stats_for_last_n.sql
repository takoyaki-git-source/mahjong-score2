-- 直近N半荘フィルタを個人詳細ページの対戦相手別成績にも対応させるための関数。
-- matchup_stats_for_periodと違い、対象プレイヤー自身の直近N半荘を基準に
-- (そのN半荘で同卓した相手ごとに)集計する。p_player_id必須。
CREATE OR REPLACE FUNCTION public.matchup_stats_for_last_n(p_player_id integer, p_n integer)
RETURNS TABLE(
  player_a integer, name_a text, player_b integer, name_b text,
  games bigint, avg_rank_a numeric, avg_rank_b numeric, avg_rank_diff numeric,
  top_rate_a numeric, last_rate_a numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  WITH my_games AS (
    SELECT r.game_id, r.rank
    FROM results r
    WHERE r.player_id = p_player_id
    ORDER BY r.game_id DESC
    LIMIT p_n
  ),
  base AS (
    SELECT
      p_player_id AS player_a, (SELECT name FROM players WHERE player_id = p_player_id) AS name_a,
      r2.player_id AS player_b, p2.name AS name_b,
      mg.rank AS rank_a, r2.rank AS rank_b
    FROM my_games mg
    JOIN results r2 ON r2.game_id = mg.game_id AND r2.player_id <> p_player_id
    JOIN players p2 ON p2.player_id = r2.player_id
  )
  SELECT
    player_a, name_a, player_b, name_b,
    count(*),
    round(avg(rank_a), 2), round(avg(rank_b), 2), round(avg(rank_a) - avg(rank_b), 2),
    round((count(*) FILTER (WHERE rank_a = 1))::numeric / count(*), 3),
    round((count(*) FILTER (WHERE rank_a = 4))::numeric / count(*), 3)
  FROM base
  GROUP BY player_a, name_a, player_b, name_b;
$function$;
