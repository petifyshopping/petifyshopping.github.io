-- Admin controls and customer consent for contact details in WhatsApp order messages.
-- Apply after 13-customer-order-management.sql.

alter table public.site_settings
  add column if not exists customer_order_contact_fields jsonb not null
    default '{"email":false,"phone":true,"whatsapp":false}'::jsonb;

alter table public.customer_profiles
  add column if not exists whatsapp_phone text not null default '',
  add column if not exists whatsapp_same_as_phone boolean not null default true,
  add column if not exists share_email_in_orders boolean not null default false,
  add column if not exists share_phone_in_orders boolean not null default true,
  add column if not exists share_whatsapp_in_orders boolean not null default false;

grant update (
  full_name,
  phone,
  whatsapp_phone,
  whatsapp_same_as_phone,
  share_email_in_orders,
  share_phone_in_orders,
  share_whatsapp_in_orders,
  address
) on public.customer_profiles to authenticated;

create or replace function public.create_customer_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_account_type text := lower(coalesce(new.raw_user_meta_data ->> 'account_type', ''));
  v_address text := trim(coalesce(new.raw_user_meta_data ->> 'address', ''));
  v_same_whatsapp boolean := coalesce(
    new.raw_user_meta_data ->> 'whatsapp_same_as_phone',
    'true'
  ) <> 'false';
begin
  if v_account_type = 'customer' then
    insert into public.customer_profiles (
      user_id,
      email,
      full_name,
      phone,
      address,
      whatsapp_phone,
      whatsapp_same_as_phone
    )
    values (
      new.id,
      lower(trim(new.email)),
      trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'phone', '')),
      v_address,
      case when v_same_whatsapp then '' else trim(coalesce(new.raw_user_meta_data ->> 'whatsapp_phone', '')) end,
      v_same_whatsapp
    );

    if length(v_address) between 5 and 500 then
      insert into public.customer_addresses (user_id, label, address)
      values (new.id, 'Home', v_address)
      on conflict (user_id, label, address) do nothing;
    end if;
  elsif nullif(trim(new.email), '') is not null then
    insert into public.access_requests (user_id, email)
    values (new.id, lower(trim(new.email)))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.create_customer_profile_for_auth_user() from public, anon, authenticated;
