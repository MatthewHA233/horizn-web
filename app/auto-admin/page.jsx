'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import BarChartSkeleton from '@/components/Horizn/BarChartSkeleton'

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_HORIZN_ADMIN_TOKEN

function AutoAdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
      sessionStorage.setItem('horizn_admin_auth', 'true')
    }
    router.replace('/')
  }, [router, searchParams])

  return (
    <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
      <BarChartSkeleton />
    </div>
  )
}

export default function AutoAdminPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col bg-gradient-to-b from-gray-900 to-black" style={{ height: '100dvh' }}>
        <BarChartSkeleton />
      </div>
    }>
      <AutoAdminContent />
    </Suspense>
  )
}
