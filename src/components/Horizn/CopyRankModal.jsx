import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCopyRankAdmins, getGroupRoster } from '@/services/horiznSupabase'
import CopyRankAdminSettings from './CopyRankAdminSettings'

// 剔除名单的标题（复制文本 / 表格 / 预览共用）
const EXCLUDED_ADMIN_LABEL = '已剔除管理'
const EXCLUDED_OUTER_LABEL = '已剔除非内群非审核群成员'

/**
 * 剔除开关；传 onSettings 时右侧内嵌一个齿轮设置按钮
 */
function ExcludeToggle({ active, onClick, title, children, onSettings, settingsOpen }) {
  const settingsTone = active
    ? `border-rose-400/60 hover:bg-rose-500 ${settingsOpen ? 'bg-rose-500' : ''}`
    : `border-gray-600 hover:text-white ${settingsOpen ? 'bg-gray-700/60 text-white' : ''}`
  return (
    <div
      className={`flex items-stretch rounded-md border text-[10px] font-medium overflow-hidden transition-all ${
        active ? 'bg-rose-600 border-rose-500 text-white' : 'border-gray-600 text-gray-400'
      }`}
    >
      <button
        onClick={onClick}
        title={title}
        className={`px-2 py-0.5 whitespace-nowrap ${active ? '' : 'hover:text-white'}`}
      >
        {children}
      </button>
      {onSettings && (
        <button
          onClick={onSettings}
          title="设置名单"
          aria-label="设置名单"
          className={`px-1 flex items-center border-l transition-colors ${settingsTone}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * 复制排名名单弹窗组件
 */
export default function CopyRankModal({
  show,
  onClose,
  isMobile,
  activeTab,
  setActiveTab,
  currentData,
  preloadedData,
  manualFrameIndex,
  setManualFrameIndex
}) {
  // 内部状态
  const [copyDataType, setCopyDataType] = useState(activeTab)
  const [copyShowValues, setCopyShowValues] = useState(true)
  const [copyShowNewMark, setCopyShowNewMark] = useState(true)
  const [copyShowId, setCopyShowId] = useState(true)
  const [copyShowIndex, setCopyShowIndex] = useState(true)
  const [copyCount, setCopyCount] = useState('20')
  const [copyMode, setCopyMode] = useState('rank')
  const [thresholdCompare, setThresholdCompare] = useState('gte')
  const [thresholdValue, setThresholdValue] = useState('')
  // 剔除群外成员（只保留在内群或审核群里的）：roster = { playerIds, unbound, reviewUnregistered }，每次打开弹窗重新拉取
  const [excludeOuter, setExcludeOuter] = useState(false)
  // 剔除管理，默认开启：admins = 云端管理名单（勾选的 excluded=true 才剔除），每次打开弹窗重新拉取
  const [excludeAdmins, setExcludeAdmins] = useState(true)
  const [admins, setAdmins] = useState(null)
  const [adminsError, setAdminsError] = useState(null)
  const [adminsReloadKey, setAdminsReloadKey] = useState(0)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const [roster, setRoster] = useState(null)
  const [rosterError, setRosterError] = useState(null)

  // refs
  const pressTimerRef = useRef(null)
  const intervalRef = useRef(null)
  const currentFrameRef = useRef(currentData?.currentFrameIndex ?? 0)

  // 同步 currentFrameRef
  useEffect(() => {
    if (currentData?.currentFrameIndex !== undefined) {
      currentFrameRef.current = currentData.currentFrameIndex
    }
  }, [currentData?.currentFrameIndex])

  // 根据当前 tab 和比较模式获取默认阈值
  const getDefaultThreshold = useCallback((compareMode = thresholdCompare) => {
    const dataType = copyDataType || activeTab
    if (compareMode === 'lte') {
      return dataType === 'weekly' ? '2500' : '7000'
    }
    return dataType === 'weekly' ? '4500' : '50000'
  }, [thresholdCompare, copyDataType, activeTab])

  // 根据当前 tab 获取阈值步进值
  const getThresholdStep = useCallback(() => {
    const dataType = copyDataType || activeTab
    return dataType === 'weekly' ? 100 : 1000
  }, [copyDataType, activeTab])

  // 初始化阈值
  useEffect(() => {
    if (show) {
      setCopyDataType(activeTab)
      setThresholdValue(getDefaultThreshold('gte'))
    }
  }, [show, activeTab])

  // 开启剔除群外时拉取内群 + 审核群在群名单
  useEffect(() => {
    if (!show || !excludeOuter || roster) return
    let cancelled = false
    setRosterError(null)
    getGroupRoster()
      .then(result => { if (!cancelled) setRoster(result) })
      .catch(err => { if (!cancelled) setRosterError(err.message || '群名单加载失败') })
    return () => { cancelled = true }
  }, [show, excludeOuter, roster])

  // 开启剔除管理或打开设置时拉取管理名单
  useEffect(() => {
    if (!show || admins || !(excludeAdmins || showAdminSettings)) return
    let cancelled = false
    setAdminsError(null)
    getCopyRankAdmins()
      .then(result => { if (!cancelled) setAdmins(result) })
      .catch(err => { if (!cancelled) setAdminsError(err.message || '管理名单加载失败') })
    return () => { cancelled = true }
  }, [show, admins, excludeAdmins, showAdminSettings, adminsReloadKey])

  // 清理定时器
  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 通用长按处理函数
  const handlePressStart = useCallback((e, action) => {
    handlePressEnd()
    action()
    e.preventDefault()
    pressTimerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(action, 80)
    }, 300)
    if (e.target && typeof e.target.setPointerCapture === 'function') {
      e.target.setPointerCapture(e.pointerId)
    }
  }, [handlePressEnd])

  // 获取复制名单使用的数据
  const getSelectedData = useCallback(() => {
    if (copyDataType === activeTab && currentData?.current) {
      return currentData.current
    }
    const targetData = preloadedData[copyDataType]
    if (!targetData?.timeline) return null
    const frameIndex = manualFrameIndex ?? (targetData.timeline.length - 1)
    const validIndex = Math.min(frameIndex, targetData.timeline.length - 1)
    return targetData.timeline[validIndex] || null
  }, [copyDataType, activeTab, currentData, preloadedData, manualFrameIndex])

  // 格式化时间戳（兼容 "MM-DD HH:MM" 和 "MM-DD 周X HH:MM"）
  const formatTimestamp = (timestamp) => {
    const now = new Date()
    const year = now.getFullYear()
    const match = timestamp.match(/(\d{2})-(\d{2})\s+(?:周.?\s+)?(\d{2}:\d{2})/)
    if (match) {
      const [, month, day, time] = match
      return `${year}年${parseInt(month)}月${parseInt(day)}日${time}`
    }
    return timestamp
  }

  // 格式化时间戳用于警告显示
  const formatTimestampShort = (timestamp) => {
    const match = timestamp.match(/(\d{2})-(\d{2})\s+(?:周.?\s+)?(\d{2}:\d{2})/)
    if (match) {
      const [, month, day, time] = match
      return `非最新数据: ${parseInt(month)}月${parseInt(day)}日 ${time}`
    }
    return timestamp
  }

  // 格式化入队日期（YYYYMMDD -> M.D入）
  const formatJoinDate = (joinDate) => {
    if (!joinDate || joinDate.length !== 8) return null
    const month = parseInt(joinDate.substring(4, 6))
    const day = parseInt(joinDate.substring(6, 8))
    return `${month}.${day}入`
  }

  // 剔除群外已开启但名单未就绪（加载中/失败）：禁止复制，避免名单分错
  const rosterPending = excludeOuter && !roster
  // 剔除管理已开启但管理名单未就绪：同样禁止复制，避免把管理带出去
  const adminsPending = excludeAdmins && !admins

  /**
   * 按当前筛选条件选出名单（复制文本 / 复制表格 / 预览共用）
   * @returns {{
   *   selected: Array,
   *   excludedSections: Array<{label: string, items: Array<{player, rank}>}>,
   *   title: string
   * } | null}
   */
  const buildSelection = () => {
    const selectedData = getSelectedData()
    if (!selectedData?.allData) return null

    const allData = selectedData.allData
    const tabName = copyDataType === 'weekly' ? '周活跃度' : '赛季活跃度'
    const formattedTime = formatTimestamp(selectedData.timestamp)
    const groupIds = excludeOuter ? roster?.playerIds : null
    const adminIds = excludeAdmins && admins
      ? new Set(admins.filter(admin => admin.excluded).map(admin => admin.playerId))
      : null
    const selected = []
    const excludedAdmins = []
    const excludedOuter = []
    // 先剔管理，再剔群外（只保留内群已绑定或审核群已登记 ID 的在群成员）
    const place = (p, rank) => {
      if (adminIds && p.playerId && adminIds.has(p.playerId.toUpperCase())) excludedAdmins.push({ player: p, rank })
      else if (groupIds && !(p.playerId && groupIds.has(p.playerId))) excludedOuter.push({ player: p, rank })
      else selected.push(p)
    }
    const withSections = (title) => ({
      selected,
      title,
      excludedSections: [
        { label: EXCLUDED_ADMIN_LABEL, items: excludedAdmins },
        { label: EXCLUDED_OUTER_LABEL, items: excludedOuter },
      ].filter(section => section.items.length > 0),
    })

    if (copyMode === 'rank') {
      // 按名次依次挑成员凑满人数，途中跳过的管理 / 群外成员进剔除名单
      const count = parseInt(copyCount) || 20
      for (let i = 0; i < allData.length && selected.length < count; i++) place(allData[i], i + 1)
      return withSections(`${formattedTime} HORIZN地平线${tabName}前${count}名${groupIds ? '（仅内群/审核群）' : ''}`)
    }

    const threshold = parseInt(thresholdValue) || 0
    allData.forEach((p, i) => {
      const matched = thresholdCompare === 'gte' ? p.value >= threshold : p.value <= threshold
      if (matched) place(p, i + 1)
    })
    const op = thresholdCompare === 'gte' ? '≥' : '≤'
    return withSections(`${formattedTime} HORIZN地平线${tabName}${op}${threshold}（${groupIds ? '仅内群/审核群，' : ''}共${selected.length}人）`)
  }

  // 新来成员的入队日期标注（勾了「新来」才有）
  const getJoinDateLabel = (p) => {
    const weeks = (currentData?.newMemberMap || {})[p.name]
    return copyShowNewMark && weeks && p.playerInfo?.joinDate ? formatJoinDate(p.playerInfo.joinDate) : null
  }

  // 写剪贴板（不支持 Clipboard API 时退回 execCommand）
  const copyToClipboard = (text, successMessage, toastOptions) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success(successMessage, toastOptions))
        .catch(() => toast.error('复制失败'))
      return
    }
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      if (document.execCommand('copy')) toast.success(successMessage, toastOptions)
      else toast.error('复制失败')
    } catch {
      toast.error('复制失败')
    }
    document.body.removeChild(textArea)
  }

  const copiedMessage = ({ selected, excludedSections }, suffix = '') => {
    const excludedCount = excludedSections.reduce((sum, section) => sum + section.items.length, 0)
    return `已复制 ${selected.length} 人${excludedCount ? `（附剔除 ${excludedCount} 人）` : ''}${suffix}`
  }

  // 复制名单：正式名单在前，剔除名单附在最后（保留原名次）
  const handleCopyList = () => {
    const selection = buildSelection()
    if (!selection) return
    const { selected, excludedSections, title } = selection

    const formatLine = (p, prefix) => {
      let line = `${prefix}${p.name}`
      if (copyShowId && p.playerId) line += ` (${p.playerId})`
      const joinDateStr = getJoinDateLabel(p)
      if (joinDateStr) line += ` ${joinDateStr}`
      if (copyShowValues) line += ` (${p.value})`
      return line
    }

    const lines = selected.map((p, i) => formatLine(p, copyShowIndex ? `${i + 1}. ` : ''))
    const sectionTexts = excludedSections.map(({ label, items }) => {
      const itemLines = items.map(({ player, rank }) => formatLine(player, copyShowIndex ? `#${rank} ` : ''))
      return `${label} ${items.length} 人：\n${itemLines.join('\n')}`
    })
    const text = [`${title}\n${lines.join('\n')}`, ...sectionTexts].join('\n\n')

    copyToClipboard(text, copiedMessage(selection))
  }

  // 复制为表格格式（TSV）：剔除名单空一行附在最后，排名列写原名次 #N
  const handleCopyAsTable = () => {
    const selection = buildSelection()
    if (!selection) return
    const { selected, excludedSections } = selection
    const tabName = copyDataType === 'weekly' ? '周活跃度' : '赛季活跃度'

    const headers = copyShowIndex ? ['排名', '成员名'] : ['成员名']
    if (copyShowId) headers.push('ID')
    if (copyShowNewMark) headers.push('入队日期')
    if (copyShowValues) headers.push(tabName)

    const buildRow = (p, rankCell) => {
      const row = copyShowIndex ? [rankCell, p.name] : [p.name]
      if (copyShowId) row.push(p.playerId || '')
      if (copyShowNewMark) row.push(getJoinDateLabel(p) || '')
      if (copyShowValues) row.push(p.value)
      return row.join('\t')
    }

    const lines = [headers.join('\t'), ...selected.map((p, i) => buildRow(p, i + 1))]
    excludedSections.forEach(({ label, items }) => {
      lines.push('', `${label} ${items.length} 人`)
      lines.push(...items.map(({ player, rank }) => buildRow(player, `#${rank}`)))
    })

    copyToClipboard(lines.join('\n'), copiedMessage(selection, '（表格格式）'), { duration: 2000 })
  }

  // 关闭弹窗并重置状态
  const handleClose = () => {
    setCopyCount('20')
    setCopyMode('rank')
    setThresholdCompare('gte')
    setThresholdValue(getDefaultThreshold('gte'))
    setManualFrameIndex(null)
    setCopyDataType(activeTab)
    // 群名单下次打开重新拉取（开关状态保留）
    setRoster(null)
    setRosterError(null)
    setAdmins(null)
    setAdminsError(null)
    setShowAdminSettings(false)
    onClose()
  }

  if (!show) return null

  const copyDisabled =
    (!currentData && !preloadedData[copyDataType]) ||
    (copyMode === 'rank' && (!copyCount || parseInt(copyCount) <= 0)) ||
    (copyMode === 'threshold' && thresholdValue === '') ||
    rosterPending ||
    adminsPending

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className={`bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-700/50 shadow-2xl w-full max-w-md overflow-hidden ${isMobile ? 'select-none' : ''}`}>
        {/* 顶部装饰条 */}
        <div className="h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        {/* 标题栏 */}
        <div className="px-4 sm:px-5 py-3 border-b border-gray-700/50 flex flex-wrap items-center gap-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="sm:hidden">复制名单</span>
              <span className="hidden sm:inline">复制排名名单</span>
            </h3>
            {/* 数据类型切换 */}
            <div className="flex gap-0.5 bg-gray-900/50 rounded-md p-0.5">
              <button
                onClick={() => {
                  setCopyDataType('weekly')
                  setActiveTab('weekly')
                  setThresholdValue(thresholdCompare === 'lte' ? '2500' : '4500')
                }}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                  copyDataType === 'weekly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                周
              </button>
              <button
                onClick={() => {
                  setCopyDataType('season')
                  setActiveTab('season')
                  setThresholdValue(thresholdCompare === 'lte' ? '7000' : '50000')
                }}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                  copyDataType === 'season'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                赛季
              </button>
            </div>
          </div>
          {/* 剔除开关：与关闭按钮同一行靠右，极窄屏放不下时才换行 */}
          <div className="ml-auto flex gap-1.5">
            <ExcludeToggle
              active={excludeAdmins}
              onClick={() => setExcludeAdmins(v => !v)}
              title="剔除管理名单里勾选的成员，不参与排名"
              onSettings={() => setShowAdminSettings(v => !v)}
              settingsOpen={showAdminSettings}
            >
              剔除管理
            </ExcludeToggle>
            <ExcludeToggle
              active={excludeOuter}
              onClick={() => setExcludeOuter(v => !v)}
              title="只保留内群或审核群里的成员，剔除两个群都不在的（审核群已退群的不算）"
            >
              剔除群外
            </ExcludeToggle>
          </div>
          <button
            onClick={handleClose}
            className="ml-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg p-1 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-4 sm:px-5 py-4 space-y-3">
          {/* 设置面板展开时替换筛选和预览区，弹窗高度不变 */}
          {showAdminSettings ? (
            <CopyRankAdminSettings
              admins={admins}
              error={adminsError}
              candidates={getSelectedData()?.allData || []}
              onChange={setAdmins}
              onReload={() => {
                setAdmins(null)
                setAdminsReloadKey(key => key + 1)
              }}
              onClose={() => setShowAdminSettings(false)}
            />
          ) : (
          <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                筛选模式
              </label>
              {/* 显示选项勾选框 */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyShowIndex}
                    onChange={(e) => setCopyShowIndex(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-400">序号</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyShowValues}
                    onChange={(e) => setCopyShowValues(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-400">数值</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyShowNewMark}
                    onChange={(e) => setCopyShowNewMark(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-400">新来</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyShowId}
                    onChange={(e) => setCopyShowId(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-400">ID</span>
                </label>
              </div>
            </div>

            {/* 仅当不是最新帧时显示警告 */}
            {currentData && !currentData.isLatest && (
              <div className="mb-2 text-xs text-yellow-400/80 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {formatTimestampShort(currentData.current.timestamp)}
              </div>
            )}

            {/* 模式切换按钮 */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setCopyMode('rank')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  copyMode === 'rank'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                }`}
              >
                按名次
              </button>
              <button
                onClick={() => setCopyMode('threshold')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  copyMode === 'threshold'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                }`}
              >
                按阈值
              </button>
            </div>

            {/* 按名次模式 */}
            {copyMode === 'rank' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {/* 选择人数 */}
                  <div>
                    <label htmlFor="copyCount" className="block text-xs font-medium text-gray-400 mb-1">
                      人数
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={(e) => handlePressStart(e, () => setCopyCount(prev => String(Math.max(5, parseInt(prev || 20) - 5))))}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        className="w-7 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        −
                      </button>
                      <input
                        id="copyCount"
                        type="number"
                        min="1"
                        max={getSelectedData()?.allData?.length || 100}
                        step="5"
                        value={copyCount}
                        onChange={(e) => setCopyCount(e.target.value)}
                        className="flex-1 h-7 px-2 bg-gray-700/50 text-white text-center text-xs font-semibold rounded-md border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onPointerDown={(e) => handlePressStart(e, () => setCopyCount(prev => String(Math.min(getSelectedData()?.allData?.length || 100, parseInt(prev || 20) + 5))))}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        className="w-7 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 选择时间 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      时间
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={(e) => {
                          if ((currentData?.currentFrameIndex ?? 0) <= 0) return
                          handlePressStart(e, () => {
                            const newIndex = Math.max(0, (currentFrameRef.current ?? 0) - 1)
                            currentFrameRef.current = newIndex
                            setManualFrameIndex(newIndex)
                          })
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        disabled={(currentData?.currentFrameIndex ?? 0) <= 0}
                        className="w-7 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        ←
                      </button>
                      <div className="flex-1 h-7 px-2 bg-gray-700/50 text-white text-center text-xs font-semibold rounded-md border border-gray-600 flex items-center justify-center truncate select-none">
                        {currentData?.current?.timestamp?.split(' ').pop() || '--:--'}
                      </div>
                      <button
                        onPointerDown={(e) => {
                          if ((currentData?.currentFrameIndex ?? 0) >= (currentData?.allTimestamps?.length || 1) - 1) return
                          handlePressStart(e, () => {
                            const maxIndex = (currentData?.allTimestamps?.length || 1) - 1
                            const newIndex = Math.min(maxIndex, (currentFrameRef.current ?? 0) + 1)
                            currentFrameRef.current = newIndex
                            setManualFrameIndex(newIndex)
                          })
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        disabled={(currentData?.currentFrameIndex ?? 0) >= (currentData?.allTimestamps?.length || 1) - 1}
                        className="w-7 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 text-center">
                  共 <span className="text-blue-400 font-medium">{getSelectedData()?.allData?.length || 0}</span> 人 ·
                  时间戳 <span className="text-blue-400 font-medium">{(currentData?.currentFrameIndex ?? 0) + 1}/{currentData?.allTimestamps?.length || 0}</span>
                </p>
              </>
            )}

            {/* 按阈值模式 */}
            {copyMode === 'threshold' && (
              <>
                <div className="grid grid-cols-[1fr_1.5fr_1.5fr] gap-2">
                  {/* 比较模式 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      条件
                    </label>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          setThresholdCompare('gte')
                          setThresholdValue(getDefaultThreshold('gte'))
                        }}
                        className={`flex-1 h-7 flex items-center justify-center rounded-l-md border text-xs font-medium transition-all ${
                          thresholdCompare === 'gte'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        ≥
                      </button>
                      <button
                        onClick={() => {
                          setThresholdCompare('lte')
                          setThresholdValue(getDefaultThreshold('lte'))
                        }}
                        className={`flex-1 h-7 flex items-center justify-center rounded-r-md border-t border-b border-r text-xs font-medium transition-all ${
                          thresholdCompare === 'lte'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        ≤
                      </button>
                    </div>
                  </div>

                  {/* 活跃度阈值 */}
                  <div className="overflow-hidden">
                    <label htmlFor="thresholdValue" className="block text-xs font-medium text-gray-400 mb-1">
                      阈值
                    </label>
                    <div className="flex items-center gap-0.5">
                      <button
                        onPointerDown={(e) => handlePressStart(e, () => setThresholdValue(prev => String(Math.max(0, parseInt(prev || getDefaultThreshold()) - getThresholdStep()))))}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        className="w-6 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        −
                      </button>
                      <input
                        id="thresholdValue"
                        type="number"
                        min="0"
                        step={getThresholdStep()}
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(e.target.value)}
                        className="flex-1 min-w-0 h-7 px-1 bg-gray-700/50 text-white text-center text-xs font-semibold rounded-md border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onPointerDown={(e) => handlePressStart(e, () => setThresholdValue(prev => String(parseInt(prev || getDefaultThreshold()) + getThresholdStep())))}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        className="w-6 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 选择时间 */}
                  <div className="overflow-hidden">
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      时间
                    </label>
                    <div className="flex items-center gap-0.5">
                      <button
                        onPointerDown={(e) => {
                          if ((currentData?.currentFrameIndex ?? 0) <= 0) return
                          handlePressStart(e, () => {
                            const newIndex = Math.max(0, (currentFrameRef.current ?? 0) - 1)
                            currentFrameRef.current = newIndex
                            setManualFrameIndex(newIndex)
                          })
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        disabled={(currentData?.currentFrameIndex ?? 0) <= 0}
                        className="w-6 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        ←
                      </button>
                      <div className="flex-1 min-w-0 h-7 px-1 bg-gray-700/50 text-white text-center text-xs font-semibold rounded-md border border-gray-600 flex items-center justify-center truncate select-none">
                        {currentData?.current?.timestamp?.split(' ').pop() || '--:--'}
                      </div>
                      <button
                        onPointerDown={(e) => {
                          if ((currentData?.currentFrameIndex ?? 0) >= (currentData?.allTimestamps?.length || 1) - 1) return
                          handlePressStart(e, () => {
                            const maxIndex = (currentData?.allTimestamps?.length || 1) - 1
                            const newIndex = Math.min(maxIndex, (currentFrameRef.current ?? 0) + 1)
                            currentFrameRef.current = newIndex
                            setManualFrameIndex(newIndex)
                          })
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        disabled={(currentData?.currentFrameIndex ?? 0) >= (currentData?.allTimestamps?.length || 1) - 1}
                        className="w-6 h-7 flex items-center justify-center bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-md transition-colors text-white font-medium text-sm select-none touch-none"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 text-center">
                  {getSelectedData() && (
                    <>
                      符合条件：<span className="text-blue-400 font-medium">
                        {getSelectedData().allData.filter(p =>
                          thresholdCompare === 'gte'
                            ? p.value >= (parseInt(thresholdValue) || 0)
                            : p.value <= (parseInt(thresholdValue) || 0)
                        ).length}
                      </span> 人 ·
                      时间戳 <span className="text-blue-400 font-medium">{(currentData?.currentFrameIndex ?? 0) + 1}/{currentData?.allTimestamps?.length || 0}</span>
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          {/* 预览 */}
          {getSelectedData() && (
            <div className="bg-gray-900/50 rounded-lg p-2.5 border border-gray-700/50">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">预览</p>
                <span className="text-xs text-gray-500 font-mono">
                  {copyMode === 'rank'
                    ? `前 ${parseInt(copyCount) || 20} 名`
                    : `${thresholdCompare === 'gte' ? '≥' : '≤'}${parseInt(thresholdValue) || 0}`
                  }
                </span>
              </div>
              <div className={`text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-40 sm:max-h-52 overflow-y-auto custom-scrollbar ${!isMobile ? 'select-text' : ''}`}>
                {(() => {
                  const selection = buildSelection()
                  if (!selection) return null
                  const { selected: selectedPlayers, excludedSections, title } = selection

                  // 红字提示（仅预览，不复制）：名单加载状态 / 两个群里没对上游戏成员的 QQ 需人工核对
                  const notices = []
                  if (excludeAdmins && adminsError) {
                    notices.push(`⚠ 管理名单加载失败：${adminsError}。已暂停复制，可关闭「剔除管理」后复制`)
                  } else if (adminsPending) {
                    notices.push('管理名单加载中…')
                  }
                  if (excludeOuter && rosterError) {
                    notices.push(`⚠ 内群/审核群名单加载失败：${rosterError}。已暂停复制，可关闭「剔除群外」后复制完整名单`)
                  } else if (rosterPending) {
                    notices.push('内群/审核群名单加载中…')
                  } else if (excludeOuter && roster) {
                    if (roster.unbound.length > 0) {
                      notices.push(`⚠ 内群有 ${roster.unbound.length} 个QQ未绑定游戏成员，可能被误剔除，请人工审核以下内群QQ名片是否在清单中：${roster.unbound.map(u => u.name).join('、')}`)
                    }
                    if (roster.reviewUnregistered.length > 0) {
                      notices.push(`⚠ 审核群有 ${roster.reviewUnregistered.length} 人未登记游戏ID，可能被误剔除，请人工审核以下审核群QQ名片是否在清单中：${roster.reviewUnregistered.map(u => u.name).join('、')}`)
                    }
                  }

                  const renderPlayer = (p, prefix, key) => {
                    const joinDateStr = getJoinDateLabel(p)
                    return (
                      <div key={key}>
                        {prefix}{p.name}
                        {copyShowId && p.playerId && (
                          <span className="text-gray-500"> ({p.playerId})</span>
                        )}
                        {joinDateStr && (
                          <span className="text-green-400 ml-1">{joinDateStr}</span>
                        )}
                        {copyShowValues && <span> ({p.value})</span>}
                      </div>
                    )
                  }

                  return (
                    <>
                      {notices.map(notice => (
                        <div key={notice} className="mb-2 text-red-400 font-sans">{notice}</div>
                      ))}
                      <div className="mb-2 text-gray-200">{title}</div>
                      {selectedPlayers.map((p, i) => renderPlayer(p, copyShowIndex ? `${i + 1}. ` : '', i))}
                      {excludedSections.map(({ label, items }) => (
                        <div key={label} className="mt-2 pt-2 border-t border-gray-700/50 text-gray-400">
                          <div className="mb-1 text-gray-200">{label} {items.length} 人：</div>
                          {items.map(({ player, rank }) =>
                            renderPlayer(player, copyShowIndex ? `#${rank} ` : '', player.playerId || `rank-${rank}`))}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-4 sm:px-5 py-3 bg-gray-900/30 border-t border-gray-700/50 flex gap-2">
          <button
            onClick={handleClose}
            className="px-3 py-2 bg-gray-700/50 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCopyAsTable}
            disabled={copyDisabled}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>表格</span>
          </button>
          <button
            onClick={handleCopyList}
            disabled={copyDisabled}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>复制</span>
          </button>
        </div>
      </div>
    </div>
  )
}
