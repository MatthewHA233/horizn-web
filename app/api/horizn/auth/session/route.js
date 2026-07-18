import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/horiznAdminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = getAdminSession(request)
  const response = NextResponse.json(session
    ? { authenticated: true, role: session.role }
    : { authenticated: false, role: null })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
