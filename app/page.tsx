'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuth } from '@/lib/auth'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuth(user => {
      if (user) router.replace('/admin/dashboard')
      else router.replace('/auth/login')
    })
    return () => unsub()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#ecf0f5' }}>
      <div className="primary-spinner animate-spin w-8 h-8 border-4 rounded-full"></div>
    </div>
  )
}
