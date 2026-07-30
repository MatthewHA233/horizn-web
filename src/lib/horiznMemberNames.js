/**
 * 取成员最新的 HTTP 可信名字。
 *
 * mw-member 会把游戏 HTTP 接口返回的精确名字写入 name_variants，
 * 并标记 source='http'。这里与 Electron 成员档案保持相同规则：
 * HTTP 名字按 last_seen 倒序，取最新一条；没有时再回退 primary_name。
 */
export function getLatestHttpTrustedName(member) {
  const variants = Array.isArray(member?.name_variants) ? member.name_variants : []
  let latest = null
  let latestAt = Number.NEGATIVE_INFINITY

  for (const variant of variants) {
    if (variant?.source !== 'http' || !variant?.name) continue
    const parsedAt = variant.last_seen ? Date.parse(variant.last_seen) : 0
    const seenAt = Number.isFinite(parsedAt) ? parsedAt : 0
    if (!latest || seenAt > latestAt) {
      latest = variant
      latestAt = seenAt
    }
  }

  return latest?.name || member?.primary_name || member?.player_id || ''
}

export function buildLatestMemberNameMap(members) {
  const mapping = {}
  for (const member of members || []) {
    if (!member?.player_id) continue
    mapping[member.player_id] = getLatestHttpTrustedName(member)
  }
  return mapping
}
