'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getDashboardStats } from '@/lib/db'
import { Users, CheckSquare, Briefcase, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalRequests: number
  confirmedRequests: number
  pendingRequests: number
  rejectedRequests: number
  totalBeneficiaries: number
  totalTasks: number
  totalEmployers: number
}

function StatCard({ label, value, icon: Icon, color, href }: {
  label: string; value: number; icon: React.ElementType
  color: string; href?: string
}) {
  const content = (
    <div className={`box flex items-center p-4 gap-4 hover:shadow-md transition-shadow`}>
      <div className={`w-14 h-14 rounded flex items-center justify-center flex-shrink-0`}
        style={{ background: color }}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats().then(s => { setStats(s); setLoading(false) })
  }, [])

  return (
    <AdminLayout userName="Никол Траянова">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Основно табло</span>
      </div>

      <h1 className="text-2xl font-semibold text-gray-700 mb-6">Основно табло</h1>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="box p-4 animate-pulse h-20 bg-gray-100 rounded" />
          ))}
        </div>
      ) : stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Всички заявки"    value={stats.totalRequests}      icon={FileText}   color="#3c8dbc" href="/admin/requests" />
            <StatCard label="Потвърдени"        value={stats.confirmedRequests}  icon={CheckCircle} color="#00a65a" href="/admin/requests?status=Потвърдено" />
            <StatCard label="Чакащи"            value={stats.pendingRequests}    icon={Clock}       color="#f39c12" href="/admin/requests?status=Чакащ" />
            <StatCard label="Отхвърлени"        value={stats.rejectedRequests}   icon={XCircle}     color="#dd4b39" href="/admin/requests?status=Отхвърлено" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Бенефициенти"     value={stats.totalBeneficiaries} icon={Users}       color="#3c8dbc" href="/admin/beneficiaries" />
            <StatCard label="Задачи"            value={stats.totalTasks}         icon={CheckSquare} color="#00c0ef" href="/admin/tasks" />
            <StatCard label="Работодатели"      value={stats.totalEmployers}     icon={Briefcase}   color="#605ca8" href="/admin/employers" />
          </div>

          {/* Quick links */}
          <div className="box">
            <div className="box-header">
              <span className="box-title">Бързи действия</span>
            </div>
            <div className="box-body flex flex-wrap gap-3">
              <Link href="/admin/requests?add=1"     className="btn-primary">+ Нова заявка</Link>
              <Link href="/admin/beneficiaries?add=1" className="btn-success">+ Нов бенефициент</Link>
              <Link href="/admin/tasks?add=1"         className="btn-warning">+ Нова задача</Link>
              <Link href="/admin/employers?add=1"     className="btn-default">+ Нов работодател</Link>
              <Link href="/admin/export"              className="btn-default">↓ Експорт</Link>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
