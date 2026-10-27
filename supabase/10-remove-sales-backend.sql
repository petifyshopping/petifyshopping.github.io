-- Remove the legacy Sales module created by 04-sales.sql, 05-admin-sales-editing.sql,
-- and 06-inventory-dashboard.sql. Run this in Supabase SQL Editor only if you want
-- to fully remove the Sales backend from the running project.

-- Drop inventory and Sales triggers
DROP TRIGGER IF EXISTS products_create_inventory_row ON public.products;
DROP TRIGGER IF EXISTS sale_items_deduct_inventory ON public.sale_items;
DROP TRIGGER IF EXISTS sales_restock_inventory_on_terminal_status ON public.sales;

-- Drop Sales-specific functions
DROP FUNCTION IF EXISTS public.get_sales_dashboard_metrics();
DROP FUNCTION IF EXISTS public.restock_inventory_for_terminal_sale();
DROP FUNCTION IF EXISTS public.deduct_inventory_for_sale_item();
DROP FUNCTION IF EXISTS public.create_product_inventory_row();
DROP FUNCTION IF EXISTS public.set_manual_sale_payment_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.record_sale_payment(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.delete_manual_sale(uuid);
DROP FUNCTION IF EXISTS public.update_manual_sale(uuid, text, text, text, jsonb, text, text, text, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text, text, text, text, text, numeric, text);
DROP FUNCTION IF EXISTS public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text);

-- Drop Sales-specific tables in dependency order.
DROP TABLE IF EXISTS public.product_inventory_movements;
DROP TABLE IF EXISTS public.sale_payments;
DROP TABLE IF EXISTS public.sale_items;
DROP TABLE IF EXISTS public.sales;
DROP TABLE IF EXISTS public.business_customers;
DROP TABLE IF EXISTS public.workspace_drafts;
DROP TABLE IF EXISTS public.sales_users;

-- Remove Sales-specific sequence if present
DROP SEQUENCE IF EXISTS public.sales_invoice_number_seq;

-- Drop Sales-related policies if present on shared tables
DROP POLICY IF EXISTS "Petify admins manage product inventory" ON public.product_inventory;
DROP POLICY IF EXISTS "Petify admins read inventory movements" ON public.product_inventory_movements;
DROP POLICY IF EXISTS "Petify sales users manage business customers" ON public.business_customers;
DROP POLICY IF EXISTS "Petify admins manage sales" ON public.sales;
DROP POLICY IF EXISTS "Petify sales users manage sales" ON public.sales;
DROP POLICY IF EXISTS "Petify sales users read sales" ON public.sales;
DROP POLICY IF EXISTS "Petify sales users create sales" ON public.sales;
DROP POLICY IF EXISTS "Petify sales users update sales" ON public.sales;
DROP POLICY IF EXISTS "Petify admins delete sales" ON public.sales;
DROP POLICY IF EXISTS "Petify sales users manage sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Petify sales users read sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Petify sales users create sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Petify admins delete sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Petify admins delete sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Petify sales users manage sale payments" ON public.sale_payments;
DROP POLICY IF EXISTS "Petify admins can manage Sales user access" ON public.sales_users;
DROP POLICY IF EXISTS "Sales users can read their own access" ON public.sales_users;
DROP POLICY IF EXISTS "Workspace owners can read permitted drafts" ON public.workspace_drafts;
DROP POLICY IF EXISTS "Workspace owners can create permitted drafts" ON public.workspace_drafts;
DROP POLICY IF EXISTS "Workspace owners can update permitted drafts" ON public.workspace_drafts;
DROP POLICY IF EXISTS "Workspace owners can delete permitted drafts" ON public.workspace_drafts;

-- Clear any remaining Sales settings from storefront settings.
UPDATE public.site_settings
SET sales_settings = '{"enabled":false,"invoice_prefix":"INV","default_payment_method":"cash"}'::jsonb,
    updated_at = now()
WHERE id = 'storefront';

-- If you are keeping the admin-only access contract, keep the admin_users/access_requests
-- tables and keep the app's 09-admin-only-access.sql function in place.
