create table if not exists public.invoice_delivery_partners (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique check (length(trim(normalized_name)) > 0),
  name text not null check (length(trim(name)) > 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_delivery_partners enable row level security;

revoke all on public.invoice_delivery_partners from public, anon, authenticated;
grant select, insert, update, delete on public.invoice_delivery_partners to authenticated;

drop policy if exists "Petify admins manage invoice delivery partners" on public.invoice_delivery_partners;
create policy "Petify admins manage invoice delivery partners"
  on public.invoice_delivery_partners for all
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
