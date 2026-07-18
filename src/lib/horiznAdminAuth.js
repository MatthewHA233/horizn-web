import 'server-only'

import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback)

export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12
export const ADMIN_ROLE = 'admin'
export const SUPER_ADMIN_ROLE = 'super'

const COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-horizn_admin_session'
  : 'horizn_admin_session'

function getSessionSecret() {
  const secret = process.env.HORIZN_SESSION_SECRET || ''
  if (secret.length < 32) {
    throw new Error('HORIZN_SESSION_SECRET 必须至少 32 个字符')
  }
  return secret
}

function getPasswordHash(role) {
  return role === SUPER_ADMIN_ROLE
    ? process.env.HORIZN_SUPER_PASSWORD_HASH || ''
    : process.env.HORIZN_ADMIN_PASSWORD_HASH || ''
}

async function verifyPassword(password, encodedHash) {
  const [algorithm, salt, expected] = encodedHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !expected) return false

  try {
    const expectedBuffer = Buffer.from(expected, 'base64url')
    const actualBuffer = await scrypt(password.normalize('NFKC'), salt, expectedBuffer.length)
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export async function authenticateAdminPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) return null

  const superHash = getPasswordHash(SUPER_ADMIN_ROLE)
  const adminHash = getPasswordHash(ADMIN_ROLE)
  if (!superHash || !adminHash) {
    throw new Error('管理员密码哈希尚未配置')
  }

  if (await verifyPassword(password, superHash)) return SUPER_ADMIN_ROLE
  if (await verifyPassword(password, adminHash)) return ADMIN_ROLE
  return null
}

function sign(encodedPayload) {
  return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url')
}

export function createAdminSessionToken(role) {
  if (![ADMIN_ROLE, SUPER_ADMIN_ROLE].includes(role)) throw new Error('无效管理员角色')

  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    role,
    iat: now,
    exp: now + ADMIN_COOKIE_MAX_AGE,
    version: 1,
  })).toString('base64url')

  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token) {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  try {
    const expectedSignature = sign(payload)
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    if (session.version !== 1 || session.exp <= now || ![ADMIN_ROLE, SUPER_ADMIN_ROLE].includes(session.role)) return null
    return session
  } catch {
    return null
  }
}

export function getAdminSession(request) {
  return verifyAdminSessionToken(request.cookies.get(COOKIE_NAME)?.value)
}

export function hasRequiredRole(session, requiredRole = ADMIN_ROLE) {
  if (!session) return false
  return requiredRole === SUPER_ADMIN_ROLE ? session.role === SUPER_ADMIN_ROLE : true
}

export function setAdminSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  })
}

export function clearAdminSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function isSameOriginRequest(request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false

  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export function getRequestIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export function safeEqualSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !actual || !expected) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
