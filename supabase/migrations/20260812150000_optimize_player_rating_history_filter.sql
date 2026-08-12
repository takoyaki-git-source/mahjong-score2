-- player_rating_history()の個人詳細ページ向け呼び出しが遅い問題を修正。
--
-- 個人詳細ページはこれまで `player_rating_history()`(全プレイヤー・全対局、
-- 3468行)をフィルタなしで呼び出し、PostgREST側で`?player_id=eq.X`により
-- 絞り込んでいた。この方式には2つの問題があった:
--   1. PostgRESTのデフォルト行数上限(1000件)に切り詰められた状態から
--      フィルタするため、実際には全件を計算・シリアライズしてから絞り込む
--      形になり、対象行数(1プレイヤー分、多くて800行程度)に対して
--      無駄なオーバーヘッドが発生していた
--   2. numeric型の出力列(rating_before等)が丸められておらず、
--      "1571.542107500718"のような長い小数がそのままJSON化され、
--      ペイロードサイズを不必要に膨らませていた(実測1プレイヤー分で約1.9MB)
--
-- 対応: p_player_id引数を追加してSQL関数側でフィルタし(該当プレイヤーの
-- 行だけRETURN NEXTする。内部の状態更新自体は全プレイヤー分そのまま行う
-- 必要があるため、フィルタは出力のみに適用)、出力のnumeric列を
-- round(x, 2)で丸めた。実測でペイロードが約1.9MB→約100KBに縮小し、
-- REST経由の応答時間も1.4〜2.5秒→0.4秒程度まで改善した。
DROP FUNCTION IF EXISTS public.player_current_ratings();
DROP FUNCTION IF EXISTS public.player_rating_history();
DROP FUNCTION IF EXISTS public.player_rating_history(integer);

CREATE FUNCTION public.player_rating_history(p_player_id integer DEFAULT NULL)
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
SET search_path = public
AS $function$
DECLARE
  max_pid integer;
  ratings numeric[];
  games_count integer[];
  names text[];
  prow RECORD;
  rec RECORD;
  buf_pid integer[4];
  buf_rank integer[4];
  buf_gid text;
  buf_date date;
  buf_n integer := 0;
  i integer;
  avg_r numeric;
  result_points integer;
  games_factor numeric;
  d numeric;
  rb numeric;
  gb integer;
BEGIN
  SELECT max(p.player_id) INTO max_pid FROM players p;
  ratings := array_fill(1500::numeric, ARRAY[max_pid]);
  games_count := array_fill(0, ARRAY[max_pid]);
  names := array_fill(NULL::text, ARRAY[max_pid]);

  FOR prow IN SELECT p.player_id AS pid, p.name AS pname FROM players p LOOP
    names[prow.pid] := prow.pname;
  END LOOP;

  FOR rec IN
    SELECT g.game_id AS gid, g.played_at AS pdate, r.player_id AS pid, r.rank AS rnk
    FROM games g JOIN results r ON r.game_id = g.game_id
    ORDER BY g.game_id, r.seat_order
  LOOP
    buf_n := buf_n + 1;
    buf_pid[buf_n] := rec.pid;
    buf_rank[buf_n] := rec.rnk;
    buf_gid := rec.gid;
    buf_date := rec.pdate;

    IF buf_n = 4 THEN
      avg_r := (ratings[buf_pid[1]] + ratings[buf_pid[2]] + ratings[buf_pid[3]] + ratings[buf_pid[4]]) / 4;

      FOR i IN 1..4 LOOP
        rb := ratings[buf_pid[i]];
        gb := games_count[buf_pid[i]];
        result_points := CASE buf_rank[i] WHEN 1 THEN 30 WHEN 2 THEN 10 WHEN 3 THEN -10 WHEN 4 THEN -30 END;
        games_factor := GREATEST(0.2, 1 - gb * 0.002);
        d := games_factor * (result_points + (avg_r - rb) / 40);

        IF p_player_id IS NULL OR buf_pid[i] = p_player_id THEN
          player_id := buf_pid[i];
          name := names[buf_pid[i]];
          game_id := buf_gid;
          played_at := buf_date;
          rank := buf_rank[i];
          games_before := gb;
          rating_before := round(rb, 2);
          table_avg_rating := round(avg_r, 2);
          delta := round(d, 2);
          rating_after := round(rb + d, 2);
          RETURN NEXT;
        END IF;

        ratings[buf_pid[i]] := rb + d;
        games_count[buf_pid[i]] := gb + 1;
      END LOOP;

      buf_n := 0;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;

CREATE FUNCTION public.player_current_ratings()
RETURNS TABLE(player_id integer, name text, rating numeric, games bigint)
LANGUAGE sql
SET search_path = public
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
