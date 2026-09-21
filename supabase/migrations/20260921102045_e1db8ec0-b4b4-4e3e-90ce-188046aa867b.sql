
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  )
$$;
GRANT EXECUTE ON FUNCTION private.are_friends(uuid, uuid) TO authenticated, service_role;

DROP POLICY "locations_select_self_or_friends" ON public.locations;
CREATE POLICY "locations_select_self_or_friends" ON public.locations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (sharing AND private.are_friends(auth.uid(), user_id)));

DROP POLICY "pings_insert_own" ON public.pings;
CREATE POLICY "pings_insert_own" ON public.pings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND private.are_friends(auth.uid(), to_user));

DROP FUNCTION public.are_friends(uuid, uuid);
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
