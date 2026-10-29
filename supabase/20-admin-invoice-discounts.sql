alter table public.invoices
  add column if not exists discount_rate numeric(5, 2) not null default 0
  check (discount_rate between 0 and 100);

alter table public.invoices
  add column if not exists discount_amount numeric(12, 2) not null default 0
  check (discount_amount >= 0);
