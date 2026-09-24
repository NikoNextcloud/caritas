'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, Briefcase, CalendarDays, CheckSquare, ChevronRight, Download, HandHeart,
  HeartHandshake, LayoutDashboard, LogOut, Menu, Upload, User, Users,
} from 'lucide-react'
import { getAdminUser, logout, onAuth, startPresenceTracking } from '@/lib/auth'
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications, subscribeToOnlineUsers } from '@/lib/db'
import type { AdminUser, Notification, UserRole } from '@/types'
import toast from 'react-hot-toast'

interface MenuItem {
  label: string
  href?: string
  icon?: React.ElementType
  adminOnly?: boolean
  children?: { label: string; href: string }[]
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Основно табло', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Списък Задачи', href: '/admin/tasks', icon: CheckSquare },
  { label: 'График', href: '/admin/schedule', icon: CalendarDays },
  {
    label: 'Бенефициенти', icon: Users, children: [
      { label: 'Бенефициенти', href: '/admin/beneficiaries' },
      { label: 'Заявки за дейности', href: '/admin/requests' },
    ],
  },
  { label: 'Работодатели', href: '/admin/employers', icon: Briefcase },
  { label: 'Доброволци', href: '/admin/volunteers', icon: HeartHandshake },
  { label: 'Дарители', href: '/admin/donors', icon: HandHeart },
  { label: 'Export', href: '/admin/export', icon: Download },
  { label: 'Потребители', href: '/admin/users', icon: User, adminOnly: true },
  { label: 'Импорт', href: '/admin/import', icon: Upload, adminOnly: true },
]

interface Props {
  children: React.ReactNode
  userName?: string
}

export default function AdminLayout({ children, userName = 'Потребител' }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [openMenus, setOpenMenus] = useState<string[]>([])
  const [displayName, setDisplayName] = useState(userName)
  const [role, setRole] = useState<UserRole>('user')
  const [authReady, setAuthReady] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<AdminUser[]>([])
  const [presenceName, setPresenceName] = useState('')
  const [clock, setClock] = useState(Date.now())
  const prevUnreadCount = useRef(0)

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => onAuth(async user => {
    if (!user) {
      router.replace('/auth/login')
      return
    }
    const profile = await getAdminUser(user.uid)
    const name = profile?.displayName || user.displayName || user.email || userName
    setDisplayName(name)
    setPresenceName(name)
    setRole(profile?.role || 'user')
    setAuthReady(true)
  }), [router, userName])

  useEffect(() => {
    if (!authReady) return
    return subscribeToOnlineUsers(setOnlineUsers, () => setOnlineUsers([]))
  }, [authReady])

  useEffect(() => {
    if (!authReady || !presenceName) return
    return startPresenceTracking(presenceName)
  }, [authReady, presenceName])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!authReady) return
    const unsubscribe = subscribeToNotifications(notifs => {
      setNotifications(notifs)
      const currentUnread = notifs.filter(n => !n.isRead).length
      if (currentUnread > prevUnreadCount.current) new Audio('/sounds/victory.mp3').play().catch(() => {})
      document.title = currentUnread ? `Нови съобщения: ${currentUnread}` : 'Caritas Admin'
      prevUnreadCount.current = currentUnread
    })
    return unsubscribe
  }, [authReady])

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
    setNotifOpen(false)
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const activeOnlineUsers = onlineUsers.filter(user => {
    const seenAt = Date.parse(user.lastSeen || '')
    return user.isOnline && Number.isFinite(seenAt) && clock - seenAt < 5 * 60_000
  })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--content-bg)' }}>
      <aside className={`flex-shrink-0 h-full flex flex-col transition-all duration-300 overflow-y-auto ${sidebarOpen ? 'w-[230px]' : 'w-0 overflow-hidden'}`}
        style={{ background: 'var(--sidebar-bg)' }}>
        <div className="flex items-center gap-3 px-4 py-2 border-b border-black/20" style={{ background: 'var(--brand-primary)' }}>
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Caritas Logo" width={36} height={36}
              className="rounded bg-white flex-shrink-0 object-contain" />
            <span className="text-white font-bold text-xl tracking-wide"><span className="font-black">C</span>aritas</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 px-4 py-4 border-b border-black/20">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'var(--brand-primary)' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium leading-tight truncate">{displayName}</p>
            <span className="flex items-center gap-1 text-[#00a65a] text-xs">
              <span className="w-2 h-2 rounded-full bg-[#00a65a] inline-block" /> Online
            </span>
          </div>
        </div>

        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sidebar-header)' }}>Администрация</div>
        <nav className="flex-1">
          {MENU_ITEMS.filter(item => !item.adminOnly || role === 'admin').map(item => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button onClick={() => setOpenMenus(prev => prev.includes(item.label) ? prev.filter(x => x !== item.label) : [...prev, item.label])}
                    className="sidebar-nav-item w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left"
                    style={{ color: 'var(--sidebar-text)' }}>
                    {item.icon && <item.icon size={16} />}
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight size={14} className={`transition-transform ${openMenus.includes(item.label) ? 'rotate-90' : ''}`} />
                  </button>
                  {openMenus.includes(item.label) && (
                    <div style={{ background: 'var(--sidebar-hover)' }}>
                      {item.children.map(child => (
                        <Link key={child.href} href={child.href}
                          className="flex items-center gap-3 pl-10 pr-4 py-2 text-sm"
                          style={{ color: isActive(child.href) ? '#fff' : 'var(--sidebar-text)', background: isActive(child.href) ? 'var(--sidebar-active)' : 'transparent' }}>
                          <ChevronRight size={12} /> {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link href={item.href!} className="sidebar-nav-item flex items-center gap-3 px-4 py-2.5 text-sm"
                  style={{ color: isActive(item.href!) ? '#fff' : 'var(--sidebar-text)', background: isActive(item.href!) ? 'var(--sidebar-active)' : 'transparent' }}>
                  {item.icon && <item.icon size={16} />} {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--sidebar-text)' }}>Потребители на линия</p>
          <div className="space-y-2 max-h-28 overflow-y-auto">
            {activeOnlineUsers.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--sidebar-text)' }}>Няма потребители на линия</p>
            ) : activeOnlineUsers.map(user => (
              <div key={user.uid} className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#00a65a] flex-shrink-0" />
                <span className="text-xs text-white truncate" title={user.displayName}>{user.displayName}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} className="border-t border-white/10 w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-black/10" style={{ color: 'var(--sidebar-text)' }}>
          <LogOut size={16} /> Изход
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 h-14 flex-shrink-0 shadow-sm z-10" style={{ background: 'var(--header-bg)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)} className="text-white p-1 hover:bg-black/10 rounded"><Menu size={20} /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setNotifOpen(v => !v)} className="relative text-white p-2 hover:bg-black/10 rounded">
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 bg-[#dd4b39] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded shadow-lg border border-gray-200 z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Имате {unreadCount} нови нотификации</span>
                    <button onClick={handleMarkAllRead} className="text-xs text-[var(--brand-primary)] hover:underline">Маркирай всички</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? <p className="text-center text-gray-500 text-sm py-4">Няма нотификации</p> : notifications.map(n => (
                      <button key={n.id} onClick={() => markNotificationRead(n.id)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50' : ''}`}>
                        <Bell size={16} className="text-[var(--brand-primary)] mt-0.5" />
                        <span className="min-w-0"><span className="block text-sm font-medium text-gray-800 truncate">{n.title}</span><span className="text-xs text-gray-500">{n.createdAt?.split('T')[0]}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-white text-sm font-medium hidden sm:block px-2">{displayName}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {authReady ? children : <div className="flex items-center justify-center h-full"><div className="primary-spinner animate-spin w-9 h-9 border-4 rounded-full" /></div>}
        </main>
      </div>
    </div>
  )
}
