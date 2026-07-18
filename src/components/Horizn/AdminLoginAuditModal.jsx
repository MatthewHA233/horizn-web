import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  Copy,
  Fingerprint,
  Globe2,
  Laptop,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_DATA = {
  summary: { totalLogins: 0, uniqueIps: 0, superLogins: 0, retentionDays: 180 },
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

function locationLabel(row) {
  return [row.city, row.region, row.country_code].filter(Boolean).join(' · ') || '位置未知'
}

export default function AdminLoginAuditModal({ show, onClose, isMobile }) {
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('profiles')

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
      profile.ipAddress,
      ...profile.locations,
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

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className={`flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-violet-500/20 bg-[#0c0e15]/95 shadow-2xl ${isMobile ? 'h-[92dvh]' : 'max-h-[88vh]'}`}>
        <div className="h-0.5 shrink-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-amber-400" />

        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Fingerprint className="h-4 w-4 text-violet-400" />
              管理员登录画像
              <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
                仅超级管理员
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">成功登录记录 · 自动保留 {data.summary.retentionDays} 天</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadAudit()}
              disabled={loading}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-white/5 px-4 py-3">
          {[
            { label: '成功登录', value: data.summary.totalLogins, icon: ShieldCheck, color: 'text-cyan-400' },
            { label: '独立 IP', value: data.summary.uniqueIps, icon: Globe2, color: 'text-violet-400' },
            { label: '超级登录', value: data.summary.superLogins, icon: Fingerprint, color: 'text-amber-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Icon className={`h-3 w-3 ${color}`} />{label}</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-gray-100">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <div className="flex rounded-md border border-white/5 bg-black/20 p-0.5 text-[10px]">
            <button onClick={() => setView('profiles')} className={`rounded px-2 py-1 transition-colors ${view === 'profiles' ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}>IP 画像</button>
            <button onClick={() => setView('events')} className={`rounded px-2 py-1 transition-colors ${view === 'events' ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}>登录流水</button>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索 IP、地区、浏览器或系统"
              className="w-full rounded-md border border-white/5 bg-black/20 py-1.5 pl-7 pr-2 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-violet-500/40"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
          {loading && data.profiles.length === 0 ? (
            <div className="flex h-48 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
          ) : error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Fingerprint className="h-8 w-8 text-red-400/60" />
              <p className="text-xs text-red-300">{error}</p>
              <button onClick={() => loadAudit()} className="text-[10px] text-gray-500 underline hover:text-white">重新加载</button>
            </div>
          ) : view === 'profiles' ? (
            filteredProfiles.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-gray-600">暂无匹配的登录画像</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filteredProfiles.map(profile => (
                  <article key={profile.ipAddress} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-violet-500/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button onClick={() => copyIp(profile.ipAddress)} className="group flex max-w-full items-center gap-1.5 font-mono text-xs font-semibold text-cyan-300">
                          <span className="truncate">{profile.ipAddress}</span>
                          <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {profile.roles.map(role => (
                            <span key={role} className={`rounded px-1.5 py-0.5 text-[9px] ${role === 'super' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{roleLabel(role)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold text-white">{profile.loginCount}</div>
                        <div className="text-[9px] text-gray-600">次登录</div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-[10px] text-gray-400">
                      <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /><span>{profile.locations.join(' / ') || '位置未知'}</span></div>
                      <div className="flex items-start gap-1.5"><Laptop className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" /><span>{[...profile.browsers, ...profile.operatingSystems, ...profile.deviceTypes.map(deviceLabel)].join(' · ') || '设备未知'}</span></div>
                      <div className="flex items-center gap-1.5"><Clock3 className="h-3 w-3 shrink-0 text-violet-400" /><span>首次 {formatTime(profile.firstSeen)} · 最近 {formatTime(profile.lastSeen)}</span></div>
                    </div>

                    {profile.lastUserAgent && <p title={profile.lastUserAgent} className="mt-2 truncate border-t border-white/5 pt-2 font-mono text-[9px] text-gray-700">{profile.lastUserAgent}</p>}
                  </article>
                ))}
              </div>
            )
          ) : filteredEvents.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-gray-600">暂无匹配的登录流水</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/5">
              {filteredEvents.map((event, index) => (
                <div key={event.id} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 ${index > 0 ? 'border-t border-white/5' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-medium text-cyan-300">{event.ip_address || '未知 IP'}</span>
                      <span className={`rounded px-1 py-0.5 text-[8px] ${event.role === 'super' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{roleLabel(event.role)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{locationLabel(event)}</span>
                      <span className="flex items-center gap-1">{event.device_type === 'mobile' ? <Smartphone className="h-2.5 w-2.5" /> : <Laptop className="h-2.5 w-2.5" />}{event.browser || '未知'} · {event.operating_system || '未知'}</span>
                    </div>
                  </div>
                  <time className="shrink-0 font-mono text-[9px] text-gray-600">{formatTime(event.logged_in_at)}</time>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
