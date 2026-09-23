'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/db'
import type { Notification } from '@/types'
import { Bell, CheckCheck } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function NotificationsPage() {
  const [data, setData] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { setData(await getNotifications()) }
    catch { toast.error('Грешка при зареждане') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleMarkAll() {
    await markAllNotificationsRead()
    toast.success('Всички маркирани като прочетени')
    load()
  }

  async function handleRead(id: string) {
    await markNotificationRead(id)
    setData(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const unread = data.filter(n => !n.isRead).length

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Нотификации</span>
      </div>

      <div className="box max-w-3xl">
        <div className="box-header">
          <span className="box-title flex items-center gap-2">
            <Bell size={18} />
            Нотификации
            {unread > 0 && (
              <span className="label-danger ml-1">{unread} нови</span>
            )}
          </span>
          {unread > 0 && (
            <button onClick={handleMarkAll} className="btn-default btn-sm flex items-center gap-1">
              <CheckCheck size={14} /> Маркирай всички
            </button>
          )}
        </div>
        <div className="box-body p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="primary-spinner animate-spin w-8 h-8 border-4 rounded-full"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p>Няма нотификации</p>
            </div>
          ) : data.map(n => (
            <div key={n.id}
              onClick={() => !n.isRead && handleRead(n.id)}
              className={`flex items-start gap-4 px-4 py-4 border-b border-gray-100 transition-colors
                ${!n.isRead ? 'bg-blue-50 cursor-pointer hover:bg-blue-100' : 'bg-white'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                ${!n.isRead ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`}>
                <Bell size={16} className={!n.isRead ? 'text-white' : 'text-gray-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{n.createdAt?.replace('T', ' ').slice(0, 16)}</p>
              </div>
              {!n.isRead && (
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)] mt-1.5 flex-shrink-0"></span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
