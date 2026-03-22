/**
 * HORIZN 服务端数据获取
 * 在 Next.js Server Component 中使用，利用 ISR 缓存
 */

const OSS_HORIZN_BASE = process.env.NEXT_PUBLIC_HORIZN_OSS_BASE || ''

/**
 * 获取可用月份列表（从 OSS）
 */
export async function getAvailableMonths() {
  const res = await fetch(`${OSS_HORIZN_BASE}/available-months.json`, {
    next: { revalidate: 300 } // 5 分钟 ISR 缓存
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
 * 获取某月的全部 OSS 天数据 + 成员映射
 * 服务端 fetch，Vercel 自动缓存
 */
export async function getMonthlyOSSData(yearMonth) {
  const t0 = Date.now()

  // 1. 获取可用天数
  const { raw: months } = await getAvailableMonths()
  const availableDays = months[yearMonth]
  if (!availableDays || availableDays.length === 0) {
    return null
  }

  // 2. 并行拉取所有天数据 + 成员映射
  const dayFetches = availableDays.map(dayStr =>
    fetch(`${OSS_HORIZN_BASE}/timeline/${yearMonth}/${dayStr}.json`, {
      next: { revalidate: 300 }
    })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  )

  const membersFetch = fetch(`${OSS_HORIZN_BASE}/members.json`, {
    next: { revalidate: 300 }
  })
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)

  const [daysData, membersData] = await Promise.all([
    Promise.all(dayFetches),
    membersFetch
  ])

  const days = daysData.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))

  // 3. 构建 idMapping
  const idMapping = {}
  if (membersData && Array.isArray(membersData)) {
    for (const m of membersData) {
      const primaryName = m.primary_name || m.player_id
      const group0 = Array.isArray(m.name_groups) ? m.name_groups.find(g => g.group_index === 0) : null
      const variants = Array.isArray(group0?.names)
        ? group0.names.map(n => n?.name).filter(Boolean)
        : []
      idMapping[m.player_id] = {
        name: primaryName,
        nameVariants: variants.length ? variants.join('|') : primaryName,
        joinDate: m.join_date ? normalizeDate(m.join_date) : null,
        leaveDate: m.leave_date ? normalizeDate(m.leave_date) : null
      }
    }
  }

  // 4. 转换成 sessions 格式
  const sessions = []
  const allNames = new Set()

  Object.values(idMapping).forEach(info => {
    if (info?.name) allNames.add(info.name)
  })

  days.forEach(day => {
    const dateStr = day.date
    const timeline = day.timeline || []
    timeline.forEach(frame => {
      const entries = (frame.d || []).map(p => ({
        player_id: p.p,
        weekly_activity: p.w || 0,
        season_activity: p.s || 0
      }))
      sessions.push({
        session_time: `${dateStr} ${frame.ts}:00`,
        entries
      })
    })
  })

  const elapsed = Date.now() - t0
  console.log(`[服务端] OSS数据获取: ${days.length}天, ${elapsed}ms`)

  return {
    yearMonth,
    sessions,
    idMapping,
    allNames: Array.from(allNames).filter(Boolean),
    dayCount: days.length,
    fetchTime: elapsed
  }
}

function normalizeDate(dateValue) {
  if (!dateValue) return null
  const str = String(dateValue).replace(/-/g, '')
  return str.length >= 8 ? str.slice(0, 8) : str
}
