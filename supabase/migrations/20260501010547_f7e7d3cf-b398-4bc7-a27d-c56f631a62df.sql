-- Add invoice number trigger for purchases (uses same sequence)
DROP TRIGGER IF EXISTS trg_set_purchase_invoice_number ON public.purchases;
CREATE TRIGGER trg_set_purchase_invoice_number
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();