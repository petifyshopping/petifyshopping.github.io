create table if not exists public.invoice_settings (
  id text primary key check (id = 'default'),
  business_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(business_details) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.invoice_settings enable row level security;
revoke all on public.invoice_settings from public, anon, authenticated;
grant select, insert, update on public.invoice_settings to authenticated;

drop policy if exists "Petify admins manage invoice settings" on public.invoice_settings;
create policy "Petify admins manage invoice settings"
  on public.invoice_settings for all
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
