-- Restore admin workspace-draft storage after the legacy Sales backend cleanup.
-- Apply this after 10-remove-sales-backend.sql and 15-admin-access-after-sales-removal.sql.

create table if not exists public.workspace_drafts (
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_type text not null check (draft_type in ('product', 'site-content', 'site-appearance', 'site-assets')),
  draft_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_type, draft_key)
);

alter table public.workspace_drafts enable row level security;
revoke all on public.workspace_drafts from public, anon;
grant select, insert, update, delete on public.workspace_drafts to authenticated;

drop policy if exists "Workspace owners can read permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can read permitted drafts"
  on public.workspace_drafts for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_petify_admin())
  );

drop policy if exists "Workspace owners can create permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can create permitted drafts"
  on public.workspace_drafts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_petify_admin())
  );

drop policy if exists "Workspace owners can update permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can update permitted drafts"
  on public.workspace_drafts for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_petify_admin())
  )
  with check (
    user_id = (select auth.uid())
    and (select public.is_petify_admin())
  );

drop policy if exists "Workspace owners can delete permitted drafts" on public.workspace_drafts;
create policy "Workspace owners can delete permitted drafts"
  on public.workspace_drafts for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_petify_admin())
  );
