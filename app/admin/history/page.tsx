'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { clearAuditHistory, getAuditLogs } from '@/lib/db'
import type { AuditAction, AuditLog, UserRole } from '@/types'
import { ChevronLeft, ChevronRight, Eye, History, LogIn, PencilLine, RefreshCcw, Search, ShieldCheck, Trash2 } from 'lucide-react'
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
  auditHistory: 'История',
}

const PAGE_SIZE = 50

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [search, setSearch] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')

  async function load() {
    setLoading(true)
    try {
      setLogs(await getAuditLogs())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Историята не може да бъде заредена')
    } finally {
      setLoading(false)
    }
  }

  async function clearHistory() {
    if (clearing) return
    const confirmed = window.confirm('Сигурни ли сте, че искате да изтриете цялата история? Това действие не може да бъде отменено.')
    if (!confirmed) return

    setClearing(true)
    try {
      const deleted = await clearAuditHistory()
      setSearch('')
      setActor('')
      setAction('')
      await load()
      toast.success(`Изтрити са ${deleted} събития. Действието е записано в новата история.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Историята не може да бъде изтрита')
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => { void load() }, [])

  const actors = useMemo(() => Array.from(new Map(logs.map(log => [log.actorUid, {
    uid: log.actorUid,
    name: log.actorName,
    email: log.actorEmail || '',
  }])).values()).sort((a, b) => a.name.localeCompare(b.name, 'bg')), [logs])
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('bg-BG')
    return logs.filter(log => {
      if (actor && log.actorUid !== actor) return false
      if (action && log.action !== action) return false
      if (!needle) return true
      return [log.actorName, log.actorEmail, log.actorUid, log.actorRole, log.description, log.entityType, log.entityId, log.path, ...(log.changedFields || [])]
        .filter(Boolean).some(value => String(value).toLocaleLowerCase('bg-BG').includes(needle))
    })
  }, [action, actor, logs, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleLogs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
    setPageInput('1')
  }, [action, actor, search])

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  function goToPage(value: string) {
    const requested = Number.parseInt(value, 10)
    const target = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), totalPages) : currentPage
    setPage(target)
    setPageInput(String(target))
  }

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
          <p className="text-xs text-gray-500 mt-1">Вижда се само от администратор. Показват се събитията на всички потребители.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-default" onClick={() => void load()} disabled={loading || clearing}><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> Обнови</button>
          <button className="btn-default text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50" onClick={() => void clearHistory()} disabled={loading || clearing || logs.length === 0}><Trash2 size={16} /> {clearing ? 'Изтриване...' : 'Изтрий историята'}</button>
        </div>
      </div>
      <div className="box-body">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_230px_210px] gap-3 mb-4">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="form-control pl-9" placeholder="Търси по потребител, действие, запис или поле..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select className="form-control" value={actor} onChange={event => setActor(event.target.value)}><option value="">Всички потребители</option>{actors.map(item => <option key={item.uid} value={item.uid}>{item.name}{item.email ? ` · ${item.email}` : ''}</option>)}</select>
          <select className="form-control" value={action} onChange={event => setAction(event.target.value as AuditAction | '')}><option value="">Всички действия</option>{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm min-w-[1050px]">
            <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3 text-left">Дата и час</th><th className="p-3 text-left">Потребител</th><th className="p-3 text-left">Действие</th><th className="p-3 text-left">Раздел / запис</th><th className="p-3 text-left">Описание</th><th className="p-3 text-left">Променени полета</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">Зареждане...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-gray-500">Няма намерени събития</td></tr> : visibleLogs.map(log => <tr key={log.id} className="border-t border-gray-200 odd:bg-white even:bg-gray-50/60 align-top">
                <td className="p-3 whitespace-nowrap text-gray-600">{formatDate(log.createdAt)}</td>
                <td className="p-3"><span className="font-semibold text-gray-900 block">{log.actorName}</span>{log.actorEmail && <span className="text-xs text-gray-600 block break-all">{log.actorEmail}</span>}<span className="text-xs text-gray-500 block">{ROLE_LABELS[log.actorRole] || log.actorRole}</span><span className="text-[10px] text-gray-400 block break-all" title="Уникален потребителски номер">UID: {log.actorUid}</span></td>
                <td className="p-3"><ActionBadge action={log.action} /></td>
                <td className="p-3"><span className="font-medium text-gray-800 block">{ENTITY_LABELS[log.entityType] || log.entityType}</span>{log.entityId && <span className="text-xs text-gray-500 break-all">ID: {log.entityId}</span>}{log.path && <span className="text-xs text-gray-500 block break-all">{log.path}</span>}</td>
                <td className="p-3 text-gray-700">{log.description}</td>
                <td className="p-3 text-xs text-gray-600">{log.changedFields?.length ? log.changedFields.join(', ') : '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Показани: {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} от {filtered.length} намерени · общо {logs.length} събития</p>
          {totalPages > 1 && <div className="flex items-center gap-2">
            <button className="btn-default btn-sm disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16} /> Назад</button>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">Страница
              <input type="number" min={1} max={totalPages} value={pageInput} onChange={event => setPageInput(event.target.value)} onBlur={event => goToPage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); goToPage(event.currentTarget.value); event.currentTarget.blur() } }} className="h-8 w-16 rounded border border-gray-300 bg-white px-2 text-center text-sm text-gray-800 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]" aria-label={`Отиди на страница от 1 до ${totalPages}`} /> от {totalPages}
            </label>
            <button className="btn-default btn-sm disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Напред <ChevronRight size={16} /></button>
          </div>}
        </div>
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
