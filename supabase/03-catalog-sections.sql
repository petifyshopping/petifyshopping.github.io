create table if not exists public.catalog_main_sections (
  id text primary key,
  title text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_sections (
  id text primary key,
  title text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_sections
  add column if not exists main_section_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_sections_main_section_id_fkey'
      and conrelid = 'public.catalog_sections'::regclass
  ) then
    alter table public.catalog_sections
      add constraint catalog_sections_main_section_id_fkey
      foreign key (main_section_id)
      references public.catalog_main_sections (id)
      on update cascade
      on delete set null;
  end if;
end;
$$;

create index if not exists catalog_sections_main_order_idx
  on public.catalog_sections (main_section_id, display_order);

alter table public.products
  add column if not exists section_id text;

insert into public.catalog_sections (id, title, display_order)
values
  ('singles', 'Single Products', 0),
  ('combos', 'Combo Offers', 1)
on conflict (id) do nothing;

update public.products
set section_id = case when type = 'combo' then 'combos' else 'singles' end
where section_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_section_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_section_id_fkey
      foreign key (section_id)
      references public.catalog_sections (id)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

create index if not exists products_section_order_idx
  on public.products (section_id, display_order);

alter table public.catalog_sections enable row level security;
grant select on public.catalog_sections to anon, authenticated;
grant insert, update on public.catalog_sections to authenticated;

alter table public.catalog_main_sections enable row level security;
grant select on public.catalog_main_sections to anon, authenticated;
grant insert, update, delete on public.catalog_main_sections to authenticated;

drop policy if exists "Catalog main sections are readable by everyone" on public.catalog_main_sections;
create policy "Catalog main sections are readable by everyone"
  on public.catalog_main_sections for select
  to anon, authenticated
  using (true);

drop policy if exists "Petify admins can insert catalog main sections" on public.catalog_main_sections;
create policy "Petify admins can insert catalog main sections"
  on public.catalog_main_sections for insert
  to authenticated
  with check (public.is_petify_admin());

drop policy if exists "Petify admins can update catalog main sections" on public.catalog_main_sections;
create policy "Petify admins can update catalog main sections"
  on public.catalog_main_sections for update
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins can delete catalog main sections" on public.catalog_main_sections;
create policy "Petify admins can delete catalog main sections"
  on public.catalog_main_sections for delete
  to authenticated
  using (public.is_petify_admin());

drop policy if exists "Active catalog sections are readable by everyone" on public.catalog_sections;
create policy "Active catalog sections are readable by everyone"
  on public.catalog_sections for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Petify admins can view all catalog sections" on public.catalog_sections;
create policy "Petify admins can view all catalog sections"
  on public.catalog_sections for select
  to authenticated
  using (public.is_petify_admin());

drop policy if exists "Petify admins can insert catalog sections" on public.catalog_sections;
create policy "Petify admins can insert catalog sections"
  on public.catalog_sections for insert
  to authenticated
  with check (public.is_petify_admin());

drop policy if exists "Petify admins can update catalog sections" on public.catalog_sections;
create policy "Petify admins can update catalog sections"
  on public.catalog_sections for update
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

grant delete on public.catalog_sections to authenticated;

drop policy if exists "Petify admins can delete empty catalog sections" on public.catalog_sections;
create policy "Petify admins can delete empty catalog sections"
  on public.catalog_sections for delete
  to authenticated
  using (public.is_petify_admin());

create table if not exists public.site_settings (
  id text primary key check (id = 'storefront'),
  logo_url text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id)
values ('storefront')
on conflict (id) do nothing;

alter table public.site_settings
  add column if not exists favicon_url text,
  add column if not exists color_palette jsonb not null default '{"preset":"petify","colors":{"primary":"#1d4ed8","primaryDark":"#1e3a8a","accent":"#f59e0b","background":"#f8fafc","text":"#0f172a","muted":"#475569","card":"#ffffff"}}'::jsonb,
  add column if not exists loading_screen jsonb not null default '{"kicker":"STORE CATALOG","title":"Getting the shop ready","message":"Fetching the latest products for you.","imageUrl":"/images/bird.png"}'::jsonb,
  add column if not exists admin_brand jsonb not null default '{"name":"Petify","label":"Catalog"}'::jsonb,
  add column if not exists brand_title text not null default 'Petify',
  add column if not exists tagline text not null default 'Pure love, premium care',
  add column if not exists whatsapp_number text not null default '919745001101',
  add column if not exists phone_display text not null default '+91 97450 01101',
  add column if not exists email text not null default 'petify.shopping@gmail.com',
  add column if not exists location text not null default 'Kerala, India',
  add column if not exists features jsonb not null default '[
    {"title":"Exotic Pets & Birds","description":"Healthy, hand-reared birds, small pets, and expert care guidance."},
    {"title":"Fish & Specialty Foods","description":"High-protein nutritional feeds for Channa, Arowana, Discus & more."},
    {"title":"Cages & Housing","description":"Durable, comfortable enclosures tailored for birds and small pets."},
    {"title":"Pet Care Accessories","description":"Essential toys, grooming supplies, and everyday care essentials."}
  ]'::jsonb,
  add column if not exists about_content jsonb not null default '{
    "title":"Thoughtful care for extraordinary companions",
    "introduction":"Petify brings together thoughtfully selected pet essentials, specialized nutrition, and habitat products to support the everyday wellbeing of the animals we love.",
    "mission":"To make thoughtful pet care easier by bringing useful products and caring guidance together in one place.",
    "vision":"A world where every companion, big or small, feathered or finned, has the care, nutrition, and environment it needs to thrive.",
    "whoWeAre":"Petify is a pet-care store for people who want to make informed, caring choices for their companions. Our collection brings everyday essentials together with specialist products for a range of pets. Have a question about a product? Our team is here to help."
  }'::jsonb,
  add column if not exists footer_title text not null default 'Petify Group',
  add column if not exists footer_legal text not null default '© Petify Group. All rights reserved. *Not for human consumption. Store in a cool, dry place.',
  add column if not exists footer_version text not null default '1.0.0',
  add column if not exists coming_soon_title text not null default 'Something big is coming soon',
  add column if not exists visibility jsonb not null default '{
    "brand": true,
    "tagline": true,
    "hero_pills": true,
    "catalog": true,
    "features": true,
    "coming_soon": true,
    "footer": true,
    "footer_copyright": true,
    "footer_disclaimer": true,
    "footer_version": true
  }'::jsonb;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'footer_copyright'
  ) then
    alter table public.site_settings
      add column footer_copyright text not null default '© Petify Group. All rights reserved.';
    update public.site_settings
    set footer_copyright = coalesce(nullif(trim(split_part(footer_legal, ' *', 1)), ''), '© Petify Group. All rights reserved.');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'footer_disclaimer'
  ) then
    alter table public.site_settings
      add column footer_disclaimer text not null default '*Not for human consumption. Store in a cool, dry place.';
    update public.site_settings
    set footer_disclaimer = case
      when position(' *' in footer_legal) > 0 then '*' || split_part(footer_legal, ' *', 2)
      else '*Not for human consumption. Store in a cool, dry place.'
    end;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'hero_pills'
  ) then
    alter table public.site_settings
      add column hero_pills jsonb not null default '[]'::jsonb;

    update public.site_settings
    set hero_pills = jsonb_build_array(
      jsonb_build_object('id', 'all-india-delivery', 'label', 'All India Delivery Available', 'target', '#site-footer'),
      jsonb_build_object('id', 'exotic-pets', 'label', 'Exotic Pets & Birds', 'target', '#site-footer'),
      jsonb_build_object(
        'id', 'ornamental-fish-food',
        'label', 'Ornamental Fish Food',
        'target', '#catalog-section-' || coalesce((select id from public.catalog_sections where is_active order by display_order limit 1), 'singles')
      ),
      jsonb_build_object('id', 'cages-enclosures', 'label', 'Cages & Enclosures', 'target', '#site-footer'),
      jsonb_build_object('id', 'premium-accessories', 'label', 'Premium Accessories', 'target', '#site-footer')
    )
    where id = 'storefront';
  end if;
end;
$$;

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

drop policy if exists "Store logo is readable by everyone" on public.site_settings;
create policy "Store logo is readable by everyone"
  on public.site_settings for select
  to anon, authenticated
  using (id = 'storefront');

drop policy if exists "Petify admins can update store logo" on public.site_settings;
create policy "Petify admins can update store logo"
  on public.site_settings for update
  to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());