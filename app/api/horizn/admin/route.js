import { NextResponse } from 'next/server'
import {
  ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  getAdminSession,
  getRequestIp,
  hasRequiredRole,
  isSameOriginRequest,
} from '@/lib/horiznAdminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPER_ACTIONS = new Set([
  'assign-hull',
  'revoke-hull',
  'hard-delete-hull',
  'update-hull',
  'set-member-blacklist',
  'set-member-blacklist-date',
  'transfer-hull',
  'add-blacklist-else',
  'update-blacklist-else',
  'delete-blacklist-else',
  'manual-bind-qq',
  'update-qq-left-at',
])

function unauthorized() {
  return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: '需要超级管理员权限' }, { status: 403 })
}

function fail(message = '管理操作失败', status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function requireSession(request, requiredRole = ADMIN_ROLE) {
  const session = getAdminSession(request)
  if (!session) return { response: unauthorized() }
  if (!hasRequiredRole(session, requiredRole)) return { response: forbidden() }
  return { session }
}

async function rpc(supabase, name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  if (data && data.success === false) return { success: false, error: data.error || '操作失败' }
  return data ?? { success: true }
}

export async function GET(request) {
  const resource = new URL(request.url).searchParams.get('resource')
  const requiredRole = ['members', 'hull', 'blacklist-else'].includes(resource)
    ? SUPER_ADMIN_ROLE
    : ADMIN_ROLE
  const auth = requireSession(request, requiredRole)
  if (auth.response) return auth.response

  try {
    const supabase = getSupabaseAdmin()

    if (resource === 'members') {
      const { data, error } = await supabase.rpc('horizn_get_members_admin')
      if (error) throw error
      return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (resource === 'hull') {
      const { data, error } = await supabase.rpc('horizn_get_hull_occupancy')
      if (error) throw error
      return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (resource === 'blacklist-else') {
      const { data, error } = await supabase
        .from('horizn_blacklist_else')
        .select('*')
        .order('blacklist_date', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (resource === 'qq-members') {
      const { data, error } = await supabase.rpc('horizn_get_qq_members')
      if (error) throw error
      return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (resource === 'monthly-rules') {
      const searchParams = new URL(request.url).searchParams
      const year = Number(searchParams.get('year'))
      const month = Number(searchParams.get('month'))
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return fail('年月参数无效')

      const { data, error } = await supabase
        .from('horizn_monthly_rules')
        .select('rule_config')
        .eq('year', year)
        .eq('month', month)
        .eq('rule_type', 'assessment')
        .eq('rule_name', 'monthly_rules')
        .maybeSingle()
      if (error) throw error
      return NextResponse.json({ data: data?.rule_config || null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    return fail('未知管理资源', 404)
  } catch (error) {
    console.error(`[admin-api] 读取 ${resource} 失败:`, error.message)
    return fail('管理数据读取失败', 500)
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return fail('请求来源无效', 403)

  let body
  try {
    body = await request.json()
  } catch {
    return fail('请求格式无效')
  }

  const action = body?.action
  const auth = requireSession(request, SUPER_ACTIONS.has(action) ? SUPER_ADMIN_ROLE : ADMIN_ROLE)
  if (auth.response) return auth.response

  try {
    const supabase = getSupabaseAdmin()
    let result

    switch (action) {
      case 'mark-event-kicked': {
        const { error } = await supabase
          .from('horizn_membership_events')
          .update({ is_kicked: Boolean(body.isKicked) })
          .eq('id', body.eventId)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'save-monthly-rules': {
        const year = Number(body.year)
        const month = Number(body.month)
        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || typeof body.config !== 'object') {
          return fail('规则参数无效')
        }
        const { error } = await supabase.from('horizn_monthly_rules').upsert({
          year,
          month,
          rule_type: 'assessment',
          rule_name: 'monthly_rules',
          rule_config: body.config,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'year,month,rule_type,rule_name' })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'assign-hull':
        result = await rpc(supabase, 'horizn_assign_hull', {
          p_player_id: body.playerId,
          p_hull_number: body.hullNumber,
          p_notes: body.notes ?? null,
        })
        break
      case 'revoke-hull':
        result = await rpc(supabase, 'horizn_revoke_hull', {
          p_player_id: body.playerId,
          p_hull_number: body.hullNumber,
          p_notes: body.notes ?? null,
        })
        break
      case 'hard-delete-hull':
        result = await rpc(supabase, 'horizn_hard_delete_hull', { p_assignment_id: body.assignmentId })
        break
      case 'update-hull':
        result = await rpc(supabase, 'horizn_update_hull_assignment', {
          p_assignment_id: body.assignmentId,
          p_assigned_at: body.params?.assigned_at ?? null,
          p_update_assigned_at: body.params?.update_assigned_at ?? false,
          p_revoked_at: body.params?.revoked_at ?? null,
          p_update_revoked_at: body.params?.update_revoked_at ?? false,
          p_notes: body.params?.notes ?? null,
          p_update_notes: body.params?.update_notes ?? false,
        })
        break
      case 'set-member-blacklist':
        result = await rpc(supabase, 'horizn_set_member_blacklist', {
          p_player_id: body.playerId,
          p_is_blacklisted: Boolean(body.isBlacklisted),
          p_note: body.note || null,
        })
        break
      case 'set-member-blacklist-date': {
        const { error } = await supabase
          .from('horizn_members')
          .update({ blacklist_date: body.date || null })
          .eq('player_id', body.playerId)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'transfer-hull':
        result = await rpc(supabase, 'horizn_transfer_hull', {
          p_old_player_id: body.oldPlayerId,
          p_new_player_id: body.newPlayerId,
          p_hull_number: body.hullNumber,
          p_notes: body.notes ?? null,
        })
        break
      case 'add-blacklist-else': {
        const { data, error } = await supabase
          .from('horizn_blacklist_else')
          .insert({
            name: body.entry?.name,
            player_id: body.entry?.player_id || null,
            qq_number: body.entry?.qq_number || null,
            note: body.entry?.note || null,
          })
          .select()
          .single()
        if (error) throw error
        result = { success: true, data }
        break
      }
      case 'update-blacklist-else': {
        const entry = body.entry || {}
        const payload = {
          name: entry.name,
          player_id: entry.player_id || null,
          qq_number: entry.qq_number || null,
          note: entry.note || null,
        }
        if (entry.blacklist_date !== undefined) payload.blacklist_date = entry.blacklist_date || null
        const { error } = await supabase.from('horizn_blacklist_else').update(payload).eq('id', body.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'delete-blacklist-else': {
        const { error } = await supabase.from('horizn_blacklist_else').delete().eq('id', body.id)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'manual-bind-qq': {
        const { data: member, error: memberError } = await supabase
          .from('horizn_members')
          .select('id')
          .eq('player_id', body.playerId)
          .single()
        if (memberError || !member) return fail('成员不存在')
        const { error } = await supabase.from('horizn_qq_accounts').upsert({
          qq_id: body.qqId,
          member_id: member.id,
          left_at: body.leftAt || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'qq_id' })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'update-qq-left-at': {
        const { error } = await supabase
          .from('horizn_qq_accounts')
          .update({ left_at: body.leftAt || null, updated_at: new Date().toISOString() })
          .eq('qq_id', body.qqId)
        if (error) throw error
        result = { success: true }
        break
      }
      default:
        return fail('未知管理操作', 404)
    }

    console.info('[admin-audit]', JSON.stringify({
      at: new Date().toISOString(),
      action,
      role: auth.session.role,
      ip: getRequestIp(request),
    }))
    return NextResponse.json(result)
  } catch (error) {
    console.error(`[admin-api] ${action} 失败:`, error.message)
    return fail('管理操作失败', 500)
  }
}
