import { isIP } from 'node:net'

export function normalizeAdminAuditIp(value) {
  if (!value || value === 'unknown') return null
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) return trimmed.match(/^\[([^\]]+)\]/)?.[1]?.split('%')[0] || null
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(trimmed)) return trimmed.replace(/:\d+$/, '')
  return trimmed.split('%')[0].slice(0, 64)
}

function isPrivateOrLocalIpv4(ip) {
  const [first, second] = ip.split('.').map(Number)
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

/** 画像只接受有效公网 IP，排除开发机、回环、局域网和 IPv6 本地地址。 */
export function isPublicAdminAuditIp(value) {
  const ip = normalizeAdminAuditIp(value)?.toLowerCase()
  if (!ip || ip === 'localhost') return false

  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1]
  if (mappedIpv4) return isIP(mappedIpv4) === 4 && !isPrivateOrLocalIpv4(mappedIpv4)

  const version = isIP(ip)
  if (version === 4) return !isPrivateOrLocalIpv4(ip)
  if (version !== 6) return false

  return ip !== '::'
    && ip !== '::1'
    && !/^f[cd]/.test(ip)
    && !/^fe[89ab]/.test(ip)
}

export function filterPublicAdminLoginRows(rows = []) {
  return rows.filter(row => isPublicAdminAuditIp(row.ip_address))
}
