export default function Loading() {
  return (
    <div className="w-full h-screen bg-gradient-to-b from-gray-900 to-black p-4 overflow-hidden">
      {/* 顶部栏骨架 */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
          <div className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>

      {/* Tab 切换骨架 */}
      <div className="flex gap-2 mb-4">
        <div className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
        <div className="h-9 w-24 bg-gray-700 rounded animate-pulse" />
      </div>

      {/* 条形图骨架 */}
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2" style={{ opacity: 1 - i * 0.03 }}>
            <div className="h-4 w-16 bg-gray-800 rounded animate-pulse shrink-0" />
            <div
              className="h-4 bg-gray-800 rounded animate-pulse"
              style={{ width: `${Math.max(8, 95 - i * 4)}%`, animationDelay: `${i * 50}ms` }}
            />
            <div className="h-4 w-10 bg-gray-800 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
