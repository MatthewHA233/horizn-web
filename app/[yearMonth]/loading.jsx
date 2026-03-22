export default function Loading() {
  return (
    <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
      {/* 内联 shimmer 动画样式 */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%);
          background-size: 400px 100%;
          animation: shimmer 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* 顶部导航栏 —— 与 HoriznPage 一致 */}
      <div className="flex-shrink-0 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* 左侧：logo + tab */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              {/* 联队 logo 占位 */}
              <div className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 rounded-full bg-gray-800 skeleton-shimmer flex-shrink-0" />
              {/* 两个 Tab 按钮 */}
              <div className="flex gap-0.5 sm:gap-1">
                <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                  <div className="h-3 sm:h-4 w-14 sm:w-16 bg-gray-700 rounded skeleton-shimmer" />
                </div>
                <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                  <div className="h-3 sm:h-4 w-16 sm:w-20 bg-gray-800 rounded skeleton-shimmer" style={{ animationDelay: '0.15s' }} />
                </div>
              </div>
              {/* 搜索图标占位 */}
              <div className="h-3.5 w-3.5 bg-gray-800 rounded skeleton-shimmer ml-1 sm:ml-2" style={{ animationDelay: '0.3s' }} />
            </div>

            {/* 右侧：月份按钮 */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 pr-1 sm:pr-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/10 border border-purple-500/20 rounded">
                <div className="h-3 w-3 sm:h-3.5 sm:w-3.5 bg-purple-800/50 rounded skeleton-shimmer flex-shrink-0" />
                <div className="hidden sm:block h-3 w-16 bg-purple-800/40 rounded skeleton-shimmer" style={{ animationDelay: '0.2s' }} />
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
              {/* 条形图区域 */}
              <div className="flex-1 relative">
                <div className="space-y-1">
                  {Array.from({ length: 25 }).map((_, i) => {
                    // 模拟真实条形图：前几名最宽，逐步递减，带随机变化
                    const widths = [95, 91, 87, 82, 78, 73, 68, 64, 59, 55, 50, 46, 42, 38, 35, 31, 28, 25, 22, 19, 17, 15, 13, 11, 9]
                    const barWidth = widths[i] || 8
                    return (
                      <div key={i} className="flex items-center gap-2 sm:gap-3">
                        {/* 名次 */}
                        <div className="w-6 sm:w-8 flex justify-center flex-shrink-0">
                          <div
                            className="h-3 sm:h-4 w-4 sm:w-5 bg-gray-800 rounded skeleton-shimmer"
                            style={{ animationDelay: `${i * 0.04}s` }}
                          />
                        </div>
                        {/* 玩家名称 */}
                        <div className="w-20 sm:w-28 md:w-36 lg:w-44 flex justify-end flex-shrink-0">
                          <div
                            className="h-3 sm:h-4 bg-gray-800 rounded skeleton-shimmer"
                            style={{
                              width: `${40 + ((i * 17) % 40)}%`,
                              animationDelay: `${i * 0.04 + 0.1}s`
                            }}
                          />
                        </div>
                        {/* 条形图 */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="h-3 sm:h-4 rounded skeleton-shimmer"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: `hsl(${(i * 37 + 200) % 360}, 40%, 25%)`,
                              animationDelay: `${i * 0.04 + 0.2}s`
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 右下角时间戳占位（小屏） */}
                <div className="lg:hidden absolute bottom-0 right-4 sm:right-8 md:right-12 text-right">
                  <div className="h-3 sm:h-4 w-20 bg-gray-800/50 rounded skeleton-shimmer mb-1" style={{ animationDelay: '0.5s' }} />
                  <div className="h-10 sm:h-12 md:h-14 w-16 sm:w-20 bg-gray-800/30 rounded skeleton-shimmer" style={{ animationDelay: '0.6s' }} />
                </div>
              </div>

              {/* 大屏幕：右侧时间区域 */}
              <div className="hidden lg:flex w-64 xl:w-96 flex-col justify-center items-center flex-shrink-0">
                <div className="text-center space-y-3">
                  <div className="h-5 xl:h-6 w-28 bg-gray-800/50 rounded skeleton-shimmer mx-auto" style={{ animationDelay: '0.4s' }} />
                  <div className="h-14 xl:h-20 w-32 xl:w-40 bg-gray-800/30 rounded skeleton-shimmer mx-auto" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>

            {/* 底部进度条骨架 */}
            <div className="mt-6 space-y-2">
              {/* 时间刻度 */}
              <div className="flex justify-between px-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2.5 w-8 bg-gray-800/40 rounded skeleton-shimmer"
                    style={{ animationDelay: `${0.7 + i * 0.1}s` }}
                  />
                ))}
              </div>
              {/* 进度条 */}
              <div className="h-6 bg-gray-800/30 rounded skeleton-shimmer" style={{ animationDelay: '0.8s' }} />
              {/* 播放控制 */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-7 w-7 bg-gray-800 rounded-full skeleton-shimmer" style={{ animationDelay: '0.9s' }} />
                <div className="h-7 w-7 bg-gray-800 rounded-full skeleton-shimmer" style={{ animationDelay: '0.95s' }} />
                <div className="h-3 w-24 bg-gray-800/40 rounded skeleton-shimmer ml-2" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
