import BarChartSkeleton from '@/components/Horizn/BarChartSkeleton'

export default function Loading() {
  return (
    <div
      className="flex flex-col bg-gradient-to-b from-gray-900 to-black overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: '100dvh',
      }}
    >
      <BarChartSkeleton />
    </div>
  )
}
