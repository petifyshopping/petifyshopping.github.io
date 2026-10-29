alter table public.invoices
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'sent', 'paid'));
