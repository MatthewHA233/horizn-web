import BarChartSkeleton from '@/components/Horizn/BarChartSkeleton'

export default function Loading() {
  return (
    <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
      <BarChartSkeleton />
    </div>
  )
}
