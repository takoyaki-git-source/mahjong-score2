-- Follow-up fix to 20260815010000: round_go_roku applied independently to each
-- player's *total* pt (diff + uma - oka/4 + tobi) does not guarantee the four
-- final_score values sum to zero, and disagrees with the traditional mahjong
-- convention at exact hundreds-digit ties (e.g. a raw score of 8500 crosses
-- from positive to negative once base_score is subtracted, which flips which
-- direction "round half down" discards toward).
--
-- Correct method (matches manual scoring convention, verified against
-- 2026-08-15 games by hand):
--   1. Round each player's raw score to the nearest 1000 with round_go_roku
--      BEFORE subtracting base_score (not after) — this is the "百の位の
--      五捨六入" the rule actually refers to.
--   2. Ranks 2-4 are each computed independently from their own rounded score.
--   3. Rank 1 (top) is NOT rounded independently; their final_score is the
--      residual that makes the four scores sum to exactly zero. This is the
--      standard "top absorbs the leftover" convention and is what actually
--      guarantees zero-sum, since uma/oka already sum to zero by construction
--      but independent per-player rounding does not.
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
  with base as (
    select
      t.player_id, t.raw_score, t.seat_order,
      (row_number() over (order by t.raw_score desc, t.seat_order asc))::integer as rnk
    from (
      values
        (p_player1, p_score1, p_seat1),
        (p_player2, p_score2, p_seat2),
        (p_player3, p_score3, p_seat3),
        (p_player4, p_score4, p_seat4)
    ) as t(player_id, raw_score, seat_order)
  ),
  non_top as (
    select
      b.player_id,
      round_go_roku(
        (round_go_roku(b.raw_score / 1000.0) - v_rule.base_score / 1000.0)
        + case b.rnk
            when 2 then v_rule.uma_2
            when 3 then v_rule.uma_3
            when 4 then v_rule.uma_4
          end
        - v_rule.oka / 4.0
        + case when b.player_id = p_tobi_by then v_rule.tobi_reward else 0 end
        + case when b.raw_score < 0 then v_rule.tobi_penalty else 0 end
      ) as pt
    from base b
    where b.rnk <> 1
  )
  select
    b.player_id,
    b.seat_order,
    b.raw_score,
    b.rnk as rank,
    case when b.rnk = 1
      then -(select coalesce(sum(nt.pt), 0)::integer from non_top nt)
      else (select nt.pt from non_top nt where nt.player_id = b.player_id)
    end as final_score
  from base b;
end;
$function$;
