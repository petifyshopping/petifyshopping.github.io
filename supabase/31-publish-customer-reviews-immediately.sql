-- Publish customer reviews immediately and let admins hide or restore them.
-- Apply after 30-customer-reviews.sql.

alter table public.customer_reviews
  alter column status set default 'approved';

update public.customer_reviews
set status = 'approved'
where status = 'pending';

alter table public.customer_reviews
  drop constraint if exists customer_reviews_status_check;

alter table public.customer_reviews
  add constraint customer_reviews_status_check
  check (status in ('approved', 'rejected'));

create index if not exists customer_reviews_created_at_idx
  on public.customer_reviews (created_at desc);

drop policy if exists "Anyone can read approved customer reviews" on public.customer_reviews;
drop policy if exists "Anyone can read visible customer reviews" on public.customer_reviews;
create policy "Anyone can read visible customer reviews"
  on public.customer_reviews for select to anon, authenticated
  using (status = 'approved');

create or replace function public.get_admin_customer_review_page(
  p_from integer default 0,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_total bigint;
  v_rows jsonb;
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can review customer feedback.'
      using errcode = '42501';
  end if;
  if p_from is null or p_from < 0 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Choose a valid customer review page.';
  end if;

  select count(*) into v_total
  from public.customer_reviews;

  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select id, user_id, display_name, contact_email, rating, review_text, is_verified, status, created_at
    from public.customer_reviews
    order by created_at desc
    offset p_from
    limit p_page_size
  ) as page_rows;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

create or replace function public.moderate_customer_review(
  p_review_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can moderate customer reviews.'
      using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose whether to show or hide the review.';
  end if;

  update public.customer_reviews
  set status = p_decision,
      moderated_at = now(),
      moderated_by = (select auth.uid())
  where id = p_review_id
    and status in ('approved', 'rejected');
  if not found then
    raise exception 'The customer review could not be found.';
  end if;
end;
$$;
