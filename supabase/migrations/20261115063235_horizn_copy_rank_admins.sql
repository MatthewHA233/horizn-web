-- 网站「复制排名名单」的剔除管理名单（所有管理员共享）
-- excluded=true 表示勾选：复制名单时剔除、不参与排名。仅 service_role（网站服务端）读写。
-- 初始名单（舷号 00x + 活跃度达标核查的排除成员）直接写库，不入公开仓库。
CREATE TABLE IF NOT EXISTS public.horizn_copy_rank_admins (
    player_id  text PRIMARY KEY
               REFERENCES public.horizn_members(player_id) ON UPDATE CASCADE ON DELETE CASCADE,
    excluded   boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.horizn_copy_rank_admins IS '复制排名名单「剔除管理」名单；excluded=true 为勾选（复制时剔除）';
COMMENT ON COLUMN public.horizn_copy_rank_admins.excluded IS '勾选：复制排名名单时剔除，不参与排名';

ALTER TABLE public.horizn_copy_rank_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.horizn_copy_rank_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horizn_copy_rank_admins TO service_role;
