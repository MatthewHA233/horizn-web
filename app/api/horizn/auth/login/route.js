import { NextResponse } from 'next/server'
import {
  authenticateAdminPassword,
  createAdminSessionToken,
  getRequestIp,
  isSameOriginRequest,
  setAdminSessionCookie,
} from '@/lib/horiznAdminAuth'
import { recordSuccessfulAdminLogin } from '@/lib/adminLoginAudit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map()

function getAttemptState(ip) {
  const now = Date.now()
  const state = attempts.get(ip)
  if (!state || state.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS }
    attempts.set(ip, fresh)
    return fresh
  }
  return state
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
  }

  const ip = getRequestIp(request)
  const state = getAttemptState(ip)
  if (state.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: '尝试次数过多，请 15 分钟后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((state.resetAt - Date.now()) / 1000)) } },
    )
  }

  try {
    const body = await request.json()
    const role = await authenticateAdminPassword(body?.password)
    if (!role) {
      state.count += 1
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    attempts.delete(ip)
    await recordSuccessfulAdminLogin(request, role)
    const response = NextResponse.json({ authenticated: true, role })
    setAdminSessionCookie(response, createAdminSessionToken(role))
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('[admin-auth] 登录失败:', error.message)
    return NextResponse.json({ error: '登录服务暂不可用' }, { status: 500 })
  }
}
