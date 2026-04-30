
-- ============ ENUMS ============
CREATE TYPE app_role AS ENUM ('admin', 'cashier');
CREATE TYPE movement_type AS ENUM ('sale', 'purchase', 'adjustment', 'return', 'rebuild');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'mobicash', 'yusrpay', 'edfaali', 'mobinab', 'transfer');
CREATE TYPE cash_tx_type AS ENUM ('opening', 'sale', 'expense', 'withdrawal', 'deposit', 'closing');
CREATE TYPE rebuild_type AS ENUM ('inventory', 'financials', 'product_integrity', 'anomalies');
CREATE TYPE rebuild_status AS ENUM ('queued', 'running', 'completed', 'failed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  pin_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES (separate table — security best practice) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ SUPPLIERS / CUSTOMERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT NOT NULL,
  scientific_name TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  barcode TEXT UNIQUE,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  pack_size INTEGER NOT NULL DEFAULT 1,
  has_expiry BOOLEAN NOT NULL DEFAULT false,
  min_stock INTEGER NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);

-- ============ PRODUCT BATCHES ============
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT,
  expiry_date DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batches_product ON public.product_batches(product_id);
CREATE INDEX idx_batches_expiry ON public.product_batches(expiry_date);

-- ============ CASH DRAWERS ============
CREATE TABLE public.cash_drawers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC,
  expected_balance NUMERIC NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  is_open BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_drawers_user ON public.cash_drawers(user_id);

-- ============ SALES ============
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  drawer_id UUID REFERENCES public.cash_drawers(id),
  customer_id UUID REFERENCES public.customers(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  is_voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sales_invoice ON public.sales(invoice_number);
CREATE INDEX idx_sales_user ON public.sales(user_id);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  quantity NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method payment_method NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_sale ON public.payments(sale_id);

-- ============ PURCHASES ============
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  quantity NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL
);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  type movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_movements_created ON public.stock_movements(created_at DESC);

-- ============ CASH TRANSACTIONS ============
CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id UUID NOT NULL REFERENCES public.cash_drawers(id) ON DELETE CASCADE,
  type cash_tx_type NOT NULL,
  amount NUMERIC NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_tx_drawer ON public.cash_transactions(drawer_id);

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  drawer_id UUID REFERENCES public.cash_drawers(id),
  user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PARTNER WITHDRAWALS ============
CREATE TABLE public.partner_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ EDIT LOG ============
CREATE TABLE public.edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edit_log_record ON public.edit_log(table_name, record_id);
CREATE INDEX idx_edit_log_date ON public.edit_log(edited_at DESC);

-- ============ SYSTEM REBUILDS ============
CREATE TABLE public.system_rebuilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type rebuild_type NOT NULL,
  status rebuild_status NOT NULL DEFAULT 'queued',
  report JSONB,
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ AUTO-GENERATE INVOICE NUMBER ============
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_invoice_number
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- ============ STOCK UPDATE TRIGGER ============
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  delta NUMERIC;
BEGIN
  delta := CASE NEW.type
    WHEN 'sale' THEN -NEW.quantity
    WHEN 'purchase' THEN NEW.quantity
    WHEN 'return' THEN NEW.quantity
    WHEN 'adjustment' THEN NEW.quantity
    WHEN 'rebuild' THEN NEW.quantity
    ELSE 0
  END;

  UPDATE public.products SET current_stock = current_stock + delta, updated_at = now()
    WHERE id = NEW.product_id;

  IF NEW.batch_id IS NOT NULL THEN
    UPDATE public.product_batches SET quantity = quantity + delta
      WHERE id = NEW.batch_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ EDIT LOG TRIGGER ============
CREATE OR REPLACE FUNCTION public.log_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.edit_log (table_name, record_id, action, before_data, after_data, edited_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_edit_sales AFTER UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.log_edit();
CREATE TRIGGER trg_edit_sale_items AFTER UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.log_edit();
CREATE TRIGGER trg_edit_products AFTER UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_edit();
CREATE TRIGGER trg_edit_purchases AFTER UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.log_edit();
CREATE TRIGGER trg_edit_expenses AFTER UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_edit();

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_rebuilds ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles: users see own, admin sees all
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

-- user_roles: only admin manages, users can read own
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- categories: all authenticated read, admin write
CREATE POLICY "cat_select" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_admin_all" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- suppliers/customers: admin only
CREATE POLICY "sup_admin" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cust_select" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cust_admin_write" ON public.customers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products: read all auth, write admin
CREATE POLICY "prod_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_admin_all" ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- batches: read all, admin write
CREATE POLICY "batch_select" ON public.product_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batch_admin_all" ON public.product_batches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- cash_drawers: own or admin
CREATE POLICY "drawer_select_own_or_admin" ON public.cash_drawers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drawer_insert_self" ON public.cash_drawers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drawer_update_own_or_admin" ON public.cash_drawers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "drawer_delete_admin" ON public.cash_drawers FOR DELETE TO authenticated
  USING (public.is_admin());

-- sales: cashier creates own, all auth read, admin update/delete
CREATE POLICY "sales_select" ON public.sales FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "sales_update_admin" ON public.sales FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "sales_delete_admin" ON public.sales FOR DELETE TO authenticated
  USING (public.is_admin());

-- sale_items: linked to sale
CREATE POLICY "si_select" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "si_insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid()));
CREATE POLICY "si_admin_modify" ON public.sale_items FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "si_admin_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (public.is_admin());

-- payments
CREATE POLICY "pay_select" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pay_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid()));
CREATE POLICY "pay_admin_mod" ON public.payments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "pay_admin_del" ON public.payments FOR DELETE TO authenticated USING (public.is_admin());

-- purchases: admin only
CREATE POLICY "pur_admin" ON public.purchases FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "pi_admin" ON public.purchase_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- stock_movements: read all auth, system creates via triggers/server fns
CREATE POLICY "sm_select" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm_insert_auth" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sm_admin_mod" ON public.stock_movements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "sm_admin_del" ON public.stock_movements FOR DELETE TO authenticated USING (public.is_admin());

-- cash_transactions: own drawer or admin
CREATE POLICY "ct_select" ON public.cash_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cash_drawers d WHERE d.id = drawer_id AND (d.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "ct_insert" ON public.cash_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cash_drawers d WHERE d.id = drawer_id AND (d.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "ct_admin_mod" ON public.cash_transactions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "ct_admin_del" ON public.cash_transactions FOR DELETE TO authenticated USING (public.is_admin());

-- expenses: admin only (cashiers may add petty? — keep admin)
CREATE POLICY "exp_select" ON public.expenses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "exp_insert" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "exp_admin_mod" ON public.expenses FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "exp_admin_del" ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

-- partner_withdrawals: admin only
CREATE POLICY "pw_admin" ON public.partner_withdrawals FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- edit_log: admin read only (write via trigger as security definer)
CREATE POLICY "el_admin_read" ON public.edit_log FOR SELECT TO authenticated
  USING (public.is_admin());

-- system_rebuilds: admin only
CREATE POLICY "sr_admin" ON public.system_rebuilds FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
