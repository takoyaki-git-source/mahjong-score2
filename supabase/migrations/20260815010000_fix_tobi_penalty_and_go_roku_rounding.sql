-- Two fixes to compute_game_results:
--
-- 1. Bug fix: tobi_penalty (-10) was applied based on `player_id = p_tobi_target`,
--    but the admin form always passes p_tobi_target as null (busting is meant to be
--    derived automatically from raw_score going negative, per the design already
--    documented for tobi_target). Since the parameter was always null, the penalty
--    could never trigger. Fixed to key off raw_score < 0 directly.
--
-- 2. Spec change: final_score used to round with plain `::integer` (四捨五入-style,
--    ties round up). Switched to 五捨六入 (round half DOWN): a fractional remainder
--    of .5 or less is discarded, .6 or more rounds away from zero. Implemented via
--    a new round_go_roku() helper so the rule is expressed once and testable on its
--    own.
CREATE FUNCTION public.round_go_roku(v numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT (
    sign(v) * (
      CASE WHEN abs(v) - floor(abs(v)) <= 0.5
        THEN floor(abs(v))
        ELSE floor(abs(v)) + 1
      END
    )
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.compute_game_results(
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
    round_go_roku(
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
      + case when t.raw_score < 0 then v_rule.tobi_penalty else 0 end
    ) as final_score
  from (
    values
      (p_player1, p_score1, p_seat1),
      (p_player2, p_score2, p_seat2),
      (p_player3, p_score3, p_seat3),
      (p_player4, p_score4, p_seat4)
  ) as t(player_id, raw_score, seat_order);
end;
$function$;
