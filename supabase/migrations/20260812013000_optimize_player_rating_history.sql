-- player_rating_history()のパフォーマンス改善。
--
-- 旧実装は対局ごとにINSERT/UPDATE文を発行するループだったため、867半荘分の
-- ループでSQL文の発行回数が膨れ上がり(計画・実行のオーバーヘッドが積み重なり)、
-- 成績一覧の初期表示が70秒以上かかる状態になっていた。
--
-- 新実装は「対局・結果を1回のSELECTで全件先読み → 4行(1半荘分)ずつバッファし、
-- レーティング状態はplayer_idを添字とするPL/pgSQL配列上でのみ更新 → RETURN NEXT」
-- という完全にメモリ内で完結する形に書き換え、対局ごとのSQL発行を無くした。
-- 計算結果(各プレイヤーの最終レーティング)は旧実装と一致することを確認済み。
-- 実行時間は870半荘分で約80ms程度(旧実装は70秒超)。
CREATE OR REPLACE FUNCTION public.player_rating_history()
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

        player_id := buf_pid[i];
        name := names[buf_pid[i]];
        game_id := buf_gid;
        played_at := buf_date;
        rank := buf_rank[i];
        games_before := gb;
        rating_before := rb;
        table_avg_rating := avg_r;
        delta := d;
        rating_after := rb + d;
        RETURN NEXT;

        ratings[buf_pid[i]] := rb + d;
        games_count[buf_pid[i]] := gb + 1;
      END LOOP;

      buf_n := 0;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;
