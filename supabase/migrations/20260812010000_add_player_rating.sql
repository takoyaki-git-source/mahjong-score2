-- 天鳳風レーティング(段位戦・4人打ち)の計算。
--
-- (Rateの変動) = (試合数補正) x (対戦結果 + 補正値) x (スケーリング係数)
--   試合数補正 = GREATEST(0.2, 1 - 試合数(この対局より前) x 0.002)
--   対戦結果(4人打ち) = 1位+30 2位+10 3位-10 4位-30
--   補正値 = (卓の平均R(この対局に参加した4人の対局前レート平均) - 自分のR) / 40
--   スケーリング係数(段位戦) = 1.0
--   初期値 R=1500
--
-- レーティングは全対局を通した逐次計算(卓内の相互作用に依存)のため、期間指定や
-- 直近N半荘のようなフィルタは適用できない(常に全履歴を通しで計算する)。
-- `games`テーブルは857半荘とも全て4人打ち固定ルールのため、3人打ち/雀荘戦の式は実装しない。
DROP FUNCTION IF EXISTS public.player_current_ratings();
DROP FUNCTION IF EXISTS public.player_rating_history();

CREATE FUNCTION public.player_rating_history()
RETURNS TABLE(
  player_id integer,
  name text,
  game_id text,
  played_at date,
  rank integer,
  games_before integer,
  rating_before numeric,
  table_avg_rating numeric,
  delta numeric,
  rating_after numeric
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  g_id text;
BEGIN
  CREATE TEMP TABLE _rating_state (
    player_id integer PRIMARY KEY,
    rating numeric NOT NULL DEFAULT 1500,
    games integer NOT NULL DEFAULT 0
  ) ON COMMIT DROP;
  INSERT INTO _rating_state (player_id, rating, games)
  SELECT p.player_id, 1500, 0 FROM players p;

  CREATE TEMP TABLE _rating_history (
    player_id integer,
    name text,
    game_id text,
    played_at date,
    rank integer,
    games_before integer,
    rating_before numeric,
    table_avg_rating numeric,
    delta numeric,
    rating_after numeric
  ) ON COMMIT DROP;

  FOR g_id IN SELECT g.game_id FROM games g ORDER BY g.game_id LOOP
    WITH participants AS (
      SELECT r.player_id, r.rank, s.rating, s.games
      FROM results r
      JOIN _rating_state s ON s.player_id = r.player_id
      WHERE r.game_id = g_id
    ),
    avgc AS (
      SELECT avg(rating) AS avg_rating FROM participants
    ),
    computed AS (
      SELECT
        p.player_id, p.rank, p.rating AS rating_before, p.games AS games_before,
        a.avg_rating,
        (CASE p.rank WHEN 1 THEN 30 WHEN 2 THEN 10 WHEN 3 THEN -10 WHEN 4 THEN -30 END) AS result_points,
        GREATEST(0.2, 1 - p.games * 0.002) AS games_factor
      FROM participants p, avgc a
    )
    INSERT INTO _rating_history (player_id, name, game_id, played_at, rank, games_before, rating_before, table_avg_rating, delta, rating_after)
    SELECT
      c.player_id, pl.name, g_id, gm.played_at, c.rank, c.games_before, c.rating_before, c.avg_rating,
      c.games_factor * (c.result_points + (c.avg_rating - c.rating_before) / 40),
      c.rating_before + c.games_factor * (c.result_points + (c.avg_rating - c.rating_before) / 40)
    FROM computed c
    JOIN players pl ON pl.player_id = c.player_id
    JOIN games gm ON gm.game_id = g_id;

    UPDATE _rating_state s
    SET rating = h.rating_after, games = h.games_before + 1
    FROM _rating_history h
    WHERE h.game_id = g_id AND h.player_id = s.player_id;
  END LOOP;

  RETURN QUERY SELECT * FROM _rating_history ORDER BY _rating_history.player_id, _rating_history.game_id;
END;
$function$;

-- 各プレイヤーの現在(最新)のレーティング。一度も対局していないプレイヤーは初期値1500。
CREATE FUNCTION public.player_current_ratings()
RETURNS TABLE(player_id integer, name text, rating numeric, games bigint)
LANGUAGE sql
SET search_path = public, pg_temp
AS $function$
  WITH history AS (
    SELECT * FROM public.player_rating_history()
  ),
  latest AS (
    SELECT DISTINCT ON (h.player_id) h.player_id, h.rating_after AS rating, h.games_before + 1 AS games
    FROM history h
    ORDER BY h.player_id, h.game_id DESC
  )
  SELECT p.player_id, p.name, coalesce(l.rating, 1500), coalesce(l.games, 0)
  FROM players p
  LEFT JOIN latest l ON l.player_id = p.player_id;
$function$;
