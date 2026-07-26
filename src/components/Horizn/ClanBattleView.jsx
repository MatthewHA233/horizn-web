'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Map as MapIcon, Swords, Trophy, X } from 'lucide-react'
import { mapName } from '@/lib/mapNames'

const RANKING_LIMIT = 30
const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Hong_Kong',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})
const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Hong_Kong',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function asUtcDate(value) {
  if (!value) return new Date(0)
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

function dateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(asUtcDate(value))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function sessionStatus(session) {
  const now = Date.now()
  const start = asUtcDate(session.startTime).getTime()
  const end = asUtcDate(session.endTime).getTime()
  if (now < start) return { label: '未开始', color: 'text-gray-300', dot: 'bg-gray-400' }
  if (now <= end) return { label: '进行中', color: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' }
  return { label: '已结束', color: 'text-cyan-300', dot: 'bg-cyan-300' }
}

function chooseSession(sessions) {
  const now = Date.now()
  return sessions.find(session => {
    const start = asUtcDate(session.startTime).getTime()
    const end = asUtcDate(session.endTime).getTime()
    return start <= now && now <= end
  })
    || [...sessions].reverse().find(session => asUtcDate(session.endTime).getTime() < now)
    || sessions[0]
    || null
}

function splitName(name) {
  const match = (name || '').match(/^地平线『No\.(\d+)』(.+)$/)
  return match ? { hull: match[1], name: match[2] } : { hull: null, name: name || '-' }
}

function RankingSkeleton({ rows = 12 }) {
  return (
    <div className="divide-y divide-white/[0.04]" aria-label="排名加载中">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid animate-pulse grid-cols-[32px_minmax(0,1fr)_72px] items-center gap-2 px-3 py-3 sm:grid-cols-[42px_minmax(0,1fr)_110px] sm:px-4">
          <div className="mx-auto h-2.5 w-4 rounded bg-white/[0.06]" />
          <div className="h-2.5 rounded bg-white/[0.06]" style={{ width: `${48 + (index % 4) * 9}%` }} />
          <div className="ml-auto h-2.5 w-14 rounded bg-cyan-400/[0.08]" />
        </div>
      ))}
    </div>
  )
}

function ClanBattleSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="联队战数据加载中">
      <div className="flex animate-pulse items-center gap-2 rounded-xl border border-white/5 bg-[#090e17]/90 p-2">
        <div className="h-9 w-9 rounded-lg bg-white/[0.05]" />
        <div className="h-9 min-w-0 flex-1 rounded-lg bg-white/[0.05]" />
        <div className="h-3 w-7 rounded bg-white/[0.05]" />
        <div className="h-9 w-9 rounded-lg bg-white/[0.05]" />
      </div>
      <section className="overflow-hidden rounded-xl border border-white/5 bg-[#0b1019]/80">
        <div className="animate-pulse border-b border-white/5 px-4 py-3">
          <div className="h-3 w-28 rounded bg-white/[0.07]" />
          <div className="mt-2 h-2 w-52 max-w-full rounded bg-white/[0.05]" />
        </div>
        <RankingSkeleton />
      </section>
    </div>
  )
}

export default function ClanBattleView({ yearMonth }) {
  const activeSessionRef = useRef(null)
  const pickerRef = useRef(null)
  const [sessions, setSessions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [ranking, setRanking] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async (signal) => {
    setLoadingSessions(true)
    setError('')
    try {
      const response = await fetch(`/api/horizn/clan-battle?yearMonth=${yearMonth}`, {
        cache: 'no-store',
        signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '场次读取失败')
      const nextSessions = result.sessions || []
      const initial = chooseSession(nextSessions)
      setSessions(nextSessions)
      setSelectedId(initial?.id || null)
      setShowSessionPicker(false)
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || '场次读取失败')
    } finally {
      if (!signal?.aborted) setLoadingSessions(false)
    }
  }, [yearMonth])

  useEffect(() => {
    const controller = new AbortController()
    loadSessions(controller.signal)
    return () => controller.abort()
  }, [loadSessions])

  useEffect(() => {
    if (!selectedId) {
      setRanking([])
      return undefined
    }

    const controller = new AbortController()
    setLoadingRanking(true)
    setError('')
    fetch(`/api/horizn/clan-battle?yearMonth=${yearMonth}&sessionId=${encodeURIComponent(selectedId)}&top=${RANKING_LIMIT}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || '排名读取失败')
        setRanking(result.ranking || [])
      })
      .catch(loadError => {
        if (loadError.name !== 'AbortError') setError(loadError.message || '排名读取失败')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRanking(false)
      })
    return () => controller.abort()
  }, [selectedId, yearMonth])

  useEffect(() => {
    if (!showSessionPicker) return undefined
    const frame = requestAnimationFrame(() => activeSessionRef.current?.scrollIntoView({ block: 'center' }))
    const closeOnOutsidePress = event => {
      if (!pickerRef.current?.contains(event.target)) setShowSessionPicker(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setShowSessionPicker(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showSessionPicker])

  const selectedSession = sessions.find(session => session.id === selectedId) || null
  const selectedIndex = sessions.findIndex(session => session.id === selectedId)
  const sessionGroups = useMemo(() => {
    const grouped = new Map()
    sessions.forEach((session, index) => {
      const key = dateKey(session.startTime)
      if (!grouped.has(key)) grouped.set(key, { key, label: DATE_FORMATTER.format(asUtcDate(session.startTime)), sessions: [] })
      grouped.get(key).sessions.push({ ...session, number: index + 1 })
    })
    return Array.from(grouped.values())
  }, [sessions])
  const visibleRanking = ranking.slice(0, RANKING_LIMIT)
  const maxGain = visibleRanking[0]?.gain || 0
  const monthLabel = `${yearMonth.slice(0, 4)}年${Number(yearMonth.slice(4, 6))}月`

  const moveSession = (offset) => {
    const next = sessions[selectedIndex + offset]
    if (next) setSelectedId(next.id)
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.10),transparent_38%)] custom-scrollbar">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-2 p-2 sm:gap-3 sm:p-4 lg:px-6">
        {loadingSessions ? (
          <ClanBattleSkeleton />
        ) : error && sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <Swords className="h-8 w-8 text-red-400/50" />
            <p className="text-xs text-red-300">{error}</p>
            <button onClick={() => loadSessions()} className="text-[10px] text-gray-300 underline hover:text-white">重新加载</button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <CalendarDays className="h-8 w-8 text-gray-400" />
            <p className="text-xs text-gray-300">{monthLabel} 暂无联队战场次</p>
          </div>
        ) : (
          <>
            <section ref={pickerRef} className="sticky top-0 z-20 flex items-center gap-1 rounded-xl border border-cyan-400/25 bg-[#090e17]/98 p-1 shadow-lg backdrop-blur-md sm:gap-2 sm:p-2">
              <button
                onClick={() => moveSession(-1)}
                disabled={selectedIndex <= 0}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
                aria-label="上一场"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowSessionPicker(value => !value)}
                className="grid min-h-9 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-left transition-colors hover:border-cyan-300/40 sm:min-h-11 sm:px-3 sm:py-1.5"
                aria-label="选择联队战场次"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5 text-[9px] leading-tight text-gray-300 sm:text-[11px]">
                    <span className="font-mono font-semibold text-cyan-200">#{String(selectedIndex + 1).padStart(2, '0')}/{sessions.length}</span>
                    {selectedSession && <span>{DATE_FORMATTER.format(asUtcDate(selectedSession.startTime))} · {TIME_FORMATTER.format(asUtcDate(selectedSession.startTime))}</span>}
                  </span>
                  {selectedSession && <span className="mt-0.5 block whitespace-normal break-all text-[11px] font-medium leading-tight text-white sm:text-sm">{mapName(selectedSession.mapId)}</span>}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-cyan-200 transition-transform ${showSessionPicker ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => moveSession(1)}
                disabled={selectedIndex < 0 || selectedIndex >= sessions.length - 1}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
                aria-label="下一场"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {showSessionPicker && (
                <section className="absolute left-1/2 top-[calc(100%+4px)] z-40 flex max-h-[calc(100dvh-6.5rem)] w-full -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-cyan-400/30 bg-[#080e17] shadow-[0_18px_60px_rgba(0,0,0,0.65)] sm:max-h-[72vh] sm:max-w-2xl">
                  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-2.5 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h2 className="shrink-0 text-[11px] font-semibold text-white sm:text-sm">选择场次</h2>
                      <p className="truncate text-[9px] text-gray-300 sm:text-[11px]">{monthLabel} · {sessions.length} 场</p>
                    </div>
                    <button onClick={() => setShowSessionPicker(false)} className="rounded-md p-1 text-gray-200 hover:bg-white/10 hover:text-white" aria-label="关闭">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto pb-1.5 custom-scrollbar sm:pb-2">
                    {sessionGroups.map(group => (
                      <div key={group.key} className="mb-1.5 last:mb-0 sm:mb-2">
                        <div className="border-b border-white/10 bg-[#111a26] px-2 py-1 text-[9px] font-semibold text-gray-100 sm:px-2.5 sm:text-[11px]">{group.label}</div>
                        <div className="grid gap-1 px-1.5 pt-1 sm:grid-cols-2 sm:gap-1.5 sm:px-2">
                          {group.sessions.map(session => {
                            const status = sessionStatus(session)
                            const active = session.id === selectedId
                            return (
                              <button
                                key={session.id}
                                ref={active ? activeSessionRef : null}
                                onClick={() => {
                                  setSelectedId(session.id)
                                  setShowSessionPicker(false)
                                }}
                                className={`grid min-h-10 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-colors sm:min-h-12 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:gap-2 sm:px-2 sm:py-1.5 ${active ? 'border-cyan-300 bg-cyan-400/15' : 'border-white/10 bg-white/[0.04] hover:border-cyan-300/40'}`}
                              >
                                <span className={`text-center font-mono text-[9px] font-semibold sm:text-[11px] ${active ? 'text-cyan-200' : 'text-gray-300'}`}>#{String(session.number).padStart(2, '0')}</span>
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] leading-tight sm:text-xs">
                                    <span className="font-mono font-semibold text-white">{TIME_FORMATTER.format(asUtcDate(session.startTime))}–{TIME_FORMATTER.format(asUtcDate(session.endTime))}</span>
                                    <span className={`flex items-center gap-1 text-[8px] sm:text-[10px] ${status.color}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span>
                                  </span>
                                  <span className="mt-0.5 block whitespace-normal break-all text-[10px] font-medium leading-tight text-gray-100 sm:text-xs">{mapName(session.mapId)}</span>
                                </span>
                                {active && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-200" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </section>

            {selectedSession && (
              <section className="min-h-0 overflow-hidden rounded-xl border border-white/5 bg-[#0b1019]/80">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-white sm:text-sm">
                      <Trophy className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
                      本场贡献前 {RANKING_LIMIT} 名
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-300 sm:text-[11px]">
                      <span className="flex items-center gap-1"><CalendarDays className="h-2.5 w-2.5" />{DATE_FORMATTER.format(asUtcDate(selectedSession.startTime))}</span>
                      <span className="flex items-center gap-1"><Clock3 className="h-2.5 w-2.5" />{TIME_FORMATTER.format(asUtcDate(selectedSession.startTime))}–{TIME_FORMATTER.format(asUtcDate(selectedSession.endTime))}</span>
                      <span className="flex items-center gap-1"><MapIcon className="h-2.5 w-2.5" />{mapName(selectedSession.mapId)}</span>
                    </div>
                  </div>
                  {(() => {
                    const status = sessionStatus(selectedSession)
                    return <div className={`flex items-center gap-1.5 text-[9px] sm:text-[11px] ${status.color}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</div>
                  })()}
                </div>

                {loadingRanking ? (
                  <RankingSkeleton />
                ) : error ? (
                  <div className="py-20 text-center text-xs text-red-300">{error}</div>
                ) : visibleRanking.length === 0 ? (
                  <div className="py-20 text-center text-xs text-gray-300">本场暂无排行榜采样，可能尚未开始</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {visibleRanking.map(player => {
                      const pct = maxGain > 0 ? Math.max(3, (player.gain / maxGain) * 100) : 0
                      const parsed = splitName(player.name)
                      const isTop3 = player.rank <= 3
                      return (
                        <div key={player.playerId} className="relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden px-3 py-2 sm:grid-cols-[52px_minmax(0,1fr)_140px] sm:gap-3 sm:px-5 sm:py-3">
                          <div className="absolute inset-y-1 left-0 bg-gradient-to-r from-cyan-400/[0.10] to-transparent" style={{ width: `${pct}%` }} />
                          <span className={`relative text-center font-mono text-[11px] sm:text-xs ${isTop3 ? 'font-semibold text-cyan-300' : 'text-gray-400'}`}>{String(player.rank).padStart(2, '0')}</span>
                          <div className="relative flex min-w-0 items-baseline gap-1.5">
                            {parsed.hull && <span className="shrink-0 font-mono text-[9px] font-semibold text-amber-400/80 sm:text-[11px]">No.{parsed.hull}</span>}
                            <span className="truncate text-[11px] text-gray-200 sm:text-sm" title={player.name}>{parsed.name}</span>
                          </div>
                          <span className={`relative text-right font-mono text-xs font-semibold tabular-nums sm:text-sm ${isTop3 ? 'text-cyan-300' : 'text-gray-400'}`}>+{player.gain.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

          </>
        )}
      </div>
    </div>
  )
}
