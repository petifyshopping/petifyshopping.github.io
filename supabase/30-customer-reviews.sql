-- Customer service reviews with private guest contact details and admin moderation.
-- Apply after 29-customer-guest-orders.sql.

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.customer_profiles (user_id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  contact_email text not null check (length(trim(contact_email)) between 5 and 254),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (length(trim(review_text)) between 20 and 1200),
  is_verified boolean not null default false,
  status text not null default 'approved'
    check (status in ('approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null
);

create index if not exists customer_reviews_status_created_at_idx
  on public.customer_reviews (status, created_at desc);
create index if not exists customer_reviews_created_at_idx
  on public.customer_reviews (created_at desc);
create index if not exists customer_reviews_user_created_at_idx
  on public.customer_reviews (user_id, created_at desc)
  where user_id is not null;
create index if not exists customer_reviews_guest_email_created_at_idx
  on public.customer_reviews (lower(contact_email), created_at desc)
  where user_id is null;

alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from public, anon, authenticated;
grant select (id, display_name, rating, review_text, is_verified, created_at)
  on public.customer_reviews to anon, authenticated;

drop policy if exists "Anyone can read approved customer reviews" on public.customer_reviews;
drop policy if exists "Anyone can read visible customer reviews" on public.customer_reviews;
create policy "Anyone can read visible customer reviews"
  on public.customer_reviews for select to anon, authenticated
  using (status = 'approved');

create or replace function public.submit_customer_review(
  p_rating integer,
  p_review_text text,
  p_display_name text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_contact_email text := lower(trim(coalesce(p_contact_email, '')));
  v_review_text text := trim(coalesce(p_review_text, ''));
  v_is_verified boolean := false;
  v_email_confirmed boolean := false;
  v_recent_reviews bigint;
  v_review_id uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5 stars.';
  end if;
  if length(v_review_text) < 20 or length(v_review_text) > 1200 then
    raise exception 'Write a review between 20 and 1200 characters.';
  end if;

  if v_user_id is not null then
    select profile.full_name, profile.email, users.email_confirmed_at is not null
      into v_display_name, v_contact_email, v_email_confirmed
    from public.customer_profiles as profile
    join auth.users as users on users.id = profile.user_id
    where profile.user_id = v_user_id;

    if not found then
      raise exception 'A customer account is required to submit a signed-in review.'
        using errcode = '42501';
    end if;
    if not v_email_confirmed then
      raise exception 'Confirm your email before submitting a review.'
        using errcode = '42501';
    end if;
    v_is_verified := true;
  else
    if length(v_display_name) < 1 or length(v_display_name) > 80 then
      raise exception 'Enter a name between 1 and 80 characters.';
    end if;
    if length(v_contact_email) < 5
      or length(v_contact_email) > 254
      or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Enter a valid email address.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'customer-review:' || coalesce(v_user_id::text, v_contact_email),
    0
  ));
  select count(*) into v_recent_reviews
  from public.customer_reviews as reviews
  where reviews.created_at > now() - interval '10 minutes'
    and (
      (v_user_id is not null and reviews.user_id = v_user_id)
      or (
        v_user_id is null
        and reviews.user_id is null
        and lower(reviews.contact_email) = v_contact_email
      )
    );
  if v_recent_reviews >= 3 then
    raise exception 'Too many recent reviews from this account or email. Please try again later.';
  end if;

  insert into public.customer_reviews (
    user_id, display_name, contact_email, rating, review_text, is_verified, status
  )
  values (
    v_user_id, v_display_name, v_contact_email, p_rating, v_review_text, v_is_verified, 'approved'
  )
  returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke all on function public.submit_customer_review(integer, text, text, text)
  from public;
grant execute on function public.submit_customer_review(integer, text, text, text)
  to anon, authenticated;

create or replace function public.get_customer_review_summary()
returns table (average_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)::bigint
  from public.customer_reviews
  where status = 'approved';
$$;

revoke all on function public.get_customer_review_summary() from public;
grant execute on function public.get_customer_review_summary() to anon, authenticated;

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

revoke all on function public.get_admin_customer_review_page(integer, integer)
  from public, anon;
grant execute on function public.get_admin_customer_review_page(integer, integer)
  to authenticated;

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

revoke all on function public.moderate_customer_review(uuid, text) from public, anon;
grant execute on function public.moderate_customer_review(uuid, text) to authenticated;
