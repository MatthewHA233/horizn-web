import { NextResponse } from 'next/server'
import { clearAdminSessionCookie, isSameOriginRequest } from '@/lib/horiznAdminAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
  }

  const response = NextResponse.json({ authenticated: false })
  clearAdminSessionCookie(response)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
