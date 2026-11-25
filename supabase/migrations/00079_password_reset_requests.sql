-- Forgotten password WITHOUT an e-mail link, WITHOUT an OTP and WITHOUT waiting for an admin.
--
--   On the login page the visitor types their e-mail, the mobile number registered on their account and the NEW password.
--   • The number matches the account → the new password works at once, the account is signed out on every device and the
--     owner gets a "your password was changed" notice.
--   • It does not match (or there is no such account / no number on it) → nothing changes; the same answer either way.
--   • Admin accounts are the exception: their request waits on Dashboard → Admin → Password Resets until a SUPER ADMIN
--     approves it after a phone call (an admin account controls the whole marketplace).
--
-- Limits: 5 tries per e-mail a day (right or wrong), 10 per IP address an hour, 100 in total an hour. Only bcrypt hashes
-- are stored. Every try is logged; the admin page shows changes and wrong-number tries.
-- The requests live in schema pwrequest, which the API does not expose.
--
-- One transaction; safe to run again (also over the first version of this file).

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
  status            text NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  decided_at        timestamptz,
  decided_by        uuid,
  note              text
);
-- pending/approved/rejected/expired/superseded: admin accounts; changed: the owner's number matched; no_match / no_account: nothing changed
ALTER TABLE pwrequest.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE pwrequest.requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'superseded', 'changed', 'no_match', 'no_account'));
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

-- 1. the visitor sets a new password (no sign-in)
CREATE OR REPLACE FUNCTION public.pwreset_request(p_email text, p_phone text, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pwrequest AS $$
DECLARE
  em text := lower(btrim(coalesce(p_email, '')));
  mob text := public.pwreset_mobile(p_phone);
  v_ip text := public.pwreset_client_ip();
  uid uuid; reg text; v_role text; rid uuid;
BEGIN
  IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 254 THEN RETURN jsonb_build_object('status', 'invalid_email'); END IF;
  IF mob IS NULL THEN RETURN jsonb_build_object('status', 'invalid_phone'); END IF;
  IF p_password IS NULL OR octet_length(p_password) < 8 OR octet_length(p_password) > 72
     OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RETURN jsonb_build_object('status', 'weak_password');
  END IF;

  -- limits (checked before any account is looked up, so they say nothing about whether the e-mail is registered)
  IF (SELECT count(*) FROM pwrequest.requests WHERE lower(email) = em AND created_at > now() - interval '24 hours') >= 5
     OR (SELECT count(*) FROM pwrequest.requests WHERE ip = v_ip AND v_ip <> 'unknown' AND created_at > now() - interval '1 hour') >= 10
     OR (SELECT count(*) FROM pwrequest.requests WHERE created_at > now() - interval '1 hour') >= 100 THEN
    INSERT INTO pwrequest.events (action, ip) VALUES ('rate_limited', v_ip);
    RETURN jsonb_build_object('status', 'too_many');
  END IF;

  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = em LIMIT 1;
  IF uid IS NOT NULL THEN
    SELECT p.phone, p.role INTO reg, v_role FROM public.profiles p WHERE p.id = uid;
  END IF;

  -- the number must be the one on the account; otherwise nothing changes, with the same answer as for an unknown e-mail
  IF uid IS NULL OR public.pwreset_mobile(reg) IS DISTINCT FROM mob THEN
    INSERT INTO pwrequest.requests (user_id, email, phone_given, phone_registered, ip, status, decided_at)
    VALUES (uid, em, mob, reg, v_ip, CASE WHEN uid IS NULL THEN 'no_account' ELSE 'no_match' END, now())
    RETURNING id INTO rid;
    INSERT INTO pwrequest.events (request_id, user_id, action, ip) VALUES (rid, uid, CASE WHEN uid IS NULL THEN 'no_account' ELSE 'no_match' END, v_ip);
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  -- a newer request replaces one still waiting
  WITH old AS (
    UPDATE pwrequest.requests SET status = 'superseded', password_hash = NULL, decided_at = now()
    WHERE user_id = uid AND status = 'pending' RETURNING id
  )
  INSERT INTO pwrequest.events (request_id, user_id, action, ip) SELECT id, uid, 'superseded', v_ip FROM old;

  -- an admin account waits for a super admin's phone call
  IF v_role = 'admin' THEN
    INSERT INTO pwrequest.requests (user_id, email, phone_given, phone_registered, password_hash, ip)
    VALUES (uid, em, mob, reg, crypt(p_password, gen_salt('bf', 10)), v_ip)
    RETURNING id INTO rid;
    INSERT INTO pwrequest.events (request_id, user_id, action, ip) VALUES (rid, uid, 'requested', v_ip);
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      SELECT p.id, 'Admin password reset request',
             'A password reset was requested for the admin account ' || em || '. Call its registered mobile number before approving.',
             'info', '/dashboard/admin/password-resets'
      FROM public.profiles p WHERE p.role = 'admin' AND p.is_super_admin;
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN jsonb_build_object('status', 'queued');
  END IF;

  -- everyone else: the new password works now
  UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now() WHERE id = uid;
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1::text' USING uid;
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.sessions WHERE user_id = $1' USING uid;
  END IF;
  INSERT INTO pwrequest.requests (user_id, email, phone_given, phone_registered, ip, status, decided_at, note)
  VALUES (uid, em, mob, reg, v_ip, 'changed', now(), 'Changed by the owner: the mobile number matched the account.')
  RETURNING id INTO rid;
  INSERT INTO pwrequest.events (request_id, user_id, action, ip) VALUES (rid, uid, 'changed', v_ip);
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (uid, 'Your password was changed',
            'Your password was changed from the login page with your e-mail and mobile number. If this was not you, contact BulkSkart support at once.',
            'info');
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN jsonb_build_object('status', 'changed');
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
    WHERE r.status <> 'no_account' AND r.user_id IS NOT NULL
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
  IF NOT FOUND OR r.user_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
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
