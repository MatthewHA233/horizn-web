import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  addCopyRankAdmin,
  removeCopyRankAdmin,
  setCopyRankAdminExcluded,
} from '@/services/horiznSupabase'

const PLAYER_ID_PATTERN = /^[0-9A-F]{12,16}$/
const MAX_SUGGESTIONS = 8

/**
 * 「剔除管理」设置弹窗：维护管理名单，勾选复制名单时要剔除的管理
 * 名单存云端（所有管理员共享），每次操作即时保存
 * 样式与达标核查的规则设置弹窗一致：标题 + 关闭、内容区限高滚动、底部按钮
 *
 * @param {Array|null} admins - 管理名单，null 表示加载中
 * @param {string|null} error - 加载失败信息
 * @param {Array<{playerId, name}>} candidates - 可添加的成员（当前排名数据）
 * @param {(admins: Array) => void} onChange - 保存成功后回写新名单
 * @param {() => void} onReload - 重新加载名单
 * @param {() => void} onClose - 关闭弹窗
 */
export default function CopyRankAdminSettings({ admins, error, candidates, onChange, onReload, onClose }) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const listedIds = useMemo(() => new Set((admins || []).map(admin => admin.playerId)), [admins])

  // 按名字或 ID 搜当前排名里的成员；输入完整 ID 时也可直接按 ID 添加
  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    const matched = (candidates || [])
      .filter(p => p.playerId && !listedIds.has(p.playerId.toUpperCase()))
      .filter(p => p.name?.toLowerCase().includes(query) || p.playerId.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map(p => ({ playerId: p.playerId.toUpperCase(), name: p.name }))
    const rawId = query.toUpperCase()
    if (PLAYER_ID_PATTERN.test(rawId) && !listedIds.has(rawId) && !matched.some(p => p.playerId === rawId)) {
      matched.push({ playerId: rawId, name: null })
    }
    return matched
  }, [search, candidates, listedIds])

  const runSave = async (playerId, save, applyLocal) => {
    setBusyId(playerId)
    try {
      const result = await save()
      if (result?.success === false) throw new Error(result.error || '保存失败')
      applyLocal()
    } catch (err) {
      toast.error(err.message || '保存失败')
    } finally {
      setBusyId(null)
    }
  }

  const toggleExcluded = (admin) => runSave(
    admin.playerId,
    () => setCopyRankAdminExcluded(admin.playerId, !admin.excluded),
    () => onChange(admins.map(a => (a.playerId === admin.playerId ? { ...a, excluded: !a.excluded } : a))),
  )

  const removeAdmin = (admin) => runSave(
    admin.playerId,
    () => removeCopyRankAdmin(admin.playerId),
    () => onChange(admins.filter(a => a.playerId !== admin.playerId)),
  )

  const addAdmin = (player) => runSave(
    player.playerId,
    () => addCopyRankAdmin(player.playerId),
    () => {
      setSearch('')
      onChange([...admins, { playerId: player.playerId, name: player.name || player.playerId, excluded: false, active: true }])
    },
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-3">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-sm overflow-hidden">
        {/* 弹窗标题 */}
        <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">
            管理名单 <span className="text-[10px] text-gray-500 font-normal">勾选的复制时剔除</span>
          </h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 名单（限高滚动） */}
        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="text-xs text-red-400">
              管理名单加载失败：{error}
              <button onClick={onReload} className="ml-1 underline hover:text-red-300">重试</button>
            </div>
          )}
          {!error && !admins && <div className="text-xs text-gray-500">加载中…</div>}

          {!error && admins && (
            <>
              {/* 添加 */}
              <div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索名字或ID，添加到管理名单"
                  className="w-full h-7 px-2 bg-gray-700/50 text-white text-xs rounded-md border border-gray-600 focus:border-blue-500 focus:outline-none transition-all"
                />
                {suggestions.length > 0 && (
                  <div className="mt-1 rounded-md border border-gray-700 bg-gray-900/60">
                    {suggestions.map(player => (
                      <button
                        key={player.playerId}
                        onClick={() => addAdmin(player)}
                        disabled={busyId === player.playerId}
                        className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40 truncate"
                      >
                        {player.name || '按ID添加'} <span className="text-gray-500">({player.playerId})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 已有管理 */}
              <div className="space-y-1">
                {admins.length === 0 && <div className="text-xs text-gray-500">名单为空</div>}
                {admins.map(admin => (
                  <div key={admin.playerId} className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" title={admin.playerId}>
                      <input
                        type="checkbox"
                        checked={admin.excluded}
                        disabled={busyId === admin.playerId}
                        onChange={() => toggleExcluded(admin)}
                        className="w-3 h-3 shrink-0 rounded border-gray-600 bg-gray-700 text-rose-500 focus:ring-rose-500/30 focus:ring-offset-0"
                      />
                      <span className={`truncate ${admin.excluded ? 'text-white' : 'text-gray-400'}`}>{admin.name}</span>
                      {!admin.active && <span className="shrink-0 text-[10px] text-gray-500">已离队</span>}
                    </label>
                    <button
                      onClick={() => removeAdmin(admin)}
                      disabled={busyId === admin.playerId}
                      className="shrink-0 text-[10px] text-gray-500 hover:text-rose-400 disabled:opacity-40 transition-colors"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 弹窗底部：改动即时保存，这里只关闭 */}
        <div className="px-3 py-2 bg-gray-900/50 border-t border-gray-700 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">改动即时保存</span>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
