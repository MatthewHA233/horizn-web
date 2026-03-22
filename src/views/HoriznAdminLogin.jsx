'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft } from 'lucide-react'
import { CDN_BASE_URL } from '@/utils/constants'

export default function HoriznAdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)
  const router = useRouter()

  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_HORIZN_ADMIN_PASSWORD || 'admin123'
  const SUPER_PASSWORD = process.env.NEXT_PUBLIC_HORIZN_SUPER_PASSWORD || ''

  useEffect(() => {
    document.title = 'HORIZN 管理员登录'
    return () => { document.title = 'HORIZN' }
  }, [])

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('horizn_admin_auth') === 'true'
    if (isAuthenticated) router.push('/')
  }, [router])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 450)
  }

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    setTimeout(() => {
      if (SUPER_PASSWORD && password === SUPER_PASSWORD) {
        // 超级管理员：可访问舷号与黑名单
        sessionStorage.setItem('horizn_admin_auth', 'true')
        sessionStorage.setItem('horizn_super_auth', 'true')
        router.push('/')
      } else if (password === ADMIN_PASSWORD) {
        // 普通管理员
        sessionStorage.setItem('horizn_admin_auth', 'true')
        sessionStorage.removeItem('horizn_super_auth')
        router.push('/')
      } else {
        setError('密码错误')
        setPassword('')
        setIsLoading(false)
        triggerShake()
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }, 380)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#030712' }}
    >
      {/* 极淡的径向暗纹，避免纯黑太假 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(251,191,36,0.025) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* 主卡片 */}
        <div
          style={{
            background: 'linear-gradient(160deg, #10131c 0%, #0c0e15 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* 顶部极细 amber 线 */}
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.35) 50%, transparent 100%)',
              borderRadius: '14px 14px 0 0',
            }}
          />

          <div className="px-8 pt-10 pb-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-10">
              <img
                src={`${CDN_BASE_URL}/horizn.png`}
                alt="HORIZN"
                className="h-14 w-14 rounded-full object-cover mb-4"
                style={{
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.6)',
                }}
              />
              <span
                className="text-xs tracking-[0.2em] uppercase"
                style={{ color: '#4a4e63', letterSpacing: '0.18em' }}
              >
                Admin Access
              </span>
            </div>

            {/* 表单 */}
            <form onSubmit={handleLogin}>
              <div
                className="relative"
                style={{
                  animation: shake ? 'shake 0.4s ease' : 'none',
                }}
              >
                <input
                  ref={inputRef}
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="密码"
                  autoFocus
                  disabled={isLoading}
                  className="w-full text-sm outline-none disabled:opacity-50"
                  style={{
                    background: '#13161f',
                    border: error
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '10px 40px 10px 14px',
                    color: '#e2e4ed',
                    fontSize: '15px',
                    letterSpacing: '0.05em',
                    caretColor: '#fbbf24',
                    transition: 'border-color 0.15s',
                  }}
                />
                <Lock
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: '#4a4e63' }}
                />
              </div>

              {/* 错误提示 */}
              <div
                style={{
                  height: error ? 'auto' : 0,
                  overflow: 'hidden',
                  transition: 'height 0.15s',
                }}
              >
                {error && (
                  <p
                    className="text-xs mt-2 pl-1"
                    style={{ color: 'rgba(239,68,68,0.8)' }}
                  >
                    {error}
                  </p>
                )}
              </div>

              {/* Aceternity shimmer button */}
              <div
                className="mt-4"
                style={{
                  padding: '1px',
                  borderRadius: '9px',
                  background: password && !isLoading
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.08) 50%, rgba(251,191,36,0.4) 100%)'
                    : 'rgba(255,255,255,0.07)',
                  transition: 'background 0.3s',
                  opacity: !password ? 0.35 : 1,
                }}
              >
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="relative w-full overflow-hidden text-sm font-medium"
                  style={{
                    background: '#0c0e15',
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: password && !isLoading ? 'pointer' : 'default',
                    color: password && !isLoading ? '#fde68a' : '#4a4e63',
                    transition: 'color 0.3s',
                    letterSpacing: '0.04em',
                  }}
                >
                  {/* 扫光层 */}
                  {password && !isLoading && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(110deg, transparent 25%, rgba(251,191,36,0.13) 50%, transparent 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'btnShimmer 2.2s infinite linear',
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin"
                          style={{ borderColor: 'rgba(251,191,36,0.25)', borderTopColor: '#fbbf24' }}
                        />
                        验证中
                      </>
                    ) : (
                      '进入'
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 返回 */}
        <div className="mt-5 flex justify-center">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-100 opacity-40"
            style={{ color: '#8b8fa8' }}
          >
            <ArrowLeft className="w-3 h-3" />
            <span>返回</span>
          </a>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          18%       { transform: translateX(-6px); }
          36%       { transform: translateX(5px); }
          54%       { transform: translateX(-4px); }
          72%       { transform: translateX(3px); }
          90%       { transform: translateX(-2px); }
        }
        @keyframes btnShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  )
}
