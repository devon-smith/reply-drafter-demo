-- Security-advisor fix: handle_new_user() is a SECURITY DEFINER trigger function
-- and was callable as an RPC by anon/authenticated. Triggers fire regardless of
-- EXECUTE grants, so revoke direct/RPC access.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
