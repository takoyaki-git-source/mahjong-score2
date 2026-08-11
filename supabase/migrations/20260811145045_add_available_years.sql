CREATE OR REPLACE FUNCTION public.available_years()
RETURNS TABLE(year integer)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT DISTINCT EXTRACT(year FROM played_at)::integer AS year
  FROM games
  ORDER BY year DESC;
$function$;
