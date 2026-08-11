-- Drop old signatures (CREATE OR REPLACE can't change the parameter list)
DROP FUNCTION IF EXISTS public.compute_game_results(integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.submit_game(date, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.submit_game_points(date, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer);

-- oka fix: it used to be added only to 1st place with nothing deducted from
-- anyone, so every game leaked +oka points into the system (not zero-sum).
-- Correct version: oka/4 is deducted from all 4 players, then the full oka
-- is credited to 1st place only (net: 1st gets +3/4*oka, others -oka/4).
-- p_rule_id is now a parameter instead of a hardcoded 1, so different
-- rule sets can be selected per game.
CREATE FUNCTION public.compute_game_results(
  p_rule_id integer,
  p_player1 integer, p_score1 integer, p_seat1 integer,
  p_player2 integer, p_score2 integer, p_seat2 integer,
  p_player3 integer, p_score3 integer, p_seat3 integer,
  p_player4 integer, p_score4 integer, p_seat4 integer,
  p_tobi_target integer DEFAULT NULL,
  p_tobi_by integer DEFAULT NULL
)
RETURNS TABLE(player_id integer, seat_order integer, raw_score integer, rank integer, final_score integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
declare
  v_rule record;
begin
  select * into v_rule from mahjong_rules where rule_id = p_rule_id;

  return query
  select
    t.player_id,
    t.seat_order,
    t.raw_score,
    (row_number() over (order by t.raw_score desc, t.seat_order asc))::integer as rank,
    (
      (t.raw_score - v_rule.base_score) / 1000.0
      + case row_number() over (order by t.raw_score desc, t.seat_order asc)
          when 1 then v_rule.uma_1
          when 2 then v_rule.uma_2
          when 3 then v_rule.uma_3
          when 4 then v_rule.uma_4
        end
      - v_rule.oka / 4.0
      + case when row_number() over (order by t.raw_score desc, t.seat_order asc) = 1 then v_rule.oka else 0 end
      + case when t.player_id = p_tobi_by then v_rule.tobi_reward else 0 end
      + case when t.player_id = p_tobi_target then v_rule.tobi_penalty else 0 end
    )::integer as final_score
  from (
    values
      (p_player1, p_score1, p_seat1),
      (p_player2, p_score2, p_seat2),
      (p_player3, p_score3, p_seat3),
      (p_player4, p_score4, p_seat4)
  ) as t(player_id, raw_score, seat_order);
end;
$function$;

CREATE FUNCTION public.submit_game(
  p_played_at date, p_rule_id integer,
  p_player1 integer, p_score1 integer, p_seat1 integer,
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

  return v_game_id;
end;
$function$;
