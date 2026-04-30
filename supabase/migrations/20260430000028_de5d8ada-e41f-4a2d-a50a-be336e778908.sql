
-- Fix search_path on remaining functions
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

-- Revoke public/anon execute on SECURITY DEFINER functions, allow only authenticated
REVOKE ALL ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_edit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
