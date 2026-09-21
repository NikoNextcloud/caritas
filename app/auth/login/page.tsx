'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { login } from '@/lib/auth'
import toast, { Toaster } from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Попълнете всички полета'); return }
    setLoading(true)
    try {
      await login(email, password)
      router.push('/admin/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('wrong-password') || msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        toast.error('Невалиден имейл или парола')
      } else {
        toast.error('Грешка при вход. Опитайте отново.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#ecf0f5' }}>
      <Toaster position="top-right" />
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Image
              src="/logo.png"
              alt="Caritas Logo"
              width={80}
              height={80}
              className="rounded-lg"
            />
          </div>
          <h1 className="text-3xl font-light text-gray-600">
            <span className="font-bold" style={{ color: '#3c8dbc' }}>C</span>aritas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Здравей! Можеш да се логнеш в администрацията</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Имейл"
                className="form-control"
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Парола"
                className="form-control"
                autoComplete="current-password"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Запомни ме
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Влизане...
                </span>
              ) : 'Вход'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Copyright © {new Date().getFullYear()} · Caritas Admin
        </p>
      </div>
    </div>
  )
}
