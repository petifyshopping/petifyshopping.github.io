create table if not exists public.invoice_monthly_number_sequences (
  month_start date primary key,
  last_number bigint not null check (last_number > 0)
);

alter table public.invoice_monthly_number_sequences enable row level security;
revoke all on public.invoice_monthly_number_sequences from public, anon, authenticated;
