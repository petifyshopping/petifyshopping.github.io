drop function if exists public.get_next_admin_invoice_number(date);

alter table public.invoices
  add column if not exists auto_number boolean not null default false;

delete from public.invoice_monthly_number_sequences as sequences
where not exists (
  select 1
  from public.invoices as invoice
  where invoice.issue_date >= sequences.month_start
    and invoice.issue_date < (sequences.month_start + interval '1 month')::date
);

update public.invoice_monthly_number_sequences as sequences
set last_number = greatest(
  (
    select count(*)
    from public.invoices as invoice
    where invoice.issue_date >= sequences.month_start
      and invoice.issue_date < (sequences.month_start + interval '1 month')::date
  ),
  coalesce((
    select max((regexp_match(
      invoice.invoice_number,
      '^INV-([0-9]{2})([0-9]{2})([0-9]{4})-([0-9]+)$'
    ))[4]::bigint
    from public.invoices as invoice
    where invoice.invoice_number ~ '^INV-[0-9]{8}-[0-9]+$'
      and substring(invoice.invoice_number from 7 for 2) = to_char(sequences.month_start, 'MM')
      and substring(invoice.invoice_number from 9 for 4) = to_char(sequences.month_start, 'YYYY')
  ), 0)
);

create or replace function public.assign_admin_invoice_number_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start date;
  v_next_number bigint;
  v_invoice_number text;
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can create invoices.' using errcode = '42501';
  end if;

  if new.issue_date is null then
    raise exception 'An invoice date is required.';
  end if;

  v_month_start := date_trunc('month', new.issue_date)::date;

  if new.auto_number is not true then
    insert into public.invoice_monthly_number_sequences as sequences (month_start, last_number)
    select
      v_month_start,
      count(*) + 1
    from public.invoices as invoice
    where invoice.issue_date >= v_month_start
      and invoice.issue_date < (v_month_start + interval '1 month')::date
    on conflict (month_start)
    do update set last_number = sequences.last_number + 1;
    return new;
  end if;

  loop
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

    v_invoice_number := 'INV-'
      || to_char(new.issue_date, 'DDMMYYYY')
      || '-'
      || lpad(v_next_number::text, 3, '0');

    exit when not exists (
      select 1
      from public.invoices as invoice
      where invoice.invoice_number = v_invoice_number
    );
  end loop;

  new.invoice_number := v_invoice_number;
  new.auto_number := false;
  return new;
end;
$$;

revoke all on function public.assign_admin_invoice_number_on_insert() from public, anon, authenticated;

drop trigger if exists set_admin_invoice_number_before_insert on public.invoices;
create trigger set_admin_invoice_number_before_insert
before insert on public.invoices
for each row
execute function public.assign_admin_invoice_number_on_insert();
