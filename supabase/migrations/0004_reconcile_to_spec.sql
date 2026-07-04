-- Reconcile the schema to the Phase 0.2 spec exactly:
--  - drop the app_user FKs on kb_entry / prompt_setting (spec keys by plain email text)
--  - default '' on prompt_setting.system_prompt_append and tone
--  - app_user is service-role-only (RLS enabled, no user-facing policy)
-- kb_entry / prompt_setting keep their self-CRUD policies (user_email = jwt email).

alter table public.kb_entry       drop constraint if exists kb_entry_user_email_fkey;
alter table public.prompt_setting drop constraint if exists prompt_setting_user_email_fkey;

alter table public.prompt_setting alter column system_prompt_append set default '';
alter table public.prompt_setting alter column tone                 set default '';

drop policy if exists app_user_self_select on public.app_user;
