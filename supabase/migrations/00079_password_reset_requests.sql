-- Forgotten password WITHOUT an e-mail link and WITHOUT an OTP.
--
--   1. On the login page the visitor types their e-mail, their mobile number and the NEW password, and saves.
--      Only a bcrypt hash of that password is stored (the same kind of hash Supabase Auth keeps), never the password.
--   2. The admins get a notification. On Dashboard → Admin → Password Resets they see the request next to the
--      mobile number registered on the account, call that number and confirm it is really the owner.
--   3. "Approve" puts the new password on the account and signs it out everywhere; "Reject" throws the request away.
--      Only a super admin can approve a reset of an admin account.
--
-- Why a phone call: with no link and no code, a person who only knows someone's e-mail could otherwise take over the
-- account (wallet, payouts, bank and KYC details). The call is the proof that the owner asked.
--
-- Limits: 3 requests per e-mail a day, 5 per IP address an hour, 60 in total an hour; a request lasts 48 hours and a
-- newer one replaces an older one. The answer is the same whether or not the e-mail has an account.
-- The requests live in schema pwrequest, which the API does not expose.
--
-- One transaction; safe to run again.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;   -- bcrypt (Supabase ships it)
CREATE SCHEMA IF NOT EXISTS pwrequest;

CREATE TABLE IF NOT EXISTS pwrequest.requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid,                    -- NULL when no account uses the e-mail (kept only for the limits)
  email             text NOT NULL,
  phone_given       text NOT NULL,           -- the 10-digit mobile number the visitor typed
  phone_registered  text,                    -- the account's number when the request was made
  password_hash     text,                    -- bcrypt of the new password; wiped once the request is decided or expires
  ip                text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'superseded', 'no_account')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  decided_at        timestamptz,
  decided_by        uuid,
  note              text
);
CREATE INDEX IF NOT EXISTS pwrequest_requests_status_idx ON pwrequest.requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS pwrequest_requests_email_idx ON pwrequest.requests (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS pwrequest_requests_ip_idx ON pwrequest.requests (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS pwrequest_requests_user_idx ON pwrequest.requests (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pwrequest.events (
  id          bigserial PRIMARY KEY,
  request_id  uuid,
  user_id     uuid,
  actor       uuid,
  action      text NOT NULL,   -- requested, no_account, rate_limited, superseded, approved, rejected, expired
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON SCHEMA pwrequest FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA pwrequest FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pwrequest FROM PUBLIC, anon, authenticated, service_role;

-- an Indian mobile number as 10 digits (drops spaces, +91, a leading 0); NULL when it is not one
CREATE OR REPLACE FUNCTION public.pwreset_mobile(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d ~ '^[6-9][0-9]{9}$' THEN d END
  FROM (SELECT CASE
                 WHEN length(x) = 12 AND x LIKE '91%' THEN substr(x, 3)
                 WHEN length(x) = 11 AND x LIKE '0%' THEN substr(x, 2)
                 ELSE x
               END AS d
        FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS x) s) t;
$$;

-- the caller's address as the API gateway passed it on (best effort: used only for limits and for the admin's eyes)
CREATE OR REPLACE FUNCTION public.pwreset_client_ip() RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE h json; v text;
BEGIN
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    h := NULL;
  END;
  v := coalesce(h ->> 'x-real-ip', btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), h ->> 'cf-connecting-ip');
  RETURN coalesce(nullif(left(v, 64), ''), 'unknown');
END $$;

-- 1. the visitor asks (no sign-in)
CREATE OR REPLACE FUNCTION public.pwreset_request(p_email text, p_phone text, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pwrequest AS $$
DECLARE
  em text := lower(btrim(coalesce(p_email, '')));
  mob text := public.pwreset_mobile(p_phone);
  v_ip text := public.pwreset_client_ip();
  uid uuid; reg text; rid uuid;
BEGIN
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 254 THEN RETURN jsonb_build_object('status', 'invalid_email'); END IF;
  IF mob IS NULL THEN RETURN jsonb_build_object('status', 'invalid_phone'); END IF;
  IF p_password IS NULL OR octet_length(p_password) < 8 OR octet_length(p_password) > 72
     OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RETURN jsonb_build_object('status', 'weak_password');
  END IF;

  -- limits (checked before any account is looked up, so they say nothing about whether the e-mail is registered)
  IF (SELECT count(*) FROM pwrequest.requests WHERE lower(email) = em AND created_at > now() - interval '24 hours') >= 3
     OR (SELECT count(*) FROM pwrequest.requests WHERE ip = v_ip AND v_ip <> 'unknown' AND created_at > now() - interval '1 hour') >= 5
     OR (SELECT count(*) FROM pwrequest.requests WHERE created_at > now() - interval '1 hour') >= 60 THEN
    INSERT INTO pwrequest.events (action, ip) VALUES ('rate_limited', v_ip);
    RETURN jsonb_build_object('status', 'too_many');
  END IF;

  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = em LIMIT 1;
  IF uid IS NULL THEN
    INSERT INTO pwrequest.requests (email, phone_given, ip, status, decided_at) VALUES (em, mob, v_ip, 'no_account', now()) RETURNING id INTO rid;
    INSERT INTO pwrequest.events (request_id, action, ip) VALUES (rid, 'no_account', v_ip);
    RETURN jsonb_build_object('status', 'received');
  END IF;

  SELECT p.phone INTO reg FROM public.profiles p WHERE p.id = uid;

  -- a newer request replaces one still waiting
  WITH old AS (
    UPDATE pwrequest.requests SET status = 'superseded', password_hash = NULL, decided_at = now()
    WHERE user_id = uid AND status = 'pending' RETURNING id
  )
  INSERT INTO pwrequest.events (request_id, user_id, action, ip) SELECT id, uid, 'superseded', v_ip FROM old;

  INSERT INTO pwrequest.requests (user_id, email, phone_given, phone_registered, password_hash, ip)
  VALUES (uid, em, mob, reg, crypt(p_password, gen_salt('bf', 10)), v_ip)
  RETURNING id INTO rid;
  INSERT INTO pwrequest.events (request_id, user_id, action, ip) VALUES (rid, uid, 'requested', v_ip);

  -- tell the admins (a failure here must not lose the request)
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT p.id, 'Password reset request',
           'A password reset was requested for ' || em || '. Call the registered mobile number to confirm before approving.',
           'info', '/dashboard/admin/password-resets'
    FROM public.profiles p WHERE p.role = 'admin';
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN jsonb_build_object('status', 'received');
END $$;

-- requests nobody decided within 48 hours lapse, and their password hash is wiped
CREATE OR REPLACE FUNCTION public.pwreset_expire() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwrequest AS $$
BEGIN
  WITH gone AS (
    UPDATE pwrequest.requests SET status = 'expired', password_hash = NULL, decided_at = now()
    WHERE status = 'pending' AND expires_at <= now() RETURNING id, user_id
  )
  INSERT INTO pwrequest.events (request_id, user_id, action) SELECT id, user_id, 'expired' FROM gone;
END $$;

-- 2. the admin's list: 'pending' (default) or 'done' (the last 100 decided)
CREATE OR REPLACE FUNCTION public.admin_pwreset_requests(p_view text DEFAULT 'pending') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwrequest AS $$
DECLARE v_rows jsonb; v_pending int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  PERFORM public.pwreset_expire();

  SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'created_at') DESC), '[]'::jsonb) INTO v_rows FROM (
    SELECT jsonb_build_object(
      'id', r.id, 'status', r.status, 'email', r.email, 'created_at', r.created_at, 'expires_at', r.expires_at,
      'decided_at', r.decided_at, 'note', r.note, 'ip', r.ip,
      'phone_given', r.phone_given,
      'phone_registered', coalesce(p.phone, r.phone_registered),
      'phone_match', public.pwreset_mobile(coalesce(p.phone, r.phone_registered)) = r.phone_given,
      'full_name', p.full_name, 'role', p.role,
      'company_name', (SELECT c.company_name FROM public.companies c WHERE c.owner_id = r.user_id ORDER BY c.created_at LIMIT 1),
      'account_created_at', p.created_at,
      'requests_same_ip_24h', (SELECT count(*) FROM pwrequest.requests o WHERE o.ip = r.ip AND r.ip <> 'unknown' AND o.created_at > r.created_at - interval '24 hours' AND o.created_at <= r.created_at),
      'decided_by_name', (SELECT d.full_name FROM public.profiles d WHERE d.id = r.decided_by)
    ) AS x
    FROM pwrequest.requests r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.status <> 'no_account'
      AND ((coalesce(p_view, 'pending') = 'pending' AND r.status = 'pending')
        OR (p_view = 'done' AND r.status <> 'pending'))
    ORDER BY r.created_at DESC
    LIMIT 100
  ) q;

  SELECT count(*) INTO v_pending FROM pwrequest.requests WHERE status = 'pending';
  RETURN jsonb_build_object('rows', v_rows, 'pending', v_pending);
END $$;

-- 3. the admin's decision, after calling the registered number
CREATE OR REPLACE FUNCTION public.admin_pwreset_decide(p_id uuid, p_approve boolean, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwrequest AS $$
DECLARE r pwrequest.requests%ROWTYPE; target_role text; changed int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  PERFORM public.pwreset_expire();

  SELECT * INTO r FROM pwrequest.requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status = 'no_account' THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('status', 'already_' || r.status); END IF;

  IF NOT coalesce(p_approve, false) THEN
    UPDATE pwrequest.requests SET status = 'rejected', password_hash = NULL, decided_at = now(), decided_by = auth.uid(),
      note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
    WHERE id = r.id;
    INSERT INTO pwrequest.events (request_id, user_id, actor, action) VALUES (r.id, r.user_id, auth.uid(), 'rejected');
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  SELECT p.role INTO target_role FROM public.profiles p WHERE p.id = r.user_id;
  IF target_role = 'admin' AND NOT coalesce(public.is_super_admin(), false) THEN RAISE EXCEPTION 'super_admin_only'; END IF;

  UPDATE auth.users SET encrypted_password = r.password_hash, updated_at = now() WHERE id = r.user_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN
    UPDATE pwrequest.requests SET status = 'rejected', password_hash = NULL, decided_at = now(), decided_by = auth.uid(),
      note = 'The account no longer exists.' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'account_gone');
  END IF;

  -- signed out everywhere: whoever had the old password is out
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1::text' USING r.user_id;
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.sessions WHERE user_id = $1' USING r.user_id;
  END IF;

  UPDATE pwrequest.requests SET status = 'approved', password_hash = NULL, decided_at = now(), decided_by = auth.uid(),
    note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
  WHERE id = r.id;
  INSERT INTO pwrequest.events (request_id, user_id, actor, action) VALUES (r.id, r.user_id, auth.uid(), 'approved');

  -- the owner sees it next time they sign in (and can raise it if it was not them)
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (r.user_id, 'Your password was changed',
            'Your password was changed after our team confirmed the request by phone. If this was not you, contact BulkSkart support at once.',
            'info');
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN jsonb_build_object('status', 'approved');
END $$;

REVOKE ALL ON FUNCTION public.pwreset_mobile(text), public.pwreset_client_ip(), public.pwreset_request(text, text, text),
  public.pwreset_expire(), public.admin_pwreset_requests(text), public.admin_pwreset_decide(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pwreset_request(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pwreset_requests(text), public.admin_pwreset_decide(uuid, boolean, text) TO authenticated;

COMMIT;
