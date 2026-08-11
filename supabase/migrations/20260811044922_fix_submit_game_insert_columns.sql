-- The previous migration's submit_game had a column-count mismatch between
-- the INSERT target list (game_id, player_id, raw_score, seat_order, rank,
-- final_score) and its SELECT (missing v_game_id, and columns out of order).
-- PL/pgSQL doesn't validate embedded SQL until first call, so this only
-- surfaced when actually invoking submit_game(). Fixed here.
CREATE OR REPLACE FUNCTION public.submit_game(
  p_played_at date, p_player1 integer, p_score1 integer, p_seat1 integer,
  p_player2 integer, p_score2 integer, p_seat2 integer,
  p_player3 integer, p_score3 integer, p_seat3 integer,
  p_player4 integer, p_score4 integer, p_seat4 integer,
  p_tobi_target integer DEFAULT NULL,
  p_tobi_by integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
declare
  v_game_id text;
begin
  v_game_id := generate_game_id(p_played_at);

  insert into games (game_id, played_at, rule_id, tobi_target_player_id, tobi_by_player_id)
  values (v_game_id, p_played_at, 1, p_tobi_target, p_tobi_by);

  insert into results (game_id, player_id, raw_score, seat_order, rank, final_score)
  select v_game_id, cgr.player_id, cgr.raw_score, cgr.seat_order, cgr.rank, cgr.final_score
  from compute_game_results(
    p_player1, p_score1, p_seat1,
    p_player2, p_score2, p_seat2,
    p_player3, p_score3, p_seat3,
    p_player4, p_score4, p_seat4,
    p_tobi_target, p_tobi_by
  ) as cgr;

  return v_game_id;
end;
$function$;
