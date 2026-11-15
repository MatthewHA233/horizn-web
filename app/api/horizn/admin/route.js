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
import { buildAdminLoginProfiles, filterPublicAdminLoginRows } from '@/lib/adminLoginAudit'
import { adminLoginLocationKey } from '@/lib/adminLoginLocation'
import { getLatestHttpTrustedName } from '@/lib/horiznMemberNames'

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
  'claim-admin-login-location',
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

const PLAYER_ID_PATTERN = /^[0-9A-F]{12,16}$/

function normalizePlayerId(value) {
  const playerId = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return PLAYER_ID_PATTERN.test(playerId) ? playerId : null
}

const seenAt = (variant) => (variant.last_seen ? Date.parse(variant.last_seen) || 0 : 0)

/**
 * 成员展示名：最新 HTTP 可信名 > 真名 > 最近出现的历史名（排除 OCR 噪声）> player_id
 */
function memberDisplayName(member, playerId) {
  const variants = member?.name_variants || []
  const primaryName = variants.find(variant => variant.is_primary)?.name
  const trusted = getLatestHttpTrustedName({ ...member, player_id: playerId, primary_name: primaryName })
  if (trusted && trusted !== playerId) return trusted
  const latestHistory = [...variants]
    .filter(variant => variant.name && variant.representative !== false)
    .sort((a, b) => seenAt(b) - seenAt(a))[0]
  return latestHistory?.name || playerId
}

/**
 * 复制排名名单的剔除管理名单，附展示名
 */
async function listCopyRankAdmins(supabase) {
  const { data: rows, error } = await supabase
    .from('horizn_copy_rank_admins')
    .select('player_id, excluded')
    .order('created_at')
    .order('player_id')
  if (error) throw error
  if (!rows?.length) return []

  const { data: members, error: memberError } = await supabase
    .from('horizn_members')
    .select('player_id, active, name_variants:horizn_name_variants(name, source, last_seen, is_primary, representative)')
    .in('player_id', rows.map(row => row.player_id))
  if (memberError) throw memberError

  const membersById = new Map((members || []).map(member => [member.player_id, member]))
  return rows.map(row => {
    const member = membersById.get(row.player_id)
    return {
      playerId: row.player_id,
      excluded: row.excluded,
      active: member?.active ?? false,
      name: memberDisplayName(member, row.player_id),
    }
  })
}

export async function GET(request) {
  const resource = new URL(request.url).searchParams.get('resource')
  const requiredRole = ['members', 'hull', 'blacklist-else', 'login-audit'].includes(resource)
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
    if (resource === 'review-members') {
      // 审核群在群名单 + 自报游戏 ID（表仅 service_role 可读；已退群的只标记 left_at，这里排除）
      const { data, error } = await supabase
        .from('horizn_review_qq_accounts')
        .select('qq_id, card, nickname, player_id')
        .is('left_at', null)
      if (error) throw error
      return NextResponse.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (resource === 'copy-rank-admins') {
      const data = await listCopyRankAdmins(supabase)
      return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
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
    if (resource === 'login-audit') {
      const [auditResult, claimsResult] = await Promise.all([
        supabase
          .from('horizn_admin_login_audit')
          .select('id, logged_in_at, role, ip_address, country_code, region, city, user_agent, accept_language, browser, operating_system, device_type')
          .order('logged_in_at', { ascending: false })
          .limit(1000),
        supabase
          .from('horizn_admin_login_identity_claims')
          .select('location_key, identity_name, location_label, updated_at'),
      ])
      if (auditResult.error) throw auditResult.error
      if (claimsResult.error) throw claimsResult.error

      const rows = filterPublicAdminLoginRows(auditResult.data || [])
      const claimsByLocation = new Map(
        (claimsResult.data || []).map(claim => [claim.location_key, claim]),
      )
      const profiles = buildAdminLoginProfiles(rows).map(profile => ({
        ...profile,
        identityName: claimsByLocation.get(profile.locationKey)?.identity_name || null,
        identityUpdatedAt: claimsByLocation.get(profile.locationKey)?.updated_at || null,
      }))
      const knownLocationKey = row => {
        const key = adminLoginLocationKey(row)
        return key === 'unknown' ? null : key
      }
      const loginRegions = new Set(rows.map(knownLocationKey).filter(Boolean))
      const superRegions = new Set(
        rows.filter(row => row.role === SUPER_ADMIN_ROLE).map(knownLocationKey).filter(Boolean),
      )
      return NextResponse.json({
        data: {
          summary: {
            totalLogins: rows.length,
            uniqueIps: new Set(rows.map(row => row.ip_address)).size,
            superLogins: rows.filter(row => row.role === SUPER_ADMIN_ROLE).length,
            loginRegions: loginRegions.size,
            superAdminRegions: superRegions.size,
          },
          profiles,
          recentEvents: rows.slice(0, 100).map(row => ({
            ...row,
            identityName: claimsByLocation.get(adminLoginLocationKey(row))?.identity_name || null,
          })),
        },
      }, { headers: { 'Cache-Control': 'no-store' } })
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
      case 'add-copy-rank-admin': {
        const playerId = normalizePlayerId(body.playerId)
        if (!playerId) return fail('玩家ID格式无效')
        const { data: member, error: memberError } = await supabase
          .from('horizn_members')
          .select('player_id')
          .eq('player_id', playerId)
          .maybeSingle()
        if (memberError) throw memberError
        if (!member) return fail('成员不存在')
        const { error } = await supabase
          .from('horizn_copy_rank_admins')
          .upsert({ player_id: playerId }, { onConflict: 'player_id', ignoreDuplicates: true })
        if (error) throw error
        result = { success: true }
        break
      }
      case 'set-copy-rank-admin-excluded': {
        const playerId = normalizePlayerId(body.playerId)
        if (!playerId || typeof body.excluded !== 'boolean') return fail('参数无效')
        const { error } = await supabase
          .from('horizn_copy_rank_admins')
          .update({ excluded: body.excluded, updated_at: new Date().toISOString() })
          .eq('player_id', playerId)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'remove-copy-rank-admin': {
        const playerId = normalizePlayerId(body.playerId)
        if (!playerId) return fail('玩家ID格式无效')
        const { error } = await supabase.from('horizn_copy_rank_admins').delete().eq('player_id', playerId)
        if (error) throw error
        result = { success: true }
        break
      }
      case 'claim-admin-login-location': {
        const locationKey = typeof body.locationKey === 'string' ? body.locationKey.trim() : ''
        const identityName = typeof body.identityName === 'string'
          ? body.identityName.replace(/[\u0000-\u001f\u007f]/g, '').trim()
          : ''
        const locationLabel = typeof body.locationLabel === 'string'
          ? body.locationLabel.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160)
          : null

        if (locationKey === 'unknown' || locationKey.length < 3 || locationKey.length > 255) {
          return fail('地区画像标识无效')
        }
        if (identityName.length > 40) return fail('身份名称最多 40 个字符')

        if (!identityName) {
          const { error } = await supabase
            .from('horizn_admin_login_identity_claims')
            .delete()
            .eq('location_key', locationKey)
          if (error) throw error
          result = { success: true, data: null }
        } else {
          const { data, error } = await supabase
            .from('horizn_admin_login_identity_claims')
            .upsert({
              location_key: locationKey,
              identity_name: identityName,
              location_label: locationLabel || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'location_key' })
            .select('location_key, identity_name, location_label, updated_at')
            .single()
          if (error) throw error
          result = { success: true, data }
        }
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
