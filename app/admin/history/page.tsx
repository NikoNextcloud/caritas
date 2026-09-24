'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getAuditLogs } from '@/lib/db'
import type { AuditAction, AuditLog, UserRole } from '@/types'
import { Eye, History, LogIn, PencilLine, RefreshCcw, Search, ShieldCheck } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Вход',
  logout: 'Изход',
  view: 'Преглед',
  create: 'Създаване',
  update: 'Промяна',
  delete: 'Изтриване',
  import: 'Импорт',
  role_change: 'Промяна на роля',
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  editor: 'Редактор',
  user: 'Потребител',
  operator: 'Оператор',
  viewer: 'Преглед',
}

const ENTITY_LABELS: Record<string, string> = {
  session: 'Система',
  page: 'Страница',
  beneficiary: 'Бенефициент',
  beneficiaryRequest: 'Заявка',
  task: 'Задача',
  schedule: 'График',
  employer: 'Работодател',
  volunteer: 'Доброволец',
  donor: 'Дарител',
  user: 'Потребител',
  import: 'Импорт',
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')

  async function load() {
    setLoading(true)
    try {
      setLogs(await getAuditLogs(500))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Историята не може да бъде заредена')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const actors = useMemo(() => Array.from(new Set(logs.map(log => log.actorName))).sort((a, b) => a.localeCompare(b, 'bg')), [logs])
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('bg-BG')
    return logs.filter(log => {
      if (actor && log.actorName !== actor) return false
      if (action && log.action !== action) return false
      if (!needle) return true
      return [log.actorName, log.description, log.entityType, log.entityId, log.path, ...(log.changedFields || [])]
        .filter(Boolean).some(value => String(value).toLocaleLowerCase('bg-BG').includes(needle))
    })
  }, [action, actor, logs, search])

  const changes = logs.filter(log => ['create', 'update', 'delete', 'import', 'role_change'].includes(log.action)).length
  const uniqueUsers = new Set(logs.map(log => log.actorUid)).size

  return <AdminLayout>
    <Toaster position="top-right" />
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">История</span></div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <Summary icon={<History size={20} />} label="Последни събития" value={logs.length} />
      <Summary icon={<PencilLine size={20} />} label="Промени" value={changes} />
      <Summary icon={<Eye size={20} />} label="Отваряния на страници" value={logs.filter(log => log.action === 'view').length} />
      <Summary icon={<LogIn size={20} />} label="Активни потребители в историята" value={uniqueUsers} />
    </div>

    <div className="box">
      <div className="box-header flex-wrap gap-3">
        <div>
          <span className="box-title flex items-center gap-2"><ShieldCheck size={18} /> История на действията</span>
          <p className="text-xs text-gray-500 mt-1">Вижда се само от администратор. Показват се последните 500 събития.</p>
        </div>
        <button className="btn-default" onClick={() => void load()} disabled={loading}><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> Обнови</button>
      </div>
      <div className="box-body">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_230px_210px] gap-3 mb-4">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="form-control pl-9" placeholder="Търси по потребител, действие, запис или поле..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select className="form-control" value={actor} onChange={event => setActor(event.target.value)}><option value="">Всички потребители</option>{actors.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <select className="form-control" value={action} onChange={event => setAction(event.target.value as AuditAction | '')}><option value="">Всички действия</option>{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm min-w-[1050px]">
            <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3 text-left">Дата и час</th><th className="p-3 text-left">Потребител</th><th className="p-3 text-left">Действие</th><th className="p-3 text-left">Раздел / запис</th><th className="p-3 text-left">Описание</th><th className="p-3 text-left">Променени полета</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">Зареждане...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">Няма намерени събития</td></tr> : filtered.map(log => <tr key={log.id} className="border-t border-gray-200 odd:bg-white even:bg-gray-50/60 align-top">
                <td className="p-3 whitespace-nowrap text-gray-600">{formatDate(log.createdAt)}</td>
                <td className="p-3"><span className="font-semibold text-gray-900 block">{log.actorName}</span><span className="text-xs text-gray-500">{ROLE_LABELS[log.actorRole] || log.actorRole}</span></td>
                <td className="p-3"><ActionBadge action={log.action} /></td>
                <td className="p-3"><span className="font-medium text-gray-800 block">{ENTITY_LABELS[log.entityType] || log.entityType}</span>{log.entityId && <span className="text-xs text-gray-500 break-all">ID: {log.entityId}</span>}{log.path && <span className="text-xs text-gray-500 block break-all">{log.path}</span>}</td>
                <td className="p-3 text-gray-700">{log.description}</td>
                <td className="p-3 text-xs text-gray-600">{log.changedFields?.length ? log.changedFields.join(', ') : '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">Показани: {filtered.length} от {logs.length} събития</p>
      </div>
    </div>
  </AdminLayout>
}

function Summary({ icon, label, value }: { icon: ReactNode, label: string, value: number }) {
  return <div className="box p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-red-50 text-[var(--brand-primary)] flex items-center justify-center">{icon}</div><div><span className="text-2xl font-bold text-gray-900 block leading-none">{value}</span><span className="text-xs text-gray-500">{label}</span></div></div>
}

function ActionBadge({ action }: { action: AuditAction }) {
  const colors: Record<AuditAction, string> = {
    login: 'bg-green-100 text-green-800', logout: 'bg-gray-200 text-gray-700', view: 'bg-blue-100 text-blue-800',
    create: 'bg-emerald-100 text-emerald-800', update: 'bg-amber-100 text-amber-800', delete: 'bg-red-100 text-red-800',
    import: 'bg-purple-100 text-purple-800', role_change: 'bg-orange-100 text-orange-800',
  }
  return <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${colors[action]}`}>{ACTION_LABELS[action]}</span>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}
