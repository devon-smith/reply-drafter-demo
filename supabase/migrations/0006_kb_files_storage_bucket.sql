-- Track B / Prompt B1: private Storage bucket for uploaded writing-material,
-- with per-user path isolation. Files live at "<email>/<filename>".

insert into storage.buckets (id, name, public)
values ('kb-files', 'kb-files', false)
on conflict (id) do nothing;

-- RLS on storage.objects (Supabase enables it by default): a user may only touch
-- objects whose first path segment equals their JWT email.
drop policy if exists kb_files_self_select on storage.objects;
create policy kb_files_self_select on storage.objects
  for select
  using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (auth.jwt() ->> 'email'));

drop policy if exists kb_files_self_insert on storage.objects;
create policy kb_files_self_insert on storage.objects
  for insert
  with check (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (auth.jwt() ->> 'email'));

drop policy if exists kb_files_self_update on storage.objects;
create policy kb_files_self_update on storage.objects
  for update
  using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (auth.jwt() ->> 'email'))
  with check (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (auth.jwt() ->> 'email'));

drop policy if exists kb_files_self_delete on storage.objects;
create policy kb_files_self_delete on storage.objects
  for delete
  using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (auth.jwt() ->> 'email'));
