DROP FUNCTION IF EXISTS public.player_stats_for_period(date, date);

CREATE FUNCTION public.player_stats_for_period(p_start date DEFAULT NULL, p_end date DEFAULT NULL)
RETURNS TABLE(
  player_id integer, name text,
  games bigint, total_score bigint, avg_score numeric, max_score integer, min_score integer, avg_rank numeric,
  first_count bigint, second_count bigint, third_count bigint, fourth_count bigint,
  first_rate numeric, second_rate numeric, third_rate numeric, fourth_rate numeric, rentai_rate numeric,
  tobi_count bigint, tobi_rate numeric,
  play_days bigint, best_day bigint, worst_day bigint, plus_days bigint, minus_days bigint, plus_rate numeric, minus_rate numeric,
  max_top_streak integer, max_last_streak integer, max_no_top_streak integer, max_no_last_streak integer,
  last_played date
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  WITH filtered AS (
    SELECT r.player_id, r.game_id, r.rank, r.final_score, g.played_at
    FROM results r
    JOIN games g ON g.game_id = r.game_id
    WHERE (p_start IS NULL OR g.played_at >= p_start)
      AND (p_end IS NULL OR g.played_at <= p_end)
  ),
  base AS (
    SELECT
      p.player_id, p.name,
      count(*) AS games,
      sum(f.final_score) AS total_score,
      round(avg(f.final_score), 1) AS avg_score,
      max(f.final_score) AS max_score,
      min(f.final_score) AS min_score,
      round(avg(f.rank), 2) AS avg_rank,
      count(*) FILTER (WHERE f.rank = 1) AS first_count,
      count(*) FILTER (WHERE f.rank = 2) AS second_count,
      count(*) FILTER (WHERE f.rank = 3) AS third_count,
      count(*) FILTER (WHERE f.rank = 4) AS fourth_count,
      round((count(*) FILTER (WHERE f.rank = 1))::numeric / count(*), 3) AS first_rate,
      round((count(*) FILTER (WHERE f.rank = 2))::numeric / count(*), 3) AS second_rate,
      round((count(*) FILTER (WHERE f.rank = 3))::numeric / count(*), 3) AS third_rate,
      round((count(*) FILTER (WHERE f.rank = 4))::numeric / count(*), 3) AS fourth_rate,
      round((count(*) FILTER (WHERE f.rank <= 2))::numeric / count(*), 3) AS rentai_rate,
      count(*) FILTER (WHERE f.final_score <= -50) AS tobi_count,
      round((count(*) FILTER (WHERE f.final_score <= -50))::numeric / count(*), 3) AS tobi_rate,
      max(f.played_at) AS last_played
    FROM filtered f
    JOIN players p ON p.player_id = f.player_id
    GROUP BY p.player_id, p.name
  ),
  daily AS (
    SELECT player_id, date(played_at) AS play_date, sum(final_score) AS daily_score
    FROM filtered
    GROUP BY player_id, date(played_at)
  ),
  daily_summary AS (
    SELECT
      player_id,
      count(*) AS play_days,
      max(daily_score) AS best_day,
      min(daily_score) AS worst_day,
      count(*) FILTER (WHERE daily_score > 0) AS plus_days,
      count(*) FILTER (WHERE daily_score < 0) AS minus_days,
      round((count(*) FILTER (WHERE daily_score > 0))::numeric / count(*), 3) AS plus_rate,
      round((count(*) FILTER (WHERE daily_score < 0))::numeric / count(*), 3) AS minus_rate
    FROM daily
    GROUP BY player_id
  ),
  streak_base AS (
    SELECT
      player_id, game_id,
      CASE WHEN rank = 1 THEN 1 ELSE 0 END AS is_top,
      CASE WHEN rank = 4 THEN 1 ELSE 0 END AS is_last
    FROM filtered
  ),
  streak_calc AS (
    SELECT
      player_id, is_top, is_last,
      sum(CASE WHEN is_top = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY player_id ORDER BY game_id) AS top_grp,
      sum(CASE WHEN is_last = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY player_id ORDER BY game_id) AS last_grp,
      sum(CASE WHEN is_top = 1 THEN 1 ELSE 0 END) OVER (PARTITION BY player_id ORDER BY game_id) AS no_top_grp,
      sum(CASE WHEN is_last = 1 THEN 1 ELSE 0 END) OVER (PARTITION BY player_id ORDER BY game_id) AS no_last_grp
    FROM streak_base
  ),
  top_streak AS (
    SELECT player_id, max(cnt) AS max_top_streak
    FROM (SELECT player_id, top_grp, count(*) AS cnt FROM streak_calc WHERE is_top = 1 GROUP BY player_id, top_grp) s
    GROUP BY player_id
  ),
  last_streak AS (
    SELECT player_id, max(cnt) AS max_last_streak
    FROM (SELECT player_id, last_grp, count(*) AS cnt FROM streak_calc WHERE is_last = 1 GROUP BY player_id, last_grp) s
    GROUP BY player_id
  ),
  no_top_streak AS (
    SELECT player_id, max(cnt) AS max_no_top_streak
    FROM (SELECT player_id, no_top_grp, count(*) AS cnt FROM streak_calc WHERE is_top = 0 GROUP BY player_id, no_top_grp) s
    GROUP BY player_id
  ),
  no_last_streak AS (
    SELECT player_id, max(cnt) AS max_no_last_streak
    FROM (SELECT player_id, no_last_grp, count(*) AS cnt FROM streak_calc WHERE is_last = 0 GROUP BY player_id, no_last_grp) s
    GROUP BY player_id
  )
  SELECT
    b.player_id, b.name, b.games, b.total_score, b.avg_score, b.max_score, b.min_score, b.avg_rank,
    b.first_count, b.second_count, b.third_count, b.fourth_count,
    b.first_rate, b.second_rate, b.third_rate, b.fourth_rate, b.rentai_rate,
    b.tobi_count, b.tobi_rate,
    coalesce(ds.play_days, 0), ds.best_day, ds.worst_day, coalesce(ds.plus_days, 0), coalesce(ds.minus_days, 0), ds.plus_rate, ds.minus_rate,
    coalesce(ts.max_top_streak, 0), coalesce(ls.max_last_streak, 0), coalesce(nts.max_no_top_streak, 0), coalesce(nls.max_no_last_streak, 0),
    b.last_played
  FROM base b
  LEFT JOIN daily_summary ds ON ds.player_id = b.player_id
  LEFT JOIN top_streak ts ON ts.player_id = b.player_id
  LEFT JOIN last_streak ls ON ls.player_id = b.player_id
  LEFT JOIN no_top_streak nts ON nts.player_id = b.player_id
  LEFT JOIN no_last_streak nls ON nls.player_id = b.player_id;
$function$;
