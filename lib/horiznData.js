/**
 * HORIZN 服务端数据获取
 * 在 Next.js Server Component 中使用，利用 ISR 缓存
 */

import { createClient } from '@supabase/supabase-js'

const OSS_HORIZN_BASE = process.env.NEXT_PUBLIC_HORIZN_OSS_BASE || ''
const DUCKDB_URL = process.env.NEXT_PUBLIC_DUCKDB_URL || ''

// 服务端 Supabase 客户端（用于获取成员映射）
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * 获取可用月份列表（从 OSS）
 */
export async function getAvailableMonths() {
  const res = await fetch(`${OSS_HORIZN_BASE}/available-months.json`, {
    next: { revalidate: 300 }
  })
  if (!res.ok) throw new Error('无法获取可用月份列表')

  const data = await res.json()
  const months = data.months || {}

  return {
    raw: months,
    sorted: Object.keys(months)
      .sort((a, b) => b.localeCompare(a))
      .map(ym => ({ yearMonth: ym, dayCount: months[ym]?.length || 0 }))
  }
}

/**
 * 获取最新月份
 */
export async function getLatestMonth() {
  const { sorted } = await getAvailableMonths()
  return sorted[0]?.yearMonth || null
}

/**
 * 从 Supabase 获取成员映射（horizn_get_members RPC）
 * 服务端内存缓存 30 分钟，成员数据变化频率低
 */
let _membersCache = null
let _membersCacheAt = 0
const MEMBERS_CACHE_TTL = 30 * 60 * 1000 // 30 分钟

async function getMembersIdMapping() {
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

/**
 * 从 DuckDB 获取增量数据（OSS 最新时间戳之后的部分）
 */
async function getDuckDBIncrement(lastOSSTimestamp, yearMonth) {
  if (!DUCKDB_URL || !lastOSSTimestamp) return []

  try {
    const sql = `
      SELECT player_id, session_time, weekly_activity, season_activity
      FROM horizn_activity_records
      WHERE session_time > ?::timestamp
        AND strftime(session_time, '%Y%m') = ?
      ORDER BY session_time, player_id
    `
    const res = await fetch(`${DUCKDB_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, args: [lastOSSTimestamp, yearMonth] }),
      signal: AbortSignal.timeout(8000)
    })

    if (!res.ok) return []
    const data = await res.json()
    const rows = data.rows || []

    if (rows.length === 0) return []

    // 按 session_time 分组，转换为 sessions 格式
    const grouped = new Map()
    for (const [player_id, session_time, weekly, season] of rows) {
      if (!grouped.has(session_time)) {
        grouped.set(session_time, [])
      }
      grouped.get(session_time).push({
        player_id,
        weekly_activity: weekly || 0,
        season_activity: season || 0
      })
    }

    const sessions = []
    for (const [session_time, entries] of grouped) {
      sessions.push({ session_time, entries })
    }

    console.log(`[服务端] DuckDB增量: ${sessions.length}帧, ${rows.length}条记录 (从 ${lastOSSTimestamp} 起)`)
    return sessions
  } catch (e) {
    console.warn('[服务端] DuckDB增量获取失败:', e.message)
    return []
  }
}

/**
 * 月度数据内存缓存
 * 缓存命中时直接返回，无任何网络请求，响应 <1ms
 */
const _monthlyDataCache = new Map() // key: yearMonth, value: { data, cachedAt }
const MONTHLY_CACHE_TTL = 5 * 60 * 1000 // 5 分钟

/**
 * 获取某月的全部数据：OSS批量 + Supabase成员 + DuckDB增量
 * 带服务端内存缓存，5分钟内重复请求直接返回缓存
 */
export async function getMonthlyOSSData(yearMonth) {
  // 检查内存缓存
  const cached = _monthlyDataCache.get(yearMonth)
  if (cached && Date.now() - cached.cachedAt < MONTHLY_CACHE_TTL) {
    const age = Math.round((Date.now() - cached.cachedAt) / 1000)
    console.log(`[服务端] 月度数据命中内存缓存: ${yearMonth} (${age}s前缓存)`)
    return { ...cached.data, fromCache: true, cacheAge: age }
  }

  const t0 = Date.now()

  // 1. 获取可用天数
  const { raw: months } = await getAvailableMonths()
  const availableDays = months[yearMonth]
  if (!availableDays || availableDays.length === 0) {
    return null
  }

  // 2. 并行拉取：OSS 天数据 + Supabase 成员映射
  const dayFetches = availableDays.map(dayStr =>
    fetch(`${OSS_HORIZN_BASE}/timeline/${yearMonth}/${dayStr}.json`, {
      next: { revalidate: 300 }
    })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  )

  const [daysData, idMapping] = await Promise.all([
    Promise.all(dayFetches),
    getMembersIdMapping()
  ])

  const days = daysData.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))
  const tOSS = Date.now()

  // 3. 转换 OSS 数据为 sessions 格式
  const sessions = []
  const allNames = new Set()

  Object.values(idMapping).forEach(info => {
    if (info?.name) allNames.add(info.name)
  })

  let lastTimestamp = null
  days.forEach(day => {
    const dateStr = day.date
    const timeline = day.timeline || []
    timeline.forEach(frame => {
      const sessionTime = `${dateStr} ${frame.ts}:00`
      const entries = (frame.d || []).map(p => ({
        player_id: p.p,
        weekly_activity: p.w || 0,
        season_activity: p.s || 0
      }))
      sessions.push({ session_time: sessionTime, entries })

      // 记录最新时间戳
      if (!lastTimestamp || sessionTime > lastTimestamp) {
        lastTimestamp = sessionTime
      }
    })
  })

  // 4. 从 DuckDB 获取增量数据（OSS 之后的实时数据）
  const duckDBSessions = await getDuckDBIncrement(lastTimestamp, yearMonth)
  if (duckDBSessions.length > 0) {
    sessions.push(...duckDBSessions)
    // 增量数据中可能有新 player_id，用已有 idMapping 查名字
    duckDBSessions.forEach(s => {
      s.entries.forEach(e => {
        const info = idMapping[e.player_id]
        if (info?.name) allNames.add(info.name)
      })
    })
  }

  const elapsed = Date.now() - t0
  console.log(
    `[服务端] 数据合并完成 | OSS: ${days.length}天 ${tOSS - t0}ms | DuckDB增量: ${duckDBSessions.length}帧 | 总耗时: ${elapsed}ms` +
    (lastTimestamp ? ` | OSS最新: ${lastTimestamp}` : '')
  )

  const result = {
    yearMonth,
    sessions,
    idMapping,
    allNames: Array.from(allNames).filter(Boolean),
    dayCount: days.length,
    duckDBFrames: duckDBSessions.length,
    lastOSSTimestamp: lastTimestamp,
    fetchTime: elapsed
  }

  // 写入内存缓存
  _monthlyDataCache.set(yearMonth, { data: result, cachedAt: Date.now() })
  console.log(`[服务端] 月度数据已缓存: ${yearMonth} (下次请求将在 <1ms 内返回)`)

  return result
}

function normalizeDate(dateValue) {
  if (!dateValue) return null
  const str = String(dateValue).replace(/-/g, '')
  return str.length >= 8 ? str.slice(0, 8) : str
}
