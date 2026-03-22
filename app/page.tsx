import { redirect } from 'next/navigation'
import { getLatestMonth } from '../lib/horiznData'

export const revalidate = 300

export default async function Home() {
  let yearMonth: string | null = null
  try {
    yearMonth = await getLatestMonth()
  } catch (e) {
    console.error('[服务端] 获取最新月份失败:', e)
  }

  if (!yearMonth) {
    const now = new Date()
    yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  redirect(`/${yearMonth}`)
}
