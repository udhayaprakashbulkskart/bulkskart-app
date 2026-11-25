-- Password reset with a 6-digit code on WhatsApp (no e-mail link).
--
-- The password-reset edge function (service role) uses these functions:
--   1. pwreset_service_lookup(email, ip)          → the account and its WhatsApp number (from profiles.phone)
--   2. pwreset_service_create(user, code, ip, …)  → stores only a SHA-256 of the code; valid 10 minutes
--   3. pwreset_service_verify(email, code, ip)    → at most 5 tries per code; a code works once
--   4. pwreset_service_finish(user, ip)           → after the new password is set: signs the account out everywhere
-- Limits: one code a minute and three an hour per account; per IP 20 look-ups and 30 wrong codes an hour.
-- The codes live in schema pwreset, which the API does not expose; nobody but the service role can call these functions.
--
-- One transaction; safe to run again.

BEGIN;

CREATE SCHEMA IF NOT EXISTS pwreset;

CREATE TABLE IF NOT EXISTS pwreset.codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  code_hash    text NOT NULL,
  phone_last2  text,
  ip           text,
  attempts     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  voided_at    timestamptz,
  send_failed  boolean NOT NULL DEFAULT false   -- the WhatsApp message never went out: not counted against the limits
);
ALTER TABLE pwreset.codes ADD COLUMN IF NOT EXISTS send_failed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS pwreset_codes_user_idx ON pwreset.codes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pwreset.events (
  id          bigserial PRIMARY KEY,
  user_id     uuid,
  action      text NOT NULL,     -- lookup, code_sent, code_voided, wrong_code, locked, verified, password_changed, rate_limited
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pwreset_events_ip_idx ON pwreset.events (ip, action, created_at DESC);

REVOKE ALL ON SCHEMA pwreset FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA pwreset FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pwreset FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pwreset_hash(p_user uuid, p_code text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(p_user::text || ':' || coalesce(p_code, ''), 'UTF8')), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.pwreset_service_lookup(p_email text, p_ip text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwreset AS $$
DECLARE uid uuid; ph text; nm text;
BEGIN
  IF (SELECT count(*) FROM pwreset.events WHERE ip = p_ip AND action = 'lookup' AND created_at > now() - interval '1 hour') >= 20 THEN
    INSERT INTO pwreset.events (action, ip) VALUES ('rate_limited', p_ip);
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(btrim(coalesce(p_email, ''))) LIMIT 1;
  INSERT INTO pwreset.events (user_id, action, ip) VALUES (uid, 'lookup', p_ip);
  IF uid IS NULL THEN RETURN jsonb_build_object('status', 'no_account'); END IF;
  SELECT p.phone, p.full_name INTO ph, nm FROM public.profiles p WHERE p.id = uid;
  IF coalesce(btrim(ph), '') = '' THEN RETURN jsonb_build_object('status', 'no_phone'); END IF;
  RETURN jsonb_build_object('status', 'ok', 'user_id', uid, 'phone', ph, 'full_name', nm);
END $$;

CREATE OR REPLACE FUNCTION public.pwreset_service_create(p_user uuid, p_code text, p_ip text, p_phone_last2 text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwreset AS $$
DECLARE cid uuid; last_at timestamptz;
BEGIN
  IF p_code !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'invalid_code'; END IF;
  -- every code that was sent counts, including ones replaced by a newer code; only failed sends do not
  SELECT max(created_at) INTO last_at FROM pwreset.codes WHERE user_id = p_user AND NOT send_failed;
  IF last_at > now() - interval '60 seconds' THEN RETURN jsonb_build_object('status', 'too_soon'); END IF;
  IF (SELECT count(*) FROM pwreset.codes WHERE user_id = p_user AND NOT send_failed AND created_at > now() - interval '1 hour') >= 3 THEN
    INSERT INTO pwreset.events (user_id, action, ip) VALUES (p_user, 'rate_limited', p_ip);
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;
  -- an older code stops working when a new one is sent
  UPDATE pwreset.codes SET voided_at = now() WHERE user_id = p_user AND used_at IS NULL AND voided_at IS NULL;
  DELETE FROM pwreset.codes WHERE created_at < now() - interval '7 days';
  DELETE FROM pwreset.events WHERE created_at < now() - interval '90 days';
  INSERT INTO pwreset.codes (user_id, code_hash, phone_last2, ip, expires_at)
  VALUES (p_user, public.pwreset_hash(p_user, p_code), p_phone_last2, p_ip, now() + interval '10 minutes')
  RETURNING id INTO cid;
  INSERT INTO pwreset.events (user_id, action, ip) VALUES (p_user, 'code_sent', p_ip);
  RETURN jsonb_build_object('status', 'ok', 'id', cid);
END $$;

-- The WhatsApp message could not be sent: the code must not stay usable (and does not count against the hourly limit).
CREATE OR REPLACE FUNCTION public.pwreset_service_void(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pwreset AS $$
  UPDATE pwreset.codes SET voided_at = now(), send_failed = true WHERE id = p_id AND used_at IS NULL;
  INSERT INTO pwreset.events (user_id, action, ip) SELECT user_id, 'code_voided', ip FROM pwreset.codes WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.pwreset_service_verify(p_email text, p_code text, p_ip text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwreset AS $$
DECLARE uid uuid; c pwreset.codes;
BEGIN
  IF (SELECT count(*) FROM pwreset.events WHERE ip = p_ip AND action = 'wrong_code' AND created_at > now() - interval '1 hour') >= 30 THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(btrim(coalesce(p_email, ''))) LIMIT 1;
  IF uid IS NULL THEN RETURN jsonb_build_object('status', 'expired'); END IF;
  SELECT * INTO c FROM pwreset.codes WHERE user_id = uid AND used_at IS NULL AND voided_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR c.expires_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;
  IF c.attempts >= 5 THEN RETURN jsonb_build_object('status', 'locked'); END IF;
  IF c.code_hash <> public.pwreset_hash(uid, btrim(coalesce(p_code, ''))) THEN
    UPDATE pwreset.codes SET attempts = attempts + 1,
           voided_at = CASE WHEN attempts + 1 >= 5 THEN now() ELSE NULL END
     WHERE id = c.id;
    INSERT INTO pwreset.events (user_id, action, ip) VALUES (uid, CASE WHEN c.attempts + 1 >= 5 THEN 'locked' ELSE 'wrong_code' END, p_ip);
    IF c.attempts + 1 >= 5 THEN RETURN jsonb_build_object('status', 'locked'); END IF;
    RETURN jsonb_build_object('status', 'wrong_code', 'attempts_left', 5 - (c.attempts + 1));
  END IF;
  UPDATE pwreset.codes SET used_at = now() WHERE id = c.id;
  INSERT INTO pwreset.events (user_id, action, ip) VALUES (uid, 'verified', p_ip);
  RETURN jsonb_build_object('status', 'ok', 'user_id', uid);
END $$;

-- After the new password is saved: every existing sign-in of the account ends (so anyone else using it is signed out).
CREATE OR REPLACE FUNCTION public.pwreset_service_finish(p_user uuid, p_ip text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pwreset AS $$
BEGIN
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1::text' USING p_user;
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.sessions WHERE user_id = $1' USING p_user;
  END IF;
  INSERT INTO pwreset.events (user_id, action, ip) VALUES (p_user, 'password_changed', p_ip);
END $$;

REVOKE ALL ON FUNCTION public.pwreset_hash(uuid, text), public.pwreset_service_lookup(text, text), public.pwreset_service_create(uuid, text, text, text),
  public.pwreset_service_void(uuid), public.pwreset_service_verify(text, text, text), public.pwreset_service_finish(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pwreset_service_lookup(text, text), public.pwreset_service_create(uuid, text, text, text),
  public.pwreset_service_void(uuid), public.pwreset_service_verify(text, text, text), public.pwreset_service_finish(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
