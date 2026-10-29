create table if not exists public.invoice_custom_products (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique check (length(trim(normalized_name)) > 0),
  name text not null check (length(trim(name)) > 0),
  default_unit_price numeric(12, 2) not null default 0 check (default_unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_custom_customers (
  id uuid primary key default gen_random_uuid(),
  normalized_key text not null unique check (length(trim(normalized_key)) > 0),
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0 or length(trim(phone)) > 0 or length(trim(address)) > 0)
);

alter table public.invoice_custom_products enable row level security;
alter table public.invoice_custom_customers enable row level security;

revoke all on public.invoice_custom_products, public.invoice_custom_customers
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.invoice_custom_products, public.invoice_custom_customers
  to authenticated;

drop policy if exists "Petify admins manage invoice custom products" on public.invoice_custom_products;
create policy "Petify admins manage invoice custom products"
  on public.invoice_custom_products for all
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins manage invoice custom customers" on public.invoice_custom_customers;
create policy "Petify admins manage invoice custom customers"
  on public.invoice_custom_customers for all
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
