import { getServerIdMapping } from '../../lib/horiznData'
import HoriznPage from '@/views/HoriznPage'

export const revalidate = 300

export default async function HoriznYearMonthPage({ params }) {
  const { yearMonth } = params

  // 服务端只获取成员映射（Supabase，海外→海外，快）
  let idMapping = null
  try {
    idMapping = await getServerIdMapping()
  } catch (e) {
    console.error('[服务端] 成员映射获取失败:', e.message)
  }

  return <HoriznPage yearMonth={yearMonth} serverIdMapping={idMapping} />
}
