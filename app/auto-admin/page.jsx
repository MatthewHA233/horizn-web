'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
      <div className="w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

export default function AutoAdminPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <div className="w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <AutoAdminContent />
    </Suspense>
  )
}
