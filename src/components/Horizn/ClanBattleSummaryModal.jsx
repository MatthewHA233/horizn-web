'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, Clipboard, Download, ListChecks, RefreshCw, Trophy, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { mapName } from '@/lib/mapNames'
import ClanMapArtwork from './ClanMapArtwork'

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
const UTC_DAY_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'UTC',
  month: 'numeric',
  day: 'numeric',
})

function asUtcDate(value) {
  if (!value) return new Date(0)
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

function clampTopN(value) {
  return Math.min(100, Math.max(1, Math.round(Number(value) || 1)))
}

function utcWeekStart(value) {
  const date = asUtcDate(value)
  const daysAfterMonday = (date.getUTCDay() + 6) % 7
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysAfterMonday)
}

function adjacentMonthLabel(session, yearMonth) {
  if (!session.yearMonth || session.yearMonth === yearMonth) return ''
  return session.yearMonth < yearMonth ? '上月' : '下月'
}

function sessionNumberLabel(session, yearMonth) {
  const adjacentLabel = adjacentMonthLabel(session, yearMonth)
  return adjacentLabel ? `${adjacentLabel[0]}${session.number}` : String(session.number)
}

function downloadCsv(rows, selectedCount, topN) {
  const header = ['排名', '玩家名', '入围次数', `入围率(共${selectedCount}场)`, '入围场次(编号)']
  const body = rows.map((row, index) => [
    index + 1,
    row.name,
    row.hits,
    selectedCount ? `${((row.hits / selectedCount) * 100).toFixed(1)}%` : '0%',
    row.sessionNos.join(' '),
  ])
  const escapeCell = cell => {
    const text = String(cell)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const csv = [header, ...body].map(row => row.map(escapeCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `联队战入围统计_前${topN}名_${selectedCount}场.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function LoadingRows() {
  return (
    <div className="space-y-1.5 p-3" aria-label="联队战汇总加载中">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="grid animate-pulse grid-cols-[32px_1fr_48px] gap-2 rounded-lg border border-white/5 px-3 py-2.5">
          <div className="h-3 rounded bg-white/10" />
          <div className="h-3 rounded bg-white/10" style={{ width: `${55 + (index % 4) * 10}%` }} />
          <div className="h-3 rounded bg-cyan-400/10" />
        </div>
      ))}
    </div>
  )
}

export default function ClanBattleSummaryModal({ show, onClose, isMobile, yearMonth }) {
  const [data, setData] = useState({ sessions: [], rankings: {} })
  const [selected, setSelected] = useState(new Set())
  const [topN, setTopN] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileView, setMobileView] = useState('summary')

  const loadSummary = useCallback(async signal => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/horizn/clan-battle?mode=summary&yearMonth=${yearMonth}`, {
        cache: 'no-store',
        signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '联队战汇总读取失败')
      const nextData = { sessions: result.sessions || [], rankings: result.rankings || {} }
      setData(nextData)
      setSelected(new Set(
        nextData.sessions
          .filter(session => session.playerCount > 0 && (!session.yearMonth || session.yearMonth === yearMonth))
          .map(session => session.id),
      ))
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || '联队战汇总读取失败')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    if (!show) return undefined
    const controller = new AbortController()
    setMobileView('summary')
    loadSummary(controller.signal)
    return () => controller.abort()
  }, [show, loadSummary])

  const dataSessions = useMemo(
    () => data.sessions.filter(session => session.playerCount > 0),
    [data.sessions],
  )

  const monthDataSessions = useMemo(
    () => dataSessions.filter(session => !session.yearMonth || session.yearMonth === yearMonth),
    [dataSessions, yearMonth],
  )

  const weekGroups = useMemo(() => {
    const groups = new Map()
    for (const session of dataSessions) {
      const weekStart = utcWeekStart(session.startTime)
      const current = groups.get(weekStart) || { weekStart, sessionIds: [], crossesMonth: false }
      current.sessionIds.push(session.id)
      current.crossesMonth ||= Boolean(adjacentMonthLabel(session, yearMonth))
      groups.set(weekStart, current)
    }
    return Array.from(groups.values())
      .sort((a, b) => a.weekStart - b.weekStart)
      .map((group, index) => ({
        ...group,
        weekNumber: index + 1,
        weekEnd: group.weekStart + 6 * 24 * 60 * 60 * 1000,
      }))
  }, [dataSessions, yearMonth])

  const stats = useMemo(() => {
    const counts = new Map()
    const selectedSessions = data.sessions.filter(session => selected.has(session.id))
    for (const session of selectedSessions) {
      for (const player of (data.rankings[session.id] || []).slice(0, topN)) {
        const current = counts.get(player.playerId) || {
          playerId: player.playerId,
          name: player.name,
          hits: 0,
          sessionNos: [],
        }
        current.hits += 1
        current.sessionNos.push(sessionNumberLabel(session, yearMonth))
        current.name = player.name
        counts.set(player.playerId, current)
      }
    }
    const rows = Array.from(counts.values()).sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))
    return { rows, selectedCount: selectedSessions.length }
  }, [data, selected, topN, yearMonth])

  const toggleSession = session => {
    if (session.playerCount === 0) return
    setSelected(current => {
      const next = new Set(current)
      if (next.has(session.id)) next.delete(session.id)
      else next.add(session.id)
      return next
    })
  }

  const selectWeek = week => {
    setSelected(new Set(week.sessionIds))
  }

  const copyWeights = async () => {
    const text = stats.rows.map(row => `${row.name},${row.hits}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('名字与权重已复制', { duration: 1500 })
    } catch {
      toast.error('复制失败')
    }
  }

  // 只复制名字：每行一个名字，不含权重（入围次数）
  const copyNames = async () => {
    const text = stats.rows.map(row => row.name).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('名字已复制', { duration: 1500 })
    } catch {
      toast.error('复制失败')
    }
  }

  if (!show) return null

  const maxHits = stats.rows[0]?.hits || 0
  const monthLabel = `${yearMonth.slice(0, 4)}年${Number(yearMonth.slice(4, 6))}月`

  const sessionList = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-[11px] font-medium text-white">
          场次选择 <span className="font-mono text-cyan-200">{stats.selectedCount}</span><span className="text-gray-300">/{dataSessions.length}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setSelected(new Set(monthDataSessions.map(session => session.id)))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-100 hover:border-cyan-300/50">本月</button>
          <button onClick={() => setSelected(new Set(dataSessions.map(session => session.id)))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-100 hover:border-cyan-300/50">全部</button>
          <button onClick={() => setSelected(new Set())} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-100 hover:border-cyan-300/50">清空</button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-black/10 px-3 py-1.5">
        <span className="flex w-8 shrink-0 flex-col text-center leading-tight">
          <span className="text-[9px] font-medium text-gray-200">只选周</span>
          <span className="font-mono text-[8px] text-gray-400">UTC+0</span>
        </span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {weekGroups.map(week => {
            const selectedInWeek = week.sessionIds.filter(id => selected.has(id)).length
            const includesWholeWeek = week.sessionIds.length > 0 && selectedInWeek === week.sessionIds.length
            const isOnlyWeek = includesWholeWeek && stats.selectedCount === week.sessionIds.length
            const isPartial = selectedInWeek > 0 && !includesWholeWeek
            const weekRange = `${UTC_DAY_FORMATTER.format(new Date(week.weekStart))}–${UTC_DAY_FORMATTER.format(new Date(week.weekEnd))}`
            return (
              <button
                key={week.weekStart}
                onClick={() => selectWeek(week)}
                disabled={week.sessionIds.length === 0}
                aria-pressed={isOnlyWeek}
                title={`只选择第${week.weekNumber}周（UTC+0 ${weekRange}，${week.sessionIds.length}场${week.crossesMonth ? '，含相邻月份' : ''}）`}
                className={`relative flex h-8 min-w-[48px] shrink-0 flex-col items-center justify-center rounded border px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  isOnlyWeek
                    ? 'border-cyan-200 bg-cyan-300/20 text-cyan-50'
                    : includesWholeWeek
                      ? 'border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-200'
                      : isPartial
                        ? 'border-amber-300/35 bg-amber-300/[0.06] text-amber-200'
                        : 'border-white/15 text-gray-300 hover:border-cyan-300/45 hover:text-white'
                }`}
              >
                {week.crossesMonth && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-amber-300" aria-label="包含相邻月份" />}
                <span className="text-[10px] font-medium leading-none">第{week.weekNumber}周</span>
                <span className="mt-0.5 font-mono text-[8px] leading-none opacity-75">{selectedInWeek}/{week.sessionIds.length}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {data.sessions.map(session => {
          const enabled = session.playerCount > 0
          const active = selected.has(session.id)
          const adjacentLabel = adjacentMonthLabel(session, yearMonth)
          return (
            <button
              key={session.id}
              onClick={() => toggleSession(session)}
              disabled={!enabled}
              className={`group relative isolate grid w-full grid-cols-[20px_34px_minmax(0,1fr)] items-start gap-1.5 overflow-hidden border-b border-white/[0.07] px-3 py-2 text-left transition-colors ${active ? 'bg-cyan-400/10' : 'hover:bg-white/[0.04]'} disabled:cursor-not-allowed disabled:opacity-35`}
            >
              <ClanMapArtwork mapId={session.mapId} variant="row" />
              <span className={`relative z-10 mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${active ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-white/25'}`}>{active && <Check className="h-3 w-3" />}</span>
              <span className={`relative z-10 pt-0.5 text-right font-mono text-[10px] ${active ? 'font-semibold text-cyan-200' : 'text-gray-300'}`}>#{session.number}</span>
              <span className="relative z-10 min-w-0">
                <span className="flex flex-wrap gap-x-1.5 text-[10px] text-gray-100">
                  {adjacentLabel && <span className="rounded border border-amber-300/30 bg-amber-300/[0.08] px-1 text-[8px] text-amber-200">{adjacentLabel}</span>}
                  <span>{DATE_FORMATTER.format(asUtcDate(session.startTime))}</span>
                  <span className="font-mono font-semibold text-white">{TIME_FORMATTER.format(asUtcDate(session.startTime))}</span>
                </span>
                <span className="mt-0.5 block break-all text-[10px] text-gray-200">{mapName(session.mapId)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const summaryTable = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-[34px_minmax(0,1fr)_52px_58px] gap-2 border-b border-white/10 bg-[#111824] px-3 py-2 text-[9px] font-medium text-gray-200 sm:grid-cols-[44px_minmax(160px,1fr)_64px_90px_minmax(150px,1fr)] sm:text-[10px]">
        <span>排名</span><span>玩家</span><span className="text-center">入围</span><span className="text-right">入围率</span><span className="hidden sm:block">入围场次</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {stats.selectedCount === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-gray-300">请先选择场次</div>
        ) : stats.rows.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-gray-300">所选场次暂无入围数据</div>
        ) : stats.rows.map((row, index) => {
          const rate = stats.selectedCount ? (row.hits / stats.selectedCount) * 100 : 0
          const width = maxHits ? (row.hits / maxHits) * 100 : 0
          return (
            <div key={row.playerId} className="relative grid min-h-10 grid-cols-[34px_minmax(0,1fr)_52px_58px] items-center gap-2 overflow-hidden border-b border-white/[0.06] px-3 py-1.5 sm:grid-cols-[44px_minmax(160px,1fr)_64px_90px_minmax(150px,1fr)] sm:py-2">
              <div className="absolute inset-y-1 left-0 bg-gradient-to-r from-cyan-400/10 to-transparent" style={{ width: `${width}%` }} />
              <span className={`relative font-mono text-[10px] sm:text-xs ${index < 3 ? 'font-semibold text-cyan-200' : 'text-gray-300'}`}>{index + 1}</span>
              <span className="relative min-w-0 truncate text-[11px] text-white sm:text-xs" title={row.name}>{row.name}</span>
              <span className="relative text-center font-mono text-xs font-bold text-cyan-200 sm:text-sm">{row.hits}</span>
              <span className="relative text-right font-mono text-[10px] text-gray-100 sm:text-xs">{rate.toFixed(0)}%</span>
              <span className="relative hidden flex-wrap gap-1 overflow-hidden sm:flex">
                {row.sessionNos.map((number, numberIndex) => <span key={`${number}-${numberIndex}`} className="rounded border border-white/15 px-1 font-mono text-[9px] text-gray-200">{number}</span>)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-2 sm:p-4">
      <section className={`flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-cyan-400/25 bg-[#090e17] shadow-2xl ${isMobile ? 'h-[96dvh]' : 'h-[88vh]'}`}>
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 className="h-4 w-4 shrink-0 text-cyan-300" /><span className="truncate">联队战前 N 名汇总</span></div>
            <p className="mt-0.5 truncate text-[10px] text-gray-300">{monthLabel} · 统计进入各场贡献前 N 名的次数</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => loadSummary()} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded text-gray-200 hover:bg-white/10 disabled:opacity-40 sm:h-auto sm:w-auto sm:p-1.5" title="刷新"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded text-gray-200 hover:bg-white/10 sm:h-auto sm:w-auto sm:p-1.5" aria-label="关闭"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="grid shrink-0 gap-2 border-b border-white/10 px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-100">
              <span>入围前</span>
              <input type="number" min="1" max="100" value={topN} onChange={event => setTopN(clampTopN(event.target.value))} className="h-7 w-14 rounded border border-cyan-300/50 bg-black/30 px-1 text-center font-mono text-xs font-semibold text-cyan-200 outline-none" />
              <span>名</span>
            </div>
            <div className="flex gap-1">
              {[10, 15, 20, 30].map(value => <button key={value} onClick={() => setTopN(value)} className={`h-7 rounded border px-2 text-[10px] ${topN === value ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-gray-200 hover:border-white/30'}`}>前{value}</button>)}
            </div>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 sm:ml-auto">
            <span className="whitespace-nowrap text-[10px] text-gray-200"><b className="font-mono text-cyan-200">{stats.selectedCount}</b> 场 · <b className="font-mono text-cyan-200">{stats.rows.length}</b> 人上榜</span>
            <div className="flex shrink-0 gap-1">
              <button onClick={copyNames} disabled={!stats.rows.length} className="flex h-7 items-center gap-1 rounded border border-cyan-300/40 px-2 text-[10px] text-cyan-100 disabled:opacity-35"><Clipboard className="h-3 w-3" />名字</button>
              <button onClick={copyWeights} disabled={!stats.rows.length} className="flex h-7 items-center gap-1 rounded border border-cyan-300/40 px-2 text-[10px] text-cyan-100 disabled:opacity-35"><Clipboard className="h-3 w-3" />名字权重</button>
              <button onClick={() => downloadCsv(stats.rows, stats.selectedCount, topN)} disabled={!stats.rows.length} className="flex h-7 items-center gap-1 rounded border border-emerald-300/40 px-2 text-[10px] text-emerald-200 disabled:opacity-35"><Download className="h-3 w-3" />CSV</button>
            </div>
          </div>
        </div>

        {isMobile && (
          <div className="grid shrink-0 grid-cols-2 border-b border-white/10 p-1">
            <button onClick={() => setMobileView('summary')} className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-[11px] ${mobileView === 'summary' ? 'bg-cyan-400/15 text-cyan-100' : 'text-gray-200'}`}><Trophy className="h-3.5 w-3.5" />汇总结果</button>
            <button onClick={() => setMobileView('sessions')} className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-[11px] ${mobileView === 'sessions' ? 'bg-cyan-400/15 text-cyan-100' : 'text-gray-200'}`}><ListChecks className="h-3.5 w-3.5" />选择场次</button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {loading && data.sessions.length === 0 ? <LoadingRows /> : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><p className="text-xs text-red-300">{error}</p><button onClick={() => loadSummary()} className="text-[10px] text-gray-200 underline">重新加载</button></div>
          ) : isMobile ? (mobileView === 'sessions' ? sessionList : summaryTable) : (
            <div className="grid h-full min-h-0 grid-cols-[290px_minmax(0,1fr)]"><aside className="min-h-0 border-r border-white/10">{sessionList}</aside><main className="min-h-0">{summaryTable}</main></div>
          )}
        </div>
      </section>
    </div>
  )
}
