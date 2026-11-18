-- Allow customers to delete their own orders and admins to delete any order.
-- Apply after 26-admin-invoice-number-on-save.sql.

grant delete on public.customer_orders to authenticated;

drop policy if exists "Customers and admins can delete customer orders" on public.customer_orders;
create policy "Customers and admins can delete customer orders"
  on public.customer_orders for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_petify_admin());
