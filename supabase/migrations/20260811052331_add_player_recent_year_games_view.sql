-- Per-player game count within the trailing 1 year, used to order the
-- player picker on the input form (recent activity first).
CREATE VIEW public.player_recent_year_games
WITH (security_invoker = true) AS
SELECT r.player_id, count(*) AS recent_games
FROM results r
JOIN games g ON g.game_id = r.game_id
WHERE g.played_at >= (current_date - interval '1 year')
GROUP BY r.player_id;
