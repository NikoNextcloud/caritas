'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { clearUsageCollection, getSupabaseUsage } from '@/lib/db'
import type { SupabaseUsage, SupabaseUsageCollection } from '@/lib/app-data'
import { AlertTriangle, Database, ExternalLink, HardDrive, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PROJECT_ID = 'urspuhgjjdhczxuapswz'
const DASHBOARD_URL = `https://supabase.com/dashboard/project/${PROJECT_ID}`
const USAGE_URL = 'https://supabase.com/dashboard/org/_/usage'
const CONFIRM_TEXT = 'ИЗТРИЙ'

const COLLECTION_LABELS: Record<string, string> = {
  beneficiaryRequests: 'Заявки за дейности', beneficiaries: 'Бенефициенти', schedule: 'График',
  tasks: 'Задачи', employers: 'Работодатели', volunteers: 'Доброволци', donors: 'Дарители',
  notifications: 'Известия', auditLogs: 'История',
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toLocaleString('bg-BG', { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`
}

function percent(used: number, limit: number) { return limit > 0 ? Math.min((used / limit) * 100, 100) : 0 }

function UsageCard({ title, used, limit, icon: Icon, note }: { title: string; used: number; limit: number; icon: React.ElementType; note: string }) {
  const usedPercent = percent(used, limit)
  const remaining = Math.max(limit - used, 0)
  const barColor = usedPercent >= 90 ? '#dd4b39' : usedPercent >= 70 ? '#f39c12' : 'var(--brand-primary)'
  return (
    <div className="box p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded flex items-center justify-center text-white" style={{ background: barColor }}><Icon size={20} /></div>
        <div><h2 className="font-semibold text-gray-800">{title}</h2><p className="text-xs text-gray-500">{note}</p></div>
      </div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <p className="text-xl font-bold text-gray-800">{formatBytes(used)} <span className="text-sm font-normal text-gray-500">от {formatBytes(limit)}</span></p>
        <span className="text-sm font-semibold text-gray-700">{usedPercent.toLocaleString('bg-BG', { maximumFractionDigits: 1 })}%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuenow={usedPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all" style={{ width: `${usedPercent}%`, background: barColor }} />
      </div>
      <p className="text-sm text-gray-600 mt-3">Остават приблизително <strong>{formatBytes(remaining)}</strong></p>
    </div>
  )
}

function DeleteDialog({ collection, busy, onClose, onDelete }: { collection: SupabaseUsageCollection; busy: boolean; onClose: () => void; onDelete: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  const label = COLLECTION_LABELS[collection.collectionName] || collection.collectionName
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
          <div><h2 className="text-lg font-semibold text-gray-900">Изтриване на „{label}“</h2><p className="text-sm text-gray-600 mt-1">Ще бъдат изтрити окончателно {collection.recordCount.toLocaleString('bg-BG')} записа. Това действие не може да бъде отменено.</p></div>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Напишете <strong>{CONFIRM_TEXT}</strong>, за да потвърдите:</label>
        <input className="form-input w-full" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoFocus />
        <div className="flex justify-end gap-3 mt-5">
          <button className="btn-default" onClick={onClose} disabled={busy}>Отказ</button>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50" onClick={onDelete} disabled={busy || confirmation !== CONFIRM_TEXT}>
            <Trash2 size={15} /> {busy ? 'Изтриване…' : 'Изтрий всички'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DatabasePage() {
  const [usage, setUsage] = useState<SupabaseUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SupabaseUsageCollection | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadUsage = useCallback(async () => {
    setError(''); setLoading(true)
    try { setUsage(await getSupabaseUsage()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Потреблението не може да бъде заредено') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadUsage() }, [loadUsage])
  const measuredAt = useMemo(() => usage?.measuredAt ? new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(usage.measuredAt)) : '', [usage?.measuredAt])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const deleted = await clearUsageCollection(deleteTarget.collectionName)
      toast.success(`Изтрити са ${deleted.toLocaleString('bg-BG')} записа`)
      setDeleteTarget(null)
      await loadUsage()
    } catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : 'Данните не бяха изтрити') }
    finally { setDeleting(false) }
  }

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">Supabase – потребление</span></div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div><h1 className="text-2xl font-semibold text-gray-700">Supabase – потребление</h1><p className="text-sm text-gray-500 mt-1">Безплатен план · проект {PROJECT_ID}</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-default inline-flex items-center gap-2" onClick={() => void loadUsage()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Обнови</button>
          <a className="btn-primary inline-flex items-center gap-2" href={USAGE_URL} target="_blank" rel="noreferrer">Месечен трафик <ExternalLink size={15} /></a>
        </div>
      </div>

      {error ? <div className="box p-5 text-sm text-red-700 bg-red-50 border-red-200 mb-6">{error}</div> : loading && !usage ? (
        <div className="grid md:grid-cols-2 gap-4 mb-6"><div className="box h-48 animate-pulse bg-gray-100" /><div className="box h-48 animate-pulse bg-gray-100" /></div>
      ) : usage && <>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <UsageCard title="PostgreSQL база данни" used={usage.databaseBytes} limit={usage.databaseLimitBytes} icon={Database} note="Лимитът от 500 MB е за целия проект" />
          <UsageCard title="Supabase Storage" used={usage.storageBytes} limit={usage.storageLimitBytes} icon={HardDrive} note={`${usage.storageObjects.toLocaleString('bg-BG')} файла · лимит 1 GB`} />
        </div>
        <div className="box p-4 mb-6 border-l-4" style={{ borderColor: 'var(--brand-primary)' }}>
          <div className="flex gap-3 items-start"><ShieldCheck size={20} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} /><div className="text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Защитено администраторско измерване</p>
            <p>Стойностите за базата и Storage се измерват директно в Supabase. Месечният трафик, Realtime и останалите квоти се виждат от бутона „Месечен трафик“ в официалното Supabase табло.</p>
            <p className="text-xs text-gray-500 mt-1">Последно измерване: {measuredAt}</p>
          </div></div>
        </div>
        <div className="box mb-6 overflow-hidden">
          <div className="box-header flex items-center justify-between gap-3"><span className="box-title">Данни по категории</span><span className="text-sm text-gray-500">Общо {usage.totalRecords.toLocaleString('bg-BG')} записа</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-4 py-3">Категория</th><th className="text-right px-4 py-3">Записи</th><th className="text-right px-4 py-3">Размер на данните</th><th className="text-right px-4 py-3">Действие</th></tr></thead>
            <tbody className="divide-y divide-gray-200">{usage.collections.map(collection => <tr key={collection.collectionName} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{COLLECTION_LABELS[collection.collectionName] || collection.collectionName}</td>
              <td className="px-4 py-3 text-right text-gray-700">{collection.recordCount.toLocaleString('bg-BG')}</td>
              <td className="px-4 py-3 text-right text-gray-500">{formatBytes(collection.dataBytes)}</td>
              <td className="px-4 py-3 text-right"><button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setDeleteTarget(collection)} disabled={collection.recordCount === 0}><Trash2 size={14} /> Изтрий</button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">Потребителските профили и системното присъствие са защитени и не могат да се изтриват от този екран. Изтриването на записи не намалява непременно размера веднага — PostgreSQL освобождава физическото място при поддръжка.</div>
        </div>
      </>}

      <div className="box"><div className="box-header"><span className="box-title">Supabase управление</span></div><div className="box-body flex flex-wrap gap-3">
        <a className="btn-default inline-flex items-center gap-2" href={DASHBOARD_URL} target="_blank" rel="noreferrer">Проект <ExternalLink size={14} /></a>
        <a className="btn-default inline-flex items-center gap-2" href={`${DASHBOARD_URL}/editor`} target="_blank" rel="noreferrer">База данни <ExternalLink size={14} /></a>
        <a className="btn-default inline-flex items-center gap-2" href={`${DASHBOARD_URL}/storage/files`} target="_blank" rel="noreferrer">Storage <ExternalLink size={14} /></a>
      </div></div>
      {deleteTarget && <DeleteDialog collection={deleteTarget} busy={deleting} onClose={() => setDeleteTarget(null)} onDelete={() => void handleDelete()} />}
    </AdminLayout>
  )
}
