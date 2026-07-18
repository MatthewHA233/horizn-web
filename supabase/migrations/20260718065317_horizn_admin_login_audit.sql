CREATE TABLE IF NOT EXISTS public.horizn_admin_login_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL CHECK (role IN ('admin', 'super')),
  ip_address inet,
  country_code text CHECK (country_code IS NULL OR char_length(country_code) = 2),
  region text,
  city text,
  user_agent text,
  accept_language text,
  browser text,
  operating_system text,
  device_type text CHECK (device_type IS NULL OR device_type IN ('desktop', 'mobile', 'tablet', 'bot')),
  request_id text
);

COMMENT ON TABLE public.horizn_admin_login_audit IS
  '管理员成功登录审计；仅 Next.js service_role 可访问，默认保留 180 天';

ALTER TABLE public.horizn_admin_login_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.horizn_admin_login_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.horizn_admin_login_audit TO service_role;

REVOKE ALL ON SEQUENCE public.horizn_admin_login_audit_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.horizn_admin_login_audit_id_seq TO service_role;

CREATE INDEX IF NOT EXISTS horizn_admin_login_audit_logged_in_at_idx
  ON public.horizn_admin_login_audit (logged_in_at DESC);

CREATE INDEX IF NOT EXISTS horizn_admin_login_audit_ip_logged_in_at_idx
  ON public.horizn_admin_login_audit (ip_address, logged_in_at DESC);
