CREATE TABLE IF NOT EXISTS public.horizn_admin_login_identity_claims (
  location_key text PRIMARY KEY
    CHECK (char_length(location_key) BETWEEN 3 AND 255),
  identity_name text NOT NULL
    CHECK (char_length(btrim(identity_name)) BETWEEN 1 AND 40),
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.horizn_admin_login_identity_claims IS
  '超级管理员为登录地区画像设置的身份标签；仅 Next.js service_role 可访问';

ALTER TABLE public.horizn_admin_login_identity_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.horizn_admin_login_identity_claims
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.horizn_admin_login_identity_claims
  TO service_role;
