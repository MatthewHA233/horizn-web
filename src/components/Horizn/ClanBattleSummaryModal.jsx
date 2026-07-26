'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, Clipboard, Download, ListChecks, RefreshCw, Trophy, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { mapName } from '@/lib/mapNames'

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

function clampTopN(value) {
  return Math.min(100, Math.max(1, Math.round(Number(value) || 1)))
}

function downloadCsv(rows, selectedCount, topN) {
  const header = ['排名', '玩家名', '命中次数', `命中率(共${selectedCount}场)`, '命中场次(编号)']
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
  anchor.download = `联队战命中统计_前${topN}名_${selectedCount}场.csv`
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
      setSelected(new Set(nextData.sessions.filter(session => session.playerCount > 0).map(session => session.id)))
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
        current.sessionNos.push(session.number)
        current.name = player.name
        counts.set(player.playerId, current)
      }
    }
    const rows = Array.from(counts.values()).sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))
    return { rows, selectedCount: selectedSessions.length }
  }, [data, selected, topN])

  const toggleSession = session => {
    if (session.playerCount === 0) return
    setSelected(current => {
      const next = new Set(current)
      if (next.has(session.id)) next.delete(session.id)
      else next.add(session.id)
      return next
    })
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
          <button onClick={() => setSelected(new Set(dataSessions.map(session => session.id)))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-100 hover:border-cyan-300/50">全选</button>
          <button onClick={() => setSelected(new Set())} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-100 hover:border-cyan-300/50">清空</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {data.sessions.map(session => {
          const enabled = session.playerCount > 0
          const active = selected.has(session.id)
          return (
            <button
              key={session.id}
              onClick={() => toggleSession(session)}
              disabled={!enabled}
              className={`grid w-full grid-cols-[20px_34px_minmax(0,1fr)] items-start gap-1.5 border-b border-white/[0.07] px-3 py-2 text-left transition-colors ${active ? 'bg-cyan-400/10' : 'hover:bg-white/[0.04]'} disabled:cursor-not-allowed disabled:opacity-35`}
            >
              <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${active ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-white/25'}`}>{active && <Check className="h-3 w-3" />}</span>
              <span className={`pt-0.5 text-right font-mono text-[10px] ${active ? 'font-semibold text-cyan-200' : 'text-gray-300'}`}>#{session.number}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap gap-x-1.5 text-[10px] text-gray-100">
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
        <span>排名</span><span>玩家</span><span className="text-center">命中</span><span className="text-right">命中率</span><span className="hidden sm:block">命中场次</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {stats.selectedCount === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-gray-300">请先选择场次</div>
        ) : stats.rows.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-gray-300">所选场次暂无命中数据</div>
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
                {row.sessionNos.map(number => <span key={number} className="rounded border border-white/15 px-1 font-mono text-[9px] text-gray-200">{number}</span>)}
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
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 className="h-4 w-4 text-cyan-300" />联队战前 N 名汇总</div>
            <p className="mt-0.5 text-[10px] text-gray-300">{monthLabel} · 统计进入各场贡献前 N 名的次数</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => loadSummary()} disabled={loading} className="rounded p-1.5 text-gray-200 hover:bg-white/10 disabled:opacity-40" title="刷新"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={onClose} className="rounded p-1.5 text-gray-200 hover:bg-white/10" aria-label="关闭"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-100">
            <span>命中前</span>
            <input type="number" min="1" max="100" value={topN} onChange={event => setTopN(clampTopN(event.target.value))} className="h-7 w-14 rounded border border-cyan-300/50 bg-black/30 px-1 text-center font-mono text-xs font-semibold text-cyan-200 outline-none" />
            <span>名</span>
          </div>
          <div className="flex gap-1">
            {[10, 15, 20, 30].map(value => <button key={value} onClick={() => setTopN(value)} className={`rounded border px-2 py-1 text-[10px] ${topN === value ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-gray-200 hover:border-white/30'}`}>前{value}</button>)}
          </div>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-200"><b className="font-mono text-cyan-200">{stats.selectedCount}</b> 场 · <b className="font-mono text-cyan-200">{stats.rows.length}</b> 人上榜</span>
          <button onClick={copyWeights} disabled={!stats.rows.length} className="flex items-center gap-1 rounded border border-cyan-300/40 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-35"><Clipboard className="h-3 w-3" />复制权重</button>
          <button onClick={() => downloadCsv(stats.rows, stats.selectedCount, topN)} disabled={!stats.rows.length} className="flex items-center gap-1 rounded border border-emerald-300/40 px-2 py-1 text-[10px] text-emerald-200 disabled:opacity-35"><Download className="h-3 w-3" />CSV</button>
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
