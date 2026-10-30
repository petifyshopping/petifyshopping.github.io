alter table public.invoices
  add column if not exists delivery_charge_enabled boolean not null default false;

alter table public.invoices
  add column if not exists delivery_charge numeric(12, 2) not null default 0
  check (delivery_charge >= 0);

alter table public.invoices
  add column if not exists free_delivery boolean not null default false;
