create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "Users can read their own admin status" on public.admin_users;
create policy "Users can read their own admin status"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Admin authorization is evaluated against the user ID in each request's JWT.
create or replace function public.is_petify_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_petify_admin() from public;
grant execute on function public.is_petify_admin() to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Petify admins can read all products" on public.products;
create policy "Petify admins can read all products"
  on public.products for select
  to authenticated
  using (public.is_petify_admin());

drop policy if exists "Petify admins can insert products" on public.products;
create policy "Petify admins can insert products"
  on public.products for insert
  to authenticated
  with check (public.is_petify_admin());

drop policy if exists "Petify admins can update products" on public.products;
create policy "Petify admins can update products"
  on public.products for update
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins can delete products" on public.products;
create policy "Petify admins can delete products"
  on public.products for delete
  to authenticated
  using (public.is_petify_admin());

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Product images are publicly readable" on storage.objects;
create policy "Product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Petify admins can upload product images" on storage.objects;
create policy "Petify admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_petify_admin()
  );

drop policy if exists "Petify admins can update product images" on storage.objects;
create policy "Petify admins can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_petify_admin()
  )
  with check (
    bucket_id = 'product-images'
    and public.is_petify_admin()
  );

drop policy if exists "Petify admins can delete product images" on storage.objects;
create policy "Petify admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_petify_admin()
  );