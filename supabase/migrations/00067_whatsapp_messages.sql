-- WhatsApp messages through AiSensy.
--
-- Real events queue a message in public.whatsapp_messages:
--   new_quotation       a manufacturer quotes on a buyer's requirement   -> the buyer
--   quotation_accepted  the buyer accepts a quotation                    -> the manufacturer
--   new_buy_lead        a manufacturer is matched to an open requirement -> the manufacturer
-- The whatsapp-dispatch edge function sends them through AiSensy API
-- campaigns. An event whose campaign is not set on the server is skipped.
-- Queueing never blocks the quotation or match it comes from.

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event       text NOT NULL CHECK (event IN ('new_quotation', 'quotation_accepted', 'new_buy_lead')),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ref_id      uuid NOT NULL,
  dedupe_key  text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts    integer NOT NULL DEFAULT 0,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  UNIQUE (event, user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_pending_idx
  ON public.whatsapp_messages (created_at) WHERE status = 'pending';

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
DROP POLICY IF EXISTS whatsapp_messages_admin_read ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_admin_read ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (is_admin());

-- Only the triggers below queue messages; nobody can call this directly.
CREATE OR REPLACE FUNCTION public.queue_whatsapp(p_event text, p_user uuid, p_ref uuid, p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL OR p_ref IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.whatsapp_messages (event, user_id, ref_id, dedupe_key)
  VALUES (p_event, p_user, p_ref, p_key)
  ON CONFLICT (event, user_id, dedupe_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.queue_whatsapp(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_on_quotation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer uuid;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      -- The buyer comes from the requirement, not from the quotation row.
      SELECT r.buyer_id INTO v_buyer FROM public.requirements r WHERE r.id = NEW.requirement_id;
      IF v_buyer IS NOT NULL AND v_buyer IS DISTINCT FROM NEW.supplier_id THEN
        -- One message per manufacturer per requirement, however many times they re-quote.
        PERFORM public.queue_whatsapp('new_quotation', v_buyer, NEW.id,
          NEW.requirement_id::text || ':' || coalesce(NEW.supplier_company_id::text, NEW.supplier_id::text));
      END IF;
    ELSIF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
      PERFORM public.queue_whatsapp('quotation_accepted', NEW.supplier_id, NEW.id, NEW.id::text);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'whatsapp message not queued: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS whatsapp_quotation_insert ON public.quotations;
CREATE TRIGGER whatsapp_quotation_insert
  AFTER INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_on_quotation();

DROP TRIGGER IF EXISTS whatsapp_quotation_accepted ON public.quotations;
CREATE TRIGGER whatsapp_quotation_accepted
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_on_quotation();

CREATE OR REPLACE FUNCTION public.whatsapp_on_rfq_match()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_buyer uuid;
  v_status text;
BEGIN
  BEGIN
    SELECT c.owner_id INTO v_owner FROM public.companies c WHERE c.id = NEW.company_id;
    SELECT r.buyer_id, r.status::text INTO v_buyer, v_status FROM public.requirements r WHERE r.id = NEW.rfq_id;
    IF v_status = 'active' AND v_owner IS DISTINCT FROM v_buyer THEN
      PERFORM public.queue_whatsapp('new_buy_lead', v_owner, NEW.rfq_id, NEW.rfq_id::text);
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'whatsapp message not queued: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS whatsapp_rfq_match ON public.rfq_matches;
CREATE TRIGGER whatsapp_rfq_match
  AFTER INSERT ON public.rfq_matches
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_on_rfq_match();

REVOKE ALL ON FUNCTION public.whatsapp_on_quotation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_on_rfq_match() FROM PUBLIC, anon, authenticated;

-- Every minute, and only while something is waiting, ask the edge function to send.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'whatsapp-dispatch';
    PERFORM cron.schedule(
      'whatsapp-dispatch',
      '* * * * *',
      $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/whatsapp-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
        ),
        body := '{}'::jsonb
      )
      WHERE EXISTS (SELECT 1 FROM public.whatsapp_messages WHERE status = 'pending');
      $job$
    );
  END IF;
END $do$;
