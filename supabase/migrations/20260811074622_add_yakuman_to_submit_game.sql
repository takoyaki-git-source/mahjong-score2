DROP FUNCTION IF EXISTS public.submit_game(date, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.submit_game_points(date, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer);

-- p_yakuman: jsonb array of {"player_id": int, "yakuman_type": text, "target_player_id": int|null}.
-- Recorded in the same call as the game/results so a half-game and its
-- yakuman are registered atomically.
CREATE FUNCTION public.submit_game(
  p_played_at date, p_rule_id integer,
  p_player1 integer, p_score1 integer, p_seat1 integer,
  p_player2 integer, p_score2 integer, p_seat2 integer,
  p_player3 integer, p_score3 integer, p_seat3 integer,
  p_player4 integer, p_score4 integer, p_seat4 integer,
  p_tobi_target integer DEFAULT NULL,
  p_tobi_by integer DEFAULT NULL,
  p_yakuman jsonb DEFAULT '[]'::jsonb
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
  values (v_game_id, p_played_at, p_rule_id, p_tobi_target, p_tobi_by);

  insert into results (game_id, player_id, raw_score, seat_order, rank, final_score)
  select v_game_id, cgr.player_id, cgr.raw_score, cgr.seat_order, cgr.rank, cgr.final_score
  from compute_game_results(
    p_rule_id,
    p_player1, p_score1, p_seat1,
    p_player2, p_score2, p_seat2,
    p_player3, p_score3, p_seat3,
    p_player4, p_score4, p_seat4,
    p_tobi_target, p_tobi_by
  ) as cgr;

  if jsonb_array_length(p_yakuman) > 0 then
    insert into yakuman_events (game_id, player_id, yakuman_type, target_player_id)
    select
      v_game_id,
      (elem->>'player_id')::integer,
      elem->>'yakuman_type',
      (elem->>'target_player_id')::integer
    from jsonb_array_elements(p_yakuman) as elem;
  end if;

  return v_game_id;
end;
$function$;

CREATE FUNCTION public.submit_game_points(
  p_played_at date, p_rule_id integer,
  p_player1 integer, p_points1 integer, p_seat1 integer,
  p_player2 integer, p_points2 integer, p_seat2 integer,
  p_player3 integer, p_points3 integer, p_seat3 integer,
  p_player4 integer, p_points4 integer, p_seat4 integer,
  p_tobi_target integer DEFAULT NULL,
  p_tobi_by integer DEFAULT NULL,
  p_yakuman jsonb DEFAULT '[]'::jsonb
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
  values (v_game_id, p_played_at, p_rule_id, p_tobi_target, p_tobi_by);

  insert into results (game_id, player_id, raw_score, seat_order, rank, final_score)
  select
    v_game_id,
    player_id,
    null,
    seat_order,
    row_number() over (order by points desc, seat_order asc) as rank,
    points as final_score
  from (
    values
      (p_player1, p_points1, p_seat1),
      (p_player2, p_points2, p_seat2),
      (p_player3, p_points3, p_seat3),
      (p_player4, p_points4, p_seat4)
  ) as t(player_id, points, seat_order);

  if jsonb_array_length(p_yakuman) > 0 then
    insert into yakuman_events (game_id, player_id, yakuman_type, target_player_id)
    select
      v_game_id,
      (elem->>'player_id')::integer,
      elem->>'yakuman_type',
      (elem->>'target_player_id')::integer
    from jsonb_array_elements(p_yakuman) as elem;
  end if;

  return v_game_id;
end;
$function$;
