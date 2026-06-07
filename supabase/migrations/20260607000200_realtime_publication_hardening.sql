-- Remove sensitive tables from realtime publication.
-- emergency_contacts contains user email + message bodies; only admins use it
-- and the admin tab already does a manual load() on changes, so polling/refresh
-- via the existing button + load is sufficient.
-- system_controls broadcasts kill-switch state with a `reason` field that must
-- stay admin-only; clients can fetch via get_kill_switch_state() RPC instead.
ALTER PUBLICATION supabase_realtime DROP TABLE public.emergency_contacts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.system_controls;
