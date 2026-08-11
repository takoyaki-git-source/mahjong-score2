-- Fix SECURITY DEFINER views: make them run with the querying user's privileges (invoker) instead of the creator's
ALTER VIEW public.matchup_base SET (security_invoker = true);
ALTER VIEW public.matchup_stats SET (security_invoker = true);
ALTER VIEW public.player_base_stats SET (security_invoker = true);
ALTER VIEW public.player_daily_stats SET (security_invoker = true);
ALTER VIEW public.player_daily_summary SET (security_invoker = true);
ALTER VIEW public.player_last_streak SET (security_invoker = true);
ALTER VIEW public.player_last_streak_blocks SET (security_invoker = true);
ALTER VIEW public.player_last_streak_distribution SET (security_invoker = true);
ALTER VIEW public.player_last_streak_distribution_rate SET (security_invoker = true);
ALTER VIEW public.player_no_last_streak SET (security_invoker = true);
ALTER VIEW public.player_no_top_streak SET (security_invoker = true);
ALTER VIEW public.player_stats_all SET (security_invoker = true);
ALTER VIEW public.player_stats_full SET (security_invoker = true);
ALTER VIEW public.player_streak_base SET (security_invoker = true);
ALTER VIEW public.player_top_streak SET (security_invoker = true);
ALTER VIEW public.player_top_streak_blocks SET (security_invoker = true);
ALTER VIEW public.player_top_streak_distribution SET (security_invoker = true);
ALTER VIEW public.player_top_streak_distribution_rate SET (security_invoker = true);
ALTER VIEW public.player_yakuman_stats SET (security_invoker = true);

-- Fix function_search_path_mutable: pin search_path so these functions can't be hijacked by a role-local search_path
ALTER FUNCTION public.generate_game_id(date) SET search_path = public, pg_temp;
ALTER FUNCTION public.submit_game(date, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) SET search_path = public, pg_temp;
