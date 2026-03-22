/**
 * HORIZN 服务端数据获取
 * 服务端只负责 Supabase 成员映射（海外→海外，快）
 * OSS/DuckDB 数据由客户端直接获取（国内→国内）
 */

import { createClient } from '@supabase/supabase-js'

// 服务端 Supabase 客户端
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * 获取最新月份（从 OSS available-months.json）
 */
export async function getLatestMonth() {
  const ossBase = process.env.NEXT_PUBLIC_HORIZN_OSS_BASE || ''
  if (!ossBase) return null

  try {
    const res = await fetch(`${ossBase}/available-months.json`, {
      next: { revalidate: 300 }
    })
    if (!res.ok) return null
    const data = await res.json()
    const months = Object.keys(data.months || {})
    months.sort((a, b) => b.localeCompare(a))
    return months[0] || null
  } catch {
    return null
  }
}

/**
 * 从 Supabase 获取成员映射（海外→海外，延迟低）
 * 服务端内存缓存 30 分钟
 */
let _membersCache = null
let _membersCacheAt = 0
const MEMBERS_CACHE_TTL = 30 * 60 * 1000

export async function getServerIdMapping() {
  const now = Date.now()
  if (_membersCache && now - _membersCacheAt < MEMBERS_CACHE_TTL) {
    console.log(`[服务端] 成员映射命中缓存 (${Math.round((now - _membersCacheAt) / 1000)}s前)`)
    return _membersCache
  }

  const supabase = getSupabase()
  if (!supabase) return _membersCache || {}

  try {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('horizn_get_members')
    if (error) throw error

    const mapping = {}
    for (const m of (data || [])) {
      const primaryName = m.primary_name || m.player_id
      const group0 = Array.isArray(m.name_groups)
        ? m.name_groups.find(g => g.group_index === 0)
        : null
      const variants = Array.isArray(group0?.names)
        ? group0.names.map(n => n?.name).filter(Boolean)
        : []
      mapping[m.player_id] = {
        name: primaryName,
        nameVariants: variants.length ? variants.join('|') : primaryName,
        joinDate: m.join_date ? normalizeDate(m.join_date) : null,
        leaveDate: m.leave_date ? normalizeDate(m.leave_date) : null
      }
    }

    _membersCache = mapping
    _membersCacheAt = now
    console.log(`[服务端] 成员映射已刷新: ${Object.keys(mapping).length}人, ${Date.now() - t0}ms`)
    return mapping
  } catch (e) {
    console.error('[服务端] 成员映射获取失败:', e.message)
    return _membersCache || {}
  }
}

function normalizeDate(dateValue) {
  if (!dateValue) return null
  const str = String(dateValue).replace(/-/g, '')
  return str.length >= 8 ? str.slice(0, 8) : str
}
