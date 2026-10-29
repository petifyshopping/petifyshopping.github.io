create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique check (length(trim(invoice_number)) between 1 and 80),
  business_details jsonb not null default '{}'::jsonb check (jsonb_typeof(business_details) = 'object'),
  customer_details jsonb not null default '{}'::jsonb check (jsonb_typeof(customer_details) = 'object'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  issue_date date not null default current_date,
  due_date date,
  notes text not null default '',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_created_at_idx
  on public.invoices (created_at desc);

alter table public.invoices enable row level security;
revoke all on public.invoices from public, anon, authenticated;
grant select, insert, update, delete on public.invoices to authenticated;

drop policy if exists "Petify admins manage invoices" on public.invoices;
create policy "Petify admins manage invoices"
  on public.invoices for all
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
