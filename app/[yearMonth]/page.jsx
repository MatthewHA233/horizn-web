import { getMonthlyOSSData } from '../../lib/horiznData'
import HoriznPage from '@/views/HoriznPage'

export const revalidate = 300 // ISR: 每 5 分钟重新验证

export default async function HoriznYearMonthPage({ params }) {
  const { yearMonth } = params

  // 服务端获取 OSS 数据，Vercel 自动缓存
  let serverData = null
  try {
    serverData = await getMonthlyOSSData(yearMonth)
  } catch (e) {
    console.error('[服务端] 数据获取失败:', e.message)
  }

  return <HoriznPage yearMonth={yearMonth} serverData={serverData} />
}
