export default function Loading() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">加载活跃度数据...</p>
      </div>
    </div>
  )
}
