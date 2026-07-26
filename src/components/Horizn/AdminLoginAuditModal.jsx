import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clock3,
  Copy,
  Fingerprint,
  Globe2,
  Laptop,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminLoginLocationKey, adminLoginLocationLabel } from '@/lib/adminLoginLocation'

const EMPTY_DATA = {
  summary: {
    totalLogins: 0,
    uniqueIps: 0,
    superLogins: 0,
    loginRegions: 0,
    superAdminRegions: 0,
  },
  profiles: [],
  recentEvents: [],
}

function formatTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Hong_Kong',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function roleLabel(role) {
  return role === 'super' ? '超级管理员' : '普通管理员'
}

function deviceLabel(device) {
  return ({ desktop: '桌面端', mobile: '手机', tablet: '平板', bot: '自动化' })[device] || device
}

export default function AdminLoginAuditModal({ show, onClose, isMobile }) {
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('profiles')
  const [editingLocation, setEditingLocation] = useState(null)
  const [claimDraft, setClaimDraft] = useState('')
  const [claimSaving, setClaimSaving] = useState(false)

  const loadAudit = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/horizn/admin?resource=login-audit', {
        cache: 'no-store',
        signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '登录审计读取失败')
      setData(result.data || EMPTY_DATA)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '登录审计读取失败')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!show) return undefined
    const controller = new AbortController()
    loadAudit(controller.signal)
    return () => controller.abort()
  }, [show, loadAudit])

  const filteredProfiles = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data.profiles
    return data.profiles.filter(profile => [
      profile.locationLabel,
      profile.identityName,
      ...profile.ipAddresses,
      ...profile.browsers,
      ...profile.operatingSystems,
      ...profile.deviceTypes.map(deviceLabel),
    ].join(' ').toLowerCase().includes(keyword))
  }, [data.profiles, query])

  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data.recentEvents
    return data.recentEvents.filter(event => [
      event.ip_address,
      event.country_code,
      event.region,
      event.city,
      event.browser,
      event.operating_system,
      event.device_type,
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword))
  }, [data.recentEvents, query])

  const copyIp = async (ip) => {
    try {
      await navigator.clipboard.writeText(ip)
      toast.success('IP 已复制', { duration: 1500 })
    } catch {
      toast.error('复制失败')
    }
  }

  const editClaim = (profile) => {
    setEditingLocation(profile.locationKey)
    setClaimDraft(profile.identityName || '')
  }

  const saveClaim = async (profile, requestedName = claimDraft) => {
    if (claimSaving) return
    const identityName = requestedName.trim()
    setClaimSaving(true)
    try {
      const response = await fetch('/api/horizn/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim-admin-login-location',
          locationKey: profile.locationKey,
          locationLabel: profile.locationLabel,
          identityName,
        }),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) throw new Error(result.error || '身份认领失败')

      setData(current => ({
        ...current,
        profiles: current.profiles.map(item => (
          item.locationKey === profile.locationKey
            ? { ...item, identityName: identityName || null }
            : item
        )),
        recentEvents: current.recentEvents.map(event => (
          profile.locationKey === adminLoginLocationKey(event)
            ? { ...event, identityName: identityName || null }
            : event
        )),
      }))
      setEditingLocation(null)
      setClaimDraft('')
      toast.success(identityName ? `已标记为 ${identityName}` : '已取消身份认领')
      await loadAudit()
    } catch (err) {
      toast.error(err.message || '身份认领失败')
    } finally {
      setClaimSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-3">
      <div className={`flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-violet-500/20 bg-[#0c0e15]/95 shadow-2xl sm:rounded-xl ${isMobile ? 'h-[calc(100dvh-1rem)]' : 'max-h-[88vh]'}`}>
        <div className="h-0.5 shrink-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-amber-400" />

        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Fingerprint className="h-4 w-4 shrink-0 text-violet-400" />
              管理员登录画像
            </div>
            <p className="mt-1 text-[10px] text-gray-300">成功登录记录 · 永久保留</p>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            <button
              onClick={() => loadAudit()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40 sm:h-auto sm:w-auto sm:p-1.5"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-white/5 hover:text-white sm:h-auto sm:w-auto sm:p-1.5" aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-1.5 border-b border-white/5 px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3">
          {[
            { label: '登录地区', mobileLabel: '地区', value: data.summary.loginRegions, icon: MapPin, color: 'text-cyan-400' },
            { label: '登录次数', mobileLabel: '次数', value: data.summary.totalLogins, icon: ShieldCheck, color: 'text-violet-400' },
            { label: '超级管理员地区', mobileLabel: '超管地区', value: data.summary.superAdminRegions, icon: Fingerprint, color: 'text-amber-400' },
          ].map(({ label, mobileLabel, value, icon: Icon, color }) => (
            <div key={label} className="min-w-0 rounded-lg border border-white/5 bg-white/[0.025] px-2 py-2 sm:px-3">
              <div className="flex min-w-0 items-center gap-1 text-[10px] leading-tight text-gray-300 sm:gap-1.5">
                <Icon className={`h-3 w-3 shrink-0 ${color}`} />
                <span className="sm:hidden">{mobileLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-gray-100 sm:text-lg">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 border-b border-white/5 px-3 py-2.5 sm:flex-row sm:items-center sm:px-4">
          <div className="grid grid-cols-2 rounded-md border border-white/5 bg-black/20 p-0.5 text-[10px] sm:flex">
            <button onClick={() => setView('profiles')} className={`rounded px-2 py-1.5 transition-colors sm:py-1 ${view === 'profiles' ? 'bg-violet-500/20 text-violet-200' : 'text-gray-300 hover:text-white'}`}>地区画像</button>
            <button onClick={() => setView('events')} className={`rounded px-2 py-1.5 transition-colors sm:py-1 ${view === 'events' ? 'bg-violet-500/20 text-violet-200' : 'text-gray-300 hover:text-white'}`}>登录记录</button>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索身份、IP、地区、浏览器或系统"
              className="w-full rounded-md border border-white/10 bg-black/20 py-1.5 pl-7 pr-2 text-[11px] text-gray-100 caret-violet-300 outline-none placeholder:text-gray-400 focus:border-violet-400/60"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 custom-scrollbar sm:p-3">
          {loading && data.profiles.length === 0 ? (
            <div className="flex h-48 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Fingerprint className="h-8 w-8 text-red-400/60" />
              <p className="text-xs text-red-300">{error}</p>
              <button onClick={() => loadAudit()} className="text-[10px] text-gray-300 underline hover:text-white">重新加载</button>
            </div>
          ) : view === 'profiles' ? (
            filteredProfiles.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-gray-400">暂无匹配的登录画像</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filteredProfiles.map(profile => (
                  <article key={profile.locationKey} className="min-w-0 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-violet-500/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex max-w-full items-center gap-1.5 text-xs font-semibold text-cyan-300">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{profile.locationLabel}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {profile.roles.map(role => (
                            <span key={role} className={`rounded px-1.5 py-0.5 text-[9px] ${role === 'super' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{roleLabel(role)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold text-white">{profile.loginCount}</div>
                        <div className="text-[9px] text-gray-400">次登录</div>
                      </div>
                    </div>

                    {editingLocation === profile.locationKey ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md border border-violet-500/20 bg-violet-500/[0.06] p-1.5">
                        <UserRound className="ml-1 h-3.5 w-3.5 shrink-0 text-violet-300" />
                        <input
                          autoFocus
                          value={claimDraft}
                          maxLength={40}
                          onChange={event => setClaimDraft(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') saveClaim(profile)
                            if (event.key === 'Escape') setEditingLocation(null)
                          }}
                          placeholder="输入身份，如 CHanGO"
                          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[11px] text-white caret-violet-300 outline-none placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => saveClaim(profile)}
                          disabled={claimSaving || !claimDraft.trim()}
                          title="保存身份"
                          className="rounded p-1.5 text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-30"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        {profile.identityName && (
                          <button
                            onClick={() => saveClaim(profile, '')}
                            disabled={claimSaving}
                            title="取消认领"
                            className="rounded p-1.5 text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingLocation(null)}
                          disabled={claimSaving}
                          title="取消编辑"
                          className="rounded p-1.5 text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {profile.identityName ? (
                          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2 py-1 text-[10px] font-medium text-amber-200">
                            <UserRound className="h-3 w-3 shrink-0" />
                            <span className="truncate">{profile.identityName}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-gray-300">身份未认领</span>
                        )}
                        <button
                          onClick={() => editClaim(profile)}
                          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[9px] text-gray-300 transition-colors hover:bg-violet-500/10 hover:text-violet-200"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {profile.identityName ? '修改' : '认领身份'}
                        </button>
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5 text-[10px] text-gray-300">
                      <div className="flex items-start gap-1.5">
                        <Globe2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {profile.ipAddresses.slice(0, 6).map(ip => (
                            <button
                              key={ip}
                              onClick={() => copyIp(ip)}
                              title="复制 IP"
                              className="group flex max-w-full items-center gap-1 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                            >
                              <span className="truncate">{ip}</span>
                              <Copy className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                            </button>
                          ))}
                          {profile.ipAddresses.length > 6 && (
                            <span className="px-1 py-0.5 font-mono text-[9px] text-gray-400">+{profile.ipAddresses.length - 6}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-1.5"><Laptop className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" /><span className="min-w-0 break-words">{[...profile.browsers, ...profile.operatingSystems, ...profile.deviceTypes.map(deviceLabel)].join(' · ') || '设备未知'}</span></div>
                      <div className="flex items-center gap-1.5"><Clock3 className="h-3 w-3 shrink-0 text-violet-400" /><span>首次 {formatTime(profile.firstSeen)} · 最近 {formatTime(profile.lastSeen)}</span></div>
                    </div>

                    {profile.lastUserAgent && <p title={profile.lastUserAgent} className="mt-2 whitespace-normal break-all border-t border-white/10 pt-2 font-mono text-[9px] leading-relaxed text-gray-400">{profile.lastUserAgent}</p>}
                  </article>
                ))}
              </div>
            )
          ) : filteredEvents.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-gray-400">暂无匹配的登录记录</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/5">
              {filteredEvents.map((event, index) => (
                <div key={event.id} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 ${index > 0 ? 'border-t border-white/5' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-medium text-cyan-300">{event.ip_address || '未知 IP'}</span>
                      <span className={`rounded px-1 py-0.5 text-[8px] ${event.role === 'super' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{roleLabel(event.role)}</span>
                      {event.identityName && <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[8px] text-violet-300">{event.identityName}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-300">
                      <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{adminLoginLocationLabel(event)}</span>
                      <span className="flex items-center gap-1">{event.device_type === 'mobile' ? <Smartphone className="h-2.5 w-2.5" /> : <Laptop className="h-2.5 w-2.5" />}{event.browser || '未知'} · {event.operating_system || '未知'}</span>
                    </div>
                  </div>
                  <time className="shrink-0 font-mono text-[9px] text-gray-400">{formatTime(event.logged_in_at)}</time>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
