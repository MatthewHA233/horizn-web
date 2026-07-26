import 'server-only'

import { getRequestIp } from '@/lib/horiznAdminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { adminLoginLocationKey, adminLoginLocationLabel } from '@/lib/adminLoginLocation'
import {
  filterPublicAdminLoginRows,
  isPublicAdminAuditIp,
  normalizeAdminAuditIp,
} from '@/lib/adminAuditIp'

export { filterPublicAdminLoginRows } from '@/lib/adminAuditIp'

function cleanHeader(value, maxLength = 255) {
  if (!value) return null
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength) || null
}

function decodeGeoHeader(value) {
  const cleaned = cleanHeader(value, 120)
  if (!cleaned) return null
  try {
    return decodeURIComponent(cleaned)
  } catch {
    return cleaned
  }
}

function parseUserAgent(userAgent = '') {
  const ua = userAgent.toLowerCase()

  let browser = '未知浏览器'
  if (/edg\//.test(ua)) browser = 'Edge'
  else if (/opr\//.test(ua)) browser = 'Opera'
  else if (/firefox\//.test(ua)) browser = 'Firefox'
  else if (/chrome\//.test(ua) || /crios\//.test(ua)) browser = 'Chrome'
  else if (/safari\//.test(ua)) browser = 'Safari'
  else if (/curl\//.test(ua)) browser = 'curl'

  let operatingSystem = '未知系统'
  if (/windows nt 10/.test(ua)) operatingSystem = 'Windows 10/11'
  else if (/windows/.test(ua)) operatingSystem = 'Windows'
  else if (/iphone|ipad|ipod/.test(ua)) operatingSystem = 'iOS/iPadOS'
  else if (/android/.test(ua)) operatingSystem = 'Android'
  else if (/mac os x|macintosh/.test(ua)) operatingSystem = 'macOS'
  else if (/linux/.test(ua)) operatingSystem = 'Linux'

  let deviceType = 'desktop'
  if (/bot|crawler|spider|headless/.test(ua)) deviceType = 'bot'
  else if (/ipad|tablet/.test(ua)) deviceType = 'tablet'
  else if (/mobile|iphone|ipod|android/.test(ua)) deviceType = 'mobile'

  return { browser, operatingSystem, deviceType }
}

export async function recordSuccessfulAdminLogin(request, role) {
  try {
    const ipAddress = normalizeAdminAuditIp(getRequestIp(request))
    if (!isPublicAdminAuditIp(ipAddress)) return

    const userAgent = cleanHeader(request.headers.get('user-agent'), 1024)
    const parsed = parseUserAgent(userAgent || '')
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('horizn_admin_login_audit').insert({
      role,
      ip_address: ipAddress,
      country_code: cleanHeader(request.headers.get('x-vercel-ip-country'), 2)?.toUpperCase() || null,
      region: decodeGeoHeader(request.headers.get('x-vercel-ip-country-region')),
      city: decodeGeoHeader(request.headers.get('x-vercel-ip-city')),
      user_agent: userAgent,
      accept_language: cleanHeader(request.headers.get('accept-language'), 255),
      browser: parsed.browser,
      operating_system: parsed.operatingSystem,
      device_type: parsed.deviceType,
      request_id: cleanHeader(request.headers.get('x-vercel-id'), 255),
    })
    if (error) throw error
  } catch (error) {
    // 审计系统故障不能阻断管理员登录，但必须留下服务端错误日志。
    console.error('[admin-audit] 记录登录画像失败:', error.message)
  }
}

export function buildAdminLoginProfiles(rows = []) {
  const profiles = new Map()

  for (const row of filterPublicAdminLoginRows(rows)) {
    const key = adminLoginLocationKey(row)
    let profile = profiles.get(key)
    if (!profile) {
      profile = {
        locationKey: key,
        locationLabel: adminLoginLocationLabel(row),
        loginCount: 0,
        firstSeen: row.logged_in_at,
        lastSeen: row.logged_in_at,
        ipAddresses: new Set(),
        roles: new Set(),
        browsers: new Set(),
        operatingSystems: new Set(),
        deviceTypes: new Set(),
        languages: new Set(),
        lastUserAgent: row.user_agent || null,
      }
      profiles.set(key, profile)
    }

    profile.loginCount += 1
    profile.ipAddresses.add(row.ip_address)
    if (new Date(row.logged_in_at) < new Date(profile.firstSeen)) profile.firstSeen = row.logged_in_at
    if (new Date(row.logged_in_at) > new Date(profile.lastSeen)) {
      profile.lastSeen = row.logged_in_at
      profile.lastUserAgent = row.user_agent || profile.lastUserAgent
    }
    if (row.role) profile.roles.add(row.role)
    if (row.browser) profile.browsers.add(row.browser)
    if (row.operating_system) profile.operatingSystems.add(row.operating_system)
    if (row.device_type) profile.deviceTypes.add(row.device_type)
    if (row.accept_language) profile.languages.add(row.accept_language.split(',')[0])
  }

  return Array.from(profiles.values())
    .map(profile => ({
      ...profile,
      ipAddresses: Array.from(profile.ipAddresses).sort(),
      roles: Array.from(profile.roles),
      browsers: Array.from(profile.browsers),
      operatingSystems: Array.from(profile.operatingSystems),
      deviceTypes: Array.from(profile.deviceTypes),
      languages: Array.from(profile.languages),
    }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
}
