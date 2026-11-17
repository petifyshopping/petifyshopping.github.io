create table if not exists public.invoice_monthly_number_sequences (
  month_start date primary key,
  last_number bigint not null check (last_number > 0)
);

alter table public.invoice_monthly_number_sequences enable row level security;
revoke all on public.invoice_monthly_number_sequences from public, anon, authenticated;

create or replace function public.get_next_admin_invoice_number(p_invoice_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start date;
  v_next_number bigint;
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can generate invoice numbers.' using errcode = '42501';
  end if;

  if p_invoice_date is null then
    raise exception 'An invoice date is required.';
  end if;

  v_month_start := date_trunc('month', p_invoice_date)::date;

  insert into public.invoice_monthly_number_sequences as sequences (month_start, last_number)
  select
    v_month_start,
    count(*) + 1
  from public.invoices as invoice
  where invoice.issue_date >= v_month_start
    and invoice.issue_date < (v_month_start + interval '1 month')::date
  on conflict (month_start)
  do update set last_number = sequences.last_number + 1
  returning last_number into v_next_number;

  return 'INV-'
    || to_char(p_invoice_date, 'DDMMYYYY')
    || '-'
    || lpad(v_next_number::text, 3, '0');
end;
$$;

revoke all on function public.get_next_admin_invoice_number(date) from public, anon;
grant execute on function public.get_next_admin_invoice_number(date) to authenticated;
