CREATE OR REPLACE FUNCTION public.submit_game_points(
  p_played_at date,
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
  -- 過去のスプレッドシート形式(ウマオカトビ計算後の最終ポイントのみ)を直接記録するための経路。
  -- submit_game と異なり raw_score は記録せず、final_score にポイントをそのまま入れる。

  v_game_id := generate_game_id(p_played_at);

  insert into games (
    game_id,
    played_at,
    rule_id,
    tobi_target_player_id,
    tobi_by_player_id
  )
  values (
    v_game_id,
    p_played_at,
    1,
    p_tobi_target,
    p_tobi_by
  );

  insert into results (
    game_id,
    player_id,
    raw_score,
    seat_order,
    rank,
    final_score
  )
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
