'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, Users, Briefcase,
  Download, CreditCard, User, LogOut, Bell, Menu, X,
  ChevronRight
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { subscribeToNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/db'
import type { Notification } from '@/types'
import toast from 'react-hot-toast'

const MENU_ITEMS = [
  { label: 'Основно табло',  href: '/admin/dashboard',      icon: LayoutDashboard },
  { label: 'Списък Задачи', href: '/admin/tasks',           icon: CheckSquare },
  {
    label: 'Бенефициенти', icon: Users, children: [
      { label: 'Бенефициенти',        href: '/admin/beneficiaries' },
      { label: 'Заявки за дейности',  href: '/admin/requests' },
    ]
  },
  { label: 'Работодатели',  href: '/admin/employers',       icon: Briefcase },
  { label: 'Export',        href: '/admin/export',          icon: Download },
  { label: 'Export EPAY',   href: '/admin/export-epay',     icon: CreditCard },
  { label: 'Потребители',   href: '/admin/users',           icon: User },
]

interface Props {
  children: React.ReactNode
  userName?: string
}

export default function AdminLayout({ children, userName = 'Администратор' }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [openMenus, setOpenMenus] = useState<string[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prevUnreadCount = useRef(0)

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    const unsub = subscribeToNotifications(notifs => {
      setNotifications(notifs)
      const newUnread = notifs.filter(n => !n.isRead).length
      // звуков сигнал при нова нотификация
      if (newUnread > prevUnreadCount.current) {
        playSound('orders')
        document.title = `Нови съобщения: ${newUnread}`
      } else {
        document.title = 'Caritas Admin'
      }
      prevUnreadCount.current = newUnread
    })
    return () => unsub()
  }, [])

  function playSound(type: 'orders' | 'users' | 'contact') {
    const sounds: Record<string, string> = {
      orders: '/sounds/victory.mp3',
      users:  '/sounds/rimshot.mp3',
      contact:'/sounds/turndown.mp3',
    }
    const audio = new Audio(sounds[type] || sounds.orders)
    audio.play().catch(() => {})
  }

  async function handleLogout() {
    try {
      await logout()
      router.push('/auth/login')
    } catch {
      toast.error('Грешка при излизане')
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    toast.success('Всички маркирани като прочетени')
    setNotifOpen(false)
  }

  async function handleReadSingle(id: string) {
    await markNotificationRead(id)
  }

  function toggleMenu(label: string) {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    )
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#ecf0f5]">
      {/* ── SIDEBAR ── */}
      <aside
        className={`flex-shrink-0 h-full flex flex-col transition-all duration-300 overflow-y-auto
          ${sidebarOpen ? 'w-[230px]' : 'w-0 overflow-hidden'}`}
        style={{ background: '#222d32' }}
      >
        {/* Logo */}
        <div className="flex items-center px-4 py-3 border-b border-[#1a2226]"
          style={{ background: '#3c8dbc' }}>
          <Link href="/admin/dashboard" className="text-white font-bold text-xl tracking-wide">
            <span className="font-black">C</span>aritas
          </Link>
        </div>

        {/* User Panel */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1a2226]">
          <div className="w-9 h-9 rounded-full bg-[#3c8dbc] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-medium leading-tight">{userName}</p>
            <span className="flex items-center gap-1 text-[#00a65a] text-xs">
              <span className="w-2 h-2 rounded-full bg-[#00a65a] inline-block"></span>
              Online
            </span>
          </div>
        </div>

        {/* Section Header */}
        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: '#4b646f' }}>
          Администрация
        </div>

        {/* Menu */}
        <nav className="flex-1">
          {MENU_ITEMS.map(item => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                    style={{ color: '#8aa4af' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1e282c')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {item.icon && <item.icon size={16} className="flex-shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight size={14}
                      className={`transition-transform ${openMenus.includes(item.label) ? 'rotate-90' : ''}`} />
                  </button>
                  {openMenus.includes(item.label) && (
                    <div style={{ background: '#2c3b41' }}>
                      {item.children.map(child => (
                        <Link key={child.href} href={child.href}
                          className="flex items-center gap-3 pl-10 pr-4 py-2 text-sm transition-colors"
                          style={{
                            color: isActive(child.href) ? '#fff' : '#8aa4af',
                            background: isActive(child.href) ? '#1a2226' : 'transparent',
                          }}>
                          <ChevronRight size={12} />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link href={item.href!}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: isActive(item.href!) ? '#fff' : '#8aa4af',
                    background: isActive(item.href!) ? '#1a2226' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isActive(item.href!)) (e.currentTarget as HTMLElement).style.background = '#1e282c' }}
                  onMouseLeave={e => { if (!isActive(item.href!)) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {item.icon && <item.icon size={16} className="flex-shrink-0" />}
                  {item.label}
                </Link>
              )}
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-[#1a2226] my-2" />

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
            style={{ color: '#8aa4af' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e282c')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={16} />
            Изход
          </button>
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex items-center justify-between px-4 h-14 flex-shrink-0 shadow-sm z-10"
          style={{ background: '#3c8dbc' }}>
          <button onClick={() => setSidebarOpen(v => !v)}
            className="text-white p-1 hover:bg-[#367fa9] rounded transition-colors">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative text-white p-2 hover:bg-[#367fa9] rounded transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-[#dd4b39] text-white text-[10px] font-bold
                    rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded shadow-lg border border-gray-200 z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">
                      Имате {unreadCount} нови нотификации
                    </span>
                    <button onClick={handleMarkAllRead}
                      className="text-xs text-[#3c8dbc] hover:underline">
                      Маркирай всички
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-gray-500 text-sm py-4">Няма нотификации</p>
                    ) : notifications.map(n => (
                      <div key={n.id}
                        onClick={() => handleReadSingle(n.id)}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors
                          ${!n.isRead ? 'bg-blue-50' : ''}`}>
                        <Bell size={16} className="text-[#3c8dbc] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.createdAt.split('T')[0]}</p>
                        </div>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#3c8dbc] mt-1.5 flex-shrink-0"></span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t text-center">
                    <Link href="/admin/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-[#3c8dbc] hover:underline">
                      Виж всички нотификации
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <span className="text-white text-sm font-medium hidden sm:block px-2">
              {userName}
            </span>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
