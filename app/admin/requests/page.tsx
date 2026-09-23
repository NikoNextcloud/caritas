'use client'
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import { getRequests, addRequest, updateRequest, deleteRequests } from '@/lib/db'
import type { BeneficiaryRequest, RequestStatus, CaseEntry, SearchParams } from '@/types'
import { Search, Plus, Download, RefreshCw } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { exportToCSV } from '@/lib/export'

const STATUSES: RequestStatus[] = ['Потвърдено', 'Отхвърлено', 'Чакащ', 'Приключен']

const EMPTY_REQUEST: Partial<BeneficiaryRequest> = {
  activity: '', message: '', status: 'Чакащ', beneficiaryName: '', beneficiaryId: '',
}

function CaseField({ label, value, onChange }: {
  label: string
  value?: CaseEntry
  onChange: (v: CaseEntry) => void
}) {
  const v = value ?? { date: '', operator: '', description: '' }
  return (
    <div className="border border-gray-200 rounded p-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{label}</p>
      <div className="space-y-2">
        <input type="date" className="form-control text-xs"
          value={v.date}
          onChange={e => onChange({ ...v, date: e.target.value })} />
        <input type="text" placeholder="Оператор" className="form-control text-xs"
          value={v.operator}
          onChange={e => onChange({ ...v, operator: e.target.value })} />
        <textarea placeholder="Описание" className="form-control text-xs resize-none" rows={2}
          value={v.description}
          onChange={e => onChange({ ...v, description: e.target.value })} />
      </div>
    </div>
  )
}

export default function RequestsPage() {
  const [data, setData]               = useState<BeneficiaryRequest[]>([])
  const [loading, setLoading]         = useState(true)
  const [editModal, setEditModal]     = useState(false)
  const [searchModal, setSearchModal] = useState(false)
  const [editing, setEditing]         = useState<Partial<BeneficiaryRequest>>(EMPTY_REQUEST)
  const [isNew, setIsNew]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [search, setSearch]           = useState<SearchParams>({})
  const [quickSearch, setQuickSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRequests({ search })
      setData(res.data)
    } catch (err) {
      console.error('Load error:', err)
      // Ако няма индекс — зареди без orderBy
      try {
        const res = await getRequests({ search: {} })
        setData(res.data)
        toast.error('Заредено без филтри — създай Firestore индекс')
      } catch (err2) {
        console.error('Fallback error:', err2)
        toast.error('Грешка при зареждане — провери Firestore правилата')
      }
    }
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(EMPTY_REQUEST)
    setIsNew(true)
    setEditModal(true)
  }

  function openEdit(row: BeneficiaryRequest) {
    setEditing({ ...row })
    setIsNew(false)
    setEditModal(true)
  }

  async function handleSave() {
    if (!editing.activity || !editing.beneficiaryName) {
      toast.error('Попълнете задължителните полета (Дейност и Бенефициент)')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await addRequest(editing as Omit<BeneficiaryRequest, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Заявката е добавена!')
      } else {
        await updateRequest(editing.id!, editing)
        toast.success('Заявката е обновена!')
      }
      setEditModal(false)
      load()
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Грешка при запис — провери Firestore правилата')
    }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      await deleteRequests(ids)
      toast.success(`${ids.length} записа изтрити`)
      load()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Грешка при изтриване')
    }
  }

  // Quick search filter (client-side)
  const filtered = quickSearch
    ? data.filter(r =>
        r.beneficiaryName?.toLowerCase().includes(quickSearch.toLowerCase()) ||
        r.activity?.toLowerCase().includes(quickSearch.toLowerCase()) ||
        r.operator?.toLowerCase().includes(quickSearch.toLowerCase()) ||
        r.requestType?.toLowerCase().includes(quickSearch.toLowerCase()) ||
        String(r.id).includes(quickSearch)
      )
    : data

  const columns = [
    {
      key: 'id', label: 'Id', width: '70px',
      render: (r: BeneficiaryRequest) => <span className="text-xs text-gray-500 font-mono">{r.id.slice(0,6)}</span>
    },
    {
      key: 'activity', label: 'Дейност',
      render: (r: BeneficiaryRequest) => (
        <span className="text-xs line-clamp-2 block max-w-[200px]" title={r.activity}>{r.activity}</span>
      )
    },
    { key: 'message', label: 'Съобщение', width: '90px' },
    { key: 'requestType', label: 'Тип' },
    { key: 'operator', label: 'От потребител' },
    { key: 'vulnerability', label: 'Уязвимост' },
    {
      key: 'case1', label: 'Case 1',
      render: (r: BeneficiaryRequest) => r.case1 ? (
        <span className="text-xs block max-w-[180px] line-clamp-2 text-gray-600" title={r.case1.description}>
          {r.case1.date} — {r.case1.operator}<br/>
          <span className="text-gray-400">{r.case1.description?.slice(0, 50)}{r.case1.description?.length > 50 ? '…' : ''}</span>
        </span>
      ) : null
    },
    {
      key: 'case2', label: 'Case 2',
      render: (r: BeneficiaryRequest) => r.case2 ? (
        <span className="text-xs text-gray-500">{r.case2.date}</span>
      ) : null
    },
    {
      key: 'case3', label: 'Case 3',
      render: (r: BeneficiaryRequest) => r.case3 ? (
        <span className="text-xs text-gray-500">{r.case3.date}</span>
      ) : null
    },
    {
      key: 'case4', label: 'Case 4',
      render: (r: BeneficiaryRequest) => r.case4 ? (
        <span className="text-xs text-gray-500">{r.case4.date}</span>
      ) : null
    },
    {
      key: 'case5', label: 'Case 5',
      render: (r: BeneficiaryRequest) => r.case5 ? (
        <span className="text-xs text-gray-500">{r.case5.date}</span>
      ) : null
    },
    {
      key: 'case6', label: 'Case 6',
      render: (r: BeneficiaryRequest) => r.case6 ? (
        <span className="text-xs text-gray-500">{r.case6.date}</span>
      ) : null
    },
    {
      key: 'status', label: 'Статус', width: '110px',
      render: (r: BeneficiaryRequest) => <StatusBadge status={r.status} />
    },
    { key: 'beneficiaryName', label: 'Бенефициент' },
  ]

  return (
    <AdminLayout>
      <Toaster position="top-right" />

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Бенефициенти заявки за дейности</span>
      </div>

      <div className="box">
        <div className="box-header">
          <span className="box-title">Бенефициенти Заявки За Дейности</span>
          <span className="text-sm text-gray-400">Бенефициенти заявки за дейности</span>
        </div>
        <div className="box-body">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="Търси по id, бенефициент, дейност..."
              className="form-control max-w-xs"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
            />
            <button onClick={() => setSearchModal(true)} className="btn-default btn-sm p-2" title="Разширено търсене">
              <Search size={15} />
            </button>
            <button onClick={load} className="btn-default btn-sm p-2" title="Опресни">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="flex-1" />
            <button onClick={openNew} className="btn-primary">
              <Plus size={15} /> Добави
            </button>
            <button onClick={() => exportToCSV(filtered)} className="btn-default">
              <Download size={15} /> Export
            </button>
          </div>

          {/* Резултати брой */}
          {!loading && (
            <p className="text-xs text-gray-400 mb-3">
              {filtered.length} записа{quickSearch ? ` (филтрирани от ${data.length})` : ''}
            </p>
          )}

          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* ── EDIT / ADD MODAL ── */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={isNew ? 'Добавяне на заявка' : `Редакция на заявка`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group md:col-span-2">
              <label className="form-label">Дейност *</label>
              <input type="text" className="form-control"
                value={editing.activity ?? ''}
                onChange={e => setEditing(v => ({ ...v, activity: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Съобщение (локация)</label>
              <input type="text" className="form-control"
                value={editing.message ?? ''}
                onChange={e => setEditing(v => ({ ...v, message: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Бенефициент *</label>
              <input type="text" className="form-control"
                value={editing.beneficiaryName ?? ''}
                onChange={e => setEditing(v => ({ ...v, beneficiaryName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-control"
                value={editing.status ?? 'Чакащ'}
                onChange={e => setEditing(v => ({ ...v, status: e.target.value as RequestStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Тип</label>
              <input type="text" className="form-control" value={editing.requestType ?? ''}
                onChange={e => setEditing(v => ({ ...v, requestType: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">От потребител</label>
              <input type="text" className="form-control" value={editing.operator ?? ''}
                onChange={e => setEditing(v => ({ ...v, operator: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Тагове</label>
              <input type="text" className="form-control" value={editing.tags ?? ''}
                onChange={e => setEditing(v => ({ ...v, tags: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Уязвимост</label>
              <input type="text" className="form-control" value={editing.vulnerability ?? ''}
                onChange={e => setEditing(v => ({ ...v, vulnerability: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">Коментар</label>
              <textarea className="form-control" rows={2} value={editing.comment ?? ''}
                onChange={e => setEditing(v => ({ ...v, comment: e.target.value }))} />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-semibold text-gray-700 mb-3">Случаи (Cases)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([1,2,3,4,5,6] as const).map(n => (
                <CaseField
                  key={n}
                  label={`Case ${n}`}
                  value={editing[`case${n}` as keyof typeof editing] as CaseEntry | undefined}
                  onChange={v => setEditing(prev => ({ ...prev, [`case${n}`]: v }))}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <button onClick={() => setEditModal(false)} className="btn-default">Откажи</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Запис...</span>
                : isNew ? 'Добави' : 'Запази'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── SEARCH MODAL ── */}
      <Modal open={searchModal} onClose={() => setSearchModal(false)} title="Разширено търсене" size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">ID</label>
            <input type="text" className="form-control"
              value={search.id ?? ''}
              onChange={e => setSearch(v => ({ ...v, id: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Бенефициент</label>
            <input type="text" className="form-control"
              value={search.beneficiary ?? ''}
              onChange={e => setSearch(v => ({ ...v, beneficiary: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Дейност</label>
            <input type="text" className="form-control"
              value={search.activity ?? ''}
              onChange={e => setSearch(v => ({ ...v, activity: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Статус</label>
            <select className="form-control"
              value={search.status ?? ''}
              onChange={e => setSearch(v => ({ ...v, status: e.target.value as RequestStatus | '' }))}>
              <option value="">Всички</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">От дата</label>
              <input type="date" className="form-control"
                value={search.dateFrom ?? ''}
                onChange={e => setSearch(v => ({ ...v, dateFrom: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">До дата</label>
              <input type="date" className="form-control"
                value={search.dateTo ?? ''}
                onChange={e => setSearch(v => ({ ...v, dateTo: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <button onClick={() => { setSearch({}); setSearchModal(false) }} className="btn-default">Изчисти</button>
            <button onClick={() => { setSearchModal(false); load() }} className="btn-primary">Търси</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
