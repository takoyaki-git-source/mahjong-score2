-- Enable RLS on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yakuman_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mahjong_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_results ENABLE ROW LEVEL SECURITY;

-- Public read access (players, games, results, yakuman_events, mahjong_rules)
CREATE POLICY "public_read" ON public.players FOR SELECT TO public USING (true);
CREATE POLICY "public_read" ON public.games FOR SELECT TO public USING (true);
CREATE POLICY "public_read" ON public.results FOR SELECT TO public USING (true);
CREATE POLICY "public_read" ON public.yakuman_events FOR SELECT TO public USING (true);
CREATE POLICY "public_read" ON public.mahjong_rules FOR SELECT TO public USING (true);

-- Owner-only writes (authenticated = the single owner account)
CREATE POLICY "owner_insert" ON public.players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_update" ON public.players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_delete" ON public.players FOR DELETE TO authenticated USING (true);

CREATE POLICY "owner_insert" ON public.games FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_update" ON public.games FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_delete" ON public.games FOR DELETE TO authenticated USING (true);

CREATE POLICY "owner_insert" ON public.results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_update" ON public.results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_delete" ON public.results FOR DELETE TO authenticated USING (true);

CREATE POLICY "owner_insert" ON public.yakuman_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_update" ON public.yakuman_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_delete" ON public.yakuman_events FOR DELETE TO authenticated USING (true);

CREATE POLICY "owner_insert" ON public.mahjong_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_update" ON public.mahjong_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_delete" ON public.mahjong_rules FOR DELETE TO authenticated USING (true);

-- tmp_results: locked down to owner only, no public access (temporary staging table)
CREATE POLICY "owner_only" ON public.tmp_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
