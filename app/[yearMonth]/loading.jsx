export default function Loading() {
  // 确定性伪随机：基于索引产生"随机"但 SSR/CSR 一致的值
  const hash = (i, seed = 0) => ((i * 2654435761 + seed) >>> 0) % 100

  // 25 行条形图数据：宽度递减 + 波动，名称宽度也各不相同
  const rows = Array.from({ length: 25 }, (_, i) => {
    const baseWidth = Math.max(8, 95 - i * 3.5)
    const jitter = (hash(i, 7) % 9) - 4 // -4 ~ +4 的波动
    const barWidth = Math.min(97, Math.max(6, baseWidth + jitter))
    const nameWidth = 35 + (hash(i, 13) % 50) // 35%~85%
    const hue = (hash(i, 31) * 3.6) % 360
    return { barWidth, nameWidth, hue }
  })

  return (
    <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
      <style>{`
        /* 基础 shimmer 扫光 */
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .sk {
          background: linear-gradient(
            90deg,
            var(--sk-base, rgba(31,41,55,0.8)) 25%,
            var(--sk-shine, rgba(55,65,81,0.9)) 50%,
            var(--sk-base, rgba(31,41,55,0.8)) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 2px;
        }

        /* 条形图专用：带宽度脉动，模拟数据在波动 */
        @keyframes bar-breathe {
          0%, 100% { transform: scaleX(1); opacity: 0.85; }
          50% { transform: scaleX(0.97); opacity: 1; }
        }
        .sk-bar {
          transform-origin: left center;
          animation:
            shimmer 1.5s ease-in-out infinite,
            bar-breathe 2.4s ease-in-out infinite;
        }

        /* 名称脉动：宽度微缩，像数据在刷新 */
        @keyframes name-flicker {
          0%, 100% { transform: scaleX(1); opacity: 0.7; }
          40% { transform: scaleX(0.92); opacity: 0.9; }
          70% { transform: scaleX(1.03); opacity: 0.75; }
        }
        .sk-name {
          transform-origin: right center;
          animation:
            shimmer 1.5s ease-in-out infinite,
            name-flicker 2.8s ease-in-out infinite;
        }
      `}</style>

      {/* 顶部导航栏 */}
      <div className="flex-shrink-0 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* 左侧：logo + tab */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <div className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 rounded-full sk flex-shrink-0" />
              <div className="flex gap-0.5 sm:gap-1">
                <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                  <div className="h-3 sm:h-4 w-14 sm:w-16 sk" style={{ '--sk-base': 'rgba(55,65,81,0.8)', '--sk-shine': 'rgba(75,85,99,0.9)' }} />
                </div>
                <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                  <div className="h-3 sm:h-4 w-16 sm:w-20 sk" style={{ animationDelay: '0.15s' }} />
                </div>
              </div>
              <div className="h-3.5 w-3.5 sk ml-1 sm:ml-2 rounded" style={{ animationDelay: '0.3s' }} />
            </div>

            {/* 右侧：月份按钮 */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 pr-1 sm:pr-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/10 border border-purple-500/20 rounded">
                <div className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded sk flex-shrink-0" style={{ '--sk-base': 'rgba(88,28,135,0.4)', '--sk-shine': 'rgba(107,33,168,0.5)' }} />
                <div className="hidden sm:block h-3 w-16 sk" style={{ '--sk-base': 'rgba(88,28,135,0.3)', '--sk-shine': 'rgba(107,33,168,0.4)', animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 —— 条形图骨架 */}
      <div className="flex-1 overflow-hidden">
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              {/* 条形图 */}
              <div className="flex-1 relative">
                <div className="space-y-1">
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3">
                      {/* 名次 */}
                      <div className="w-6 sm:w-8 flex justify-center flex-shrink-0">
                        <div
                          className="h-3 sm:h-4 w-4 sm:w-5 sk rounded"
                          style={{ animationDelay: `${i * 50}ms` }}
                        />
                      </div>
                      {/* 玩家名称 —— 带 flicker 脉动 */}
                      <div className="w-20 sm:w-28 md:w-36 lg:w-44 flex justify-end flex-shrink-0">
                        <div
                          className="h-3 sm:h-4 sk sk-name rounded"
                          style={{
                            width: `${row.nameWidth}%`,
                            animationDelay: `${i * 50 + 25}ms`
                          }}
                        />
                      </div>
                      {/* 条形图 —— 带 breathe 脉动 + 带色相的彩色底 */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="h-3 sm:h-4 rounded sk-bar"
                          style={{
                            width: `${row.barWidth}%`,
                            '--sk-base': `hsla(${row.hue}, 45%, 22%, 0.9)`,
                            '--sk-shine': `hsla(${row.hue}, 50%, 32%, 1)`,
                            animationDelay: `${i * 50 + 50}ms`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 右下角时间戳占位（小屏） */}
                <div className="lg:hidden absolute bottom-0 right-4 sm:right-8 md:right-12 text-right">
                  <div className="h-3 sm:h-4 w-20 sk rounded mb-1" style={{ animationDelay: '0.5s' }} />
                  <div className="h-10 sm:h-12 md:h-14 w-16 sm:w-20 sk rounded" style={{ opacity: 0.4, animationDelay: '0.6s' }} />
                </div>
              </div>

              {/* 大屏：右侧时间 */}
              <div className="hidden lg:flex w-64 xl:w-96 flex-col justify-center items-center flex-shrink-0">
                <div className="text-center space-y-3">
                  <div className="h-5 xl:h-6 w-28 sk rounded mx-auto" style={{ animationDelay: '0.4s' }} />
                  <div className="h-14 xl:h-20 w-32 xl:w-40 sk rounded mx-auto" style={{ opacity: 0.35, animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>

            {/* 底部进度条骨架 */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between px-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-2.5 w-8 sk rounded" style={{ animationDelay: `${700 + i * 100}ms` }} />
                ))}
              </div>
              <div className="h-6 sk rounded" style={{ opacity: 0.4, animationDelay: '0.8s' }} />
              <div className="flex items-center gap-3 pt-1">
                <div className="h-7 w-7 sk rounded-full" style={{ animationDelay: '0.9s' }} />
                <div className="h-7 w-7 sk rounded-full" style={{ animationDelay: '0.95s' }} />
                <div className="h-3 w-24 sk rounded ml-2" style={{ opacity: 0.5, animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
