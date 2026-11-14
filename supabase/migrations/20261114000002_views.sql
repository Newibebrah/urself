-- Convenience views that stay tenant-safe by running with the caller's RLS.
create or replace view public.latest_project_files
with (security_invoker = true) as
select distinct on (project_id, path)
  id, tenant_id, project_id, path, content, version, created_at
from public.project_files
order by project_id, path, version desc;

create or replace view public.project_summaries
with (security_invoker = true) as
select
  p.*,
  (select count(*)::int from public.latest_project_files f where f.project_id = p.id) as file_count,
  (select count(*)::int from public.project_messages m where m.project_id = p.id) as message_count,
  (select count(*)::int from public.project_revisions r where r.project_id = p.id) as revision_count
from public.projects p;
