-- tmp_results was the staging table used to import historical data from Google
-- Sheets into games/results (raw_score is NULL there, matching the migrated
-- rows). The conversion is complete (857 games / 3428 results match exactly),
-- so this table is no longer needed.
DROP TABLE public.tmp_results;
