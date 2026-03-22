export default function Loading() {
  // 确定性伪随机
  const h = (i, s = 0) => ((i * 2654435761 + s) >>> 0) % 100

  const bars = Array.from({ length: 25 }, (_, i) => {
    const base = Math.max(5, 96 - i * 3.6)
    const jitter = (h(i, 7) % 7) - 3
    return {
      width: Math.min(98, Math.max(4, base + jitter)),
      nameW: 30 + h(i, 13) % 55,
      color: `hsl(${h(i, 31) * 3.6 % 360}, ${35 + h(i, 51) % 20}%, ${30 + h(i, 71) % 15}%)`,
    }
  })

  return (
    <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.85; }
        }
        .sk-pulse {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        @keyframes bar-wave {
          0%, 100% { transform: scaleX(1); }
          30% { transform: scaleX(0.88); }
          70% { transform: scaleX(1.03); }
        }
        .sk-bar {
          transform-origin: left center;
          animation: bar-wave 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* 顶部导航栏 —— 完全复刻 HoriznPage 响应式结构 */}
      <div className="flex-shrink-0 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* 左侧：真实logo + 真实tab文字 */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/horizn.png"
                alt="HORIZN"
                className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex gap-0.5 sm:gap-1">
                <button className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs sm:text-sm font-medium text-white border-b-2 border-blue-500">
                  周活跃度
                </button>
                <button className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs sm:text-sm font-medium text-gray-400">
                  赛季活跃度
                </button>
              </div>
            </div>

            {/* 右侧：月份按钮 */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs text-gray-400 pr-1 sm:pr-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-medium sk-pulse">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">----年--月</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 条形图内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              {/* 条形图区域 */}
              <div className="flex-1 relative">
                <div className="space-y-1">
                  {bars.map((bar, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3">
                      {/* 名次：真实数字 */}
                      <div className="w-6 sm:w-8 text-center text-gray-400 text-xs sm:text-sm font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      {/* 名称占位条 */}
                      <div className="w-20 sm:w-28 md:w-36 lg:w-44 flex items-center justify-end gap-0.5 flex-shrink-0">
                        <div
                          className="h-3 sm:h-3.5 bg-gray-700/60 rounded-sm sk-pulse"
                          style={{
                            width: `${bar.nameW}%`,
                            animationDelay: `${i * 80}ms`,
                          }}
                        />
                      </div>
                      {/* 条形图：真实颜色 + 大幅波动 */}
                      <div className="flex-1 relative h-3 sm:h-4 min-w-0">
                        <div
                          className="h-full rounded sk-bar"
                          style={{
                            width: `${bar.width}%`,
                            backgroundColor: bar.color,
                            animationDelay: `${i * 100}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 右下角时间（小屏）—— 真实布局 */}
                <div className="lg:hidden absolute bottom-0 right-4 sm:right-8 md:right-12 text-right pointer-events-none">
                  <div className="text-sm sm:text-base md:text-lg text-gray-400/80 font-mono leading-none sk-pulse">
                    --月--日
                  </div>
                  <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-300/80 font-mono leading-none mt-1 sk-pulse" style={{ animationDelay: '0.2s' }}>
                    --:--
                  </div>
                </div>
              </div>

              {/* 大屏：右侧时间 */}
              <div className="hidden lg:flex w-64 xl:w-96 flex-col justify-center items-center flex-shrink-0">
                <div className="text-center">
                  <div className="text-xl xl:text-2xl text-gray-400 mb-2 font-mono leading-none sk-pulse">
                    --月--日
                  </div>
                  <div className="text-6xl xl:text-8xl font-bold text-gray-300 mb-3 xl:mb-4 font-mono leading-none sk-pulse" style={{ animationDelay: '0.2s' }}>
                    --:--
                  </div>
                </div>
              </div>
            </div>

            {/* 播放控制 —— 复刻真实结构 */}
            <div className="mt-4 sm:mt-6 lg:mt-8 pt-3 sm:pt-4 border-t border-gray-800/50">
              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4">
                {/* 播放按钮 */}
                <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 sk-pulse">
                  <svg className="w-4 h-4 text-gray-300 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>

                {/* 进度条 */}
                <div className="flex-1 relative px-4">
                  <div className="relative h-8 mb-1">
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gray-800" />
                  </div>
                  <div className="relative h-6">
                    <div className="absolute inset-0 bg-gray-800/40 rounded" />
                    <div className="absolute left-0 top-0 bottom-0 w-0 bg-blue-500/30 rounded" />
                  </div>
                </div>

                {/* 速度 */}
                <span className="text-gray-500 text-xs font-mono flex-shrink-0">1.0x</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
