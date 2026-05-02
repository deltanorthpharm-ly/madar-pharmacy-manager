-- Attach existing log_edit() trigger function to all sensitive tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'sales','sale_items','payments',
    'purchases','purchase_items',
    'expenses','products','product_batches',
    'cash_drawers','cash_transactions',
    'customers','suppliers','partner_withdrawals',
    'stock_movements'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_edit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_log_edit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_edit()',
      t, t
    );
  END LOOP;
END $$;