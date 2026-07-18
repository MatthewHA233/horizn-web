-- HORIZN 管理权限收口
-- 在 Supabase SQL Editor 执行。应用后，浏览器 anon key 无法再直接写管理数据，
-- 管理读写统一由 Next.js 服务端使用 service_role key 完成。

BEGIN;

-- 所有 Data API 暴露表都启用 RLS。service_role 绕过 RLS；浏览器只保留
-- 首页所需的成员与入退队事件读取能力。
ALTER TABLE public.horizn_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizn_membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizn_monthly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizn_hull_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizn_blacklist_else ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizn_qq_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON public.horizn_blacklist_else;
DROP POLICY IF EXISTS "Allow insert for all" ON public.horizn_monthly_rules;
DROP POLICY IF EXISTS "Allow read for all" ON public.horizn_monthly_rules;
DROP POLICY IF EXISTS "Allow update for all" ON public.horizn_monthly_rules;

DROP POLICY IF EXISTS "horizn_members_public_read" ON public.horizn_members;
CREATE POLICY "horizn_members_public_read"
  ON public.horizn_members
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "horizn_membership_events_public_read" ON public.horizn_membership_events;
CREATE POLICY "horizn_membership_events_public_read"
  ON public.horizn_membership_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

DO $$
DECLARE
  relation_name text;
  relation_oid regclass;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'horizn_membership_events',
    'horizn_monthly_rules',
    'horizn_members',
    'horizn_hull_assignments',
    'horizn_blacklist_else',
    'horizn_qq_accounts'
  ]
  LOOP
    relation_oid := to_regclass('public.' || relation_name);
    IF relation_oid IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE %s FROM anon, authenticated', relation_oid);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO service_role', relation_oid);
    END IF;
  END LOOP;
END $$;

-- 管理界面已迁移到 Next.js 服务端，以下数据不再允许浏览器直接读取。
REVOKE SELECT ON TABLE public.horizn_monthly_rules FROM anon, authenticated;
REVOKE SELECT ON TABLE public.horizn_hull_assignments FROM anon, authenticated;
REVOKE SELECT ON TABLE public.horizn_blacklist_else FROM anon, authenticated;
REVOKE SELECT ON TABLE public.horizn_qq_accounts FROM anon, authenticated;

DO $$
DECLARE
  function_row record;
BEGIN
  FOR function_row IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'horizn_get_members_admin',
        'horizn_get_hull_occupancy',
        'horizn_get_qq_members',
        'horizn_init_cache',
        'horizn_smart_refresh',
        'horizn_add_name_variant',
        'horizn_bind_qq_member',
        'horizn_clear_primary_name',
        'horizn_create_member',
        'horizn_delete_name_group',
        'horizn_delete_name_variant',
        'horizn_promote_name_group',
        'horizn_set_second_team',
        'horizn_unbind_qq_member',
        'horizn_update_member_name',
        'horizn_assign_hull',
        'horizn_revoke_hull',
        'horizn_hard_delete_hull',
        'horizn_set_hull_number',
        'horizn_transfer_hull_number',
        'horizn_update_hull_assignment',
        'horizn_set_member_blacklist',
        'horizn_transfer_hull'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_row.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_row.signature);
  END LOOP;
END $$;

COMMIT;
