import { NextResponse } from 'next/server'
import { getAdminSession, hasRequiredRole, isSameOriginRequest } from '@/lib/horiznAdminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
  }
  if (!hasRequiredRole(getAdminSession(request))) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
  }

  const url = process.env.NAPCAT_URL || ''
  const token = process.env.NAPCAT_TOKEN || ''
  const groupId = process.env.NAPCAT_GROUP_ID || ''
  if (!url || !token || !groupId) {
    return NextResponse.json({ error: '群消息服务尚未配置' }, { status: 503 })
  }

  try {
    const { message } = await request.json()
    if (typeof message !== 'string' || !message.trim() || message.length > 10000) {
      return NextResponse.json({ error: '消息内容无效' }, { status: 400 })
    }

    const response = await fetch(`${url.replace(/\/$/, '')}/send_group_msg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ group_id: groupId, message }),
      signal: AbortSignal.timeout(10000),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.status === 'failed') {
      console.error('[napcat] 发送失败:', response.status, result.message || result.wording || '')
      return NextResponse.json({ success: false, error: '群消息发送失败' }, { status: 502 })
    }
    return NextResponse.json({ success: true, message_id: result.data?.message_id })
  } catch (error) {
    console.error('[napcat] 请求失败:', error.message)
    return NextResponse.json({ success: false, error: '群消息服务不可用' }, { status: 502 })
  }
}
