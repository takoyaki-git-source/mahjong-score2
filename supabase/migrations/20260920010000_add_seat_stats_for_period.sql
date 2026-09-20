-- 成績一覧ページ向け: プレイヤーを問わず、開始時の座席(東家/南家/西家/北家)
-- ごとの成績を集計する関数。起家(東家)が統計的に有利かどうかの分析用。
-- seat_orderはGameFormからの新規入力分にしか記録されていない(過去データは
-- 自風の情報自体が無い)ため、対象は必然的にその範囲に限られる。
-- lastN(直近N半荘)モードは「プレイヤーごとの直近N半荘」という概念のため
-- 座席横断の集計とは相性が悪く、対応しない(p_start/p_endのみ)。
CREATE FUNCTION public.seat_stats_for_period(p_start date DEFAULT NULL, p_end date DEFAULT NULL)
RETURNS TABLE(
  seat_order integer,
  games bigint,
  avg_score numeric,
  avg_rank numeric,
  first_rate numeric,
  last_rate numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    r.seat_order,
    count(*) AS games,
    round(avg(r.final_score), 1) AS avg_score,
    round(avg(r.rank), 2) AS avg_rank,
    round((count(*) FILTER (WHERE r.rank = 1))::numeric / count(*), 3) AS first_rate,
    round((count(*) FILTER (WHERE r.rank = 4))::numeric / count(*), 3) AS last_rate
  FROM results r
  JOIN games g ON g.game_id = r.game_id
  WHERE r.seat_order IS NOT NULL
    AND (p_start IS NULL OR g.played_at >= p_start)
    AND (p_end IS NULL OR g.played_at <= p_end)
  GROUP BY r.seat_order
  ORDER BY r.seat_order;
$function$;
