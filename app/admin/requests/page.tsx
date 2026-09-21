'use client'
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import { getRequests, addRequest, updateRequest, deleteRequests, updateRequestStatus } from '@/lib/db'
import type { BeneficiaryRequest, RequestStatus, CaseEntry, SearchParams } from '@/types'
import { Search, Plus, Download } from 'lucide-react'
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
  return (
    <div className="border border-gray-200 rounded p-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className="form-control text-xs"
          value={value?.date ?? ''}
          onChange={e => onChange({ ...value, date: e.target.value, operator: value?.operator ?? '', description: value?.description ?? '' })} />
        <input type="text" placeholder="Оператор" className="form-control text-xs"
          value={value?.operator ?? ''}
          onChange={e => onChange({ ...value, operator: e.target.value, date: value?.date ?? '', description: value?.description ?? '' })} />
        <textarea placeholder="Описание" className="form-control text-xs col-span-2 resize-none" rows={2}
          value={value?.description ?? ''}
          onChange={e => onChange({ ...value, description: e.target.value, date: value?.date ?? '', operator: value?.operator ?? '' })} />
      </div>
    </div>
  )
}

export default function RequestsPage() {
  const [data, setData] = useState<BeneficiaryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [searchModal, setSearchModal] = useState(false)
  const [editing, setEditing] = useState<Partial<BeneficiaryRequest>>(EMPTY_REQUEST)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState<SearchParams>({})
  const [quickSearch, setQuickSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRequests({ search })
      setData(res.data)
    } catch { toast.error('Грешка при зареждане') }
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
      toast.error('Попълнете задължителните полета')
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
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      await deleteRequests(ids)
      toast.success(`${ids.length} записа изтрити`)
      load()
    } catch { toast.error('Грешка при изтриване') }
  }

  // Quick search filter
  const filtered = quickSearch
    ? data.filter(r =>
        r.beneficiaryName.toLowerCase().includes(quickSearch.toLowerCase()) ||
        r.activity.toLowerCase().includes(quickSearch.toLowerCase()) ||
        String(r.id).includes(quickSearch)
      )
    : data

  const columns = [
    { key: 'id', label: 'Id', width: '80px' },
    { key: 'activity', label: 'Дейност', render: (r: BeneficiaryRequest) => (
      <span className="line-clamp-2 max-w-xs text-xs">{r.activity}</span>
    )},
    { key: 'message', label: 'Съобщение', width: '100px' },
    { key: 'case1', label: 'Case 1', render: (r: BeneficiaryRequest) => (
      <span className="text-xs line-clamp-3 max-w-[200px]">{r.case1 ? `${r.case1.date} - ${r.case1.operator} - ${r.case1.description}` : ''}</span>
    )},
    { key: 'case2', label: 'Case 2', render: (r: BeneficiaryRequest) => (
      <span className="text-xs line-clamp-2 max-w-[180px]">{r.case2 ? `${r.case2.date} - ${r.case2.description}` : ''}</span>
    )},
    { key: 'case3', label: 'Case 3', render: (r: BeneficiaryRequest) => (
      <span className="text-xs">{r.case3?.date ?? ''}</span>
    )},
    { key: 'case4', label: 'Case 4', render: (r: BeneficiaryRequest) => (
      <span className="text-xs">{r.case4?.date ?? ''}</span>
    )},
    { key: 'case5', label: 'Case 5', render: (r: BeneficiaryRequest) => (
      <span className="text-xs">{r.case5?.date ?? ''}</span>
    )},
    { key: 'case6', label: 'Case 6', render: (r: BeneficiaryRequest) => (
      <span className="text-xs">{r.case6?.date ?? ''}</span>
    )},
    { key: 'status', label: 'Статус', render: (r: BeneficiaryRequest) => <StatusBadge status={r.status} /> },
    { key: 'beneficiaryName', label: 'Бенефициент' },
  ]

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Бенефициенти заявки за дейности</span>
      </div>

      <div className="box">
        <div className="box-header">
          <span className="box-title">Бенефициенти Заявки За Дейности</span>
          <span className="text-sm text-gray-500">Бенефициенти заявки за дейности</span>
        </div>
        <div className="box-body">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                placeholder="Търси в полетата: id"
                className="form-control max-w-xs"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
              />
              <button onClick={() => setSearchModal(true)}
                className="btn-default btn-sm p-2"><Search size={16} /></button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={openNew} className="btn-primary">
                <Plus size={16} /> Добави
              </button>
              <button onClick={() => exportToCSV(filtered)} className="btn-default">
                <Download size={16} /> Export
              </button>
              <button onClick={() => handleDelete([])} className="btn-danger btn-sm p-2" title="Изтрий избраните">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>

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
      <Modal open={editModal} onClose={() => setEditModal(false)}
        title={isNew ? 'Добавяне на заявка' : `Редакция на заявка #${editing.id}`}
        size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
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
          </div>

          {/* Cases */}
          <p className="text-sm font-semibold text-gray-700 border-t pt-3">Случаи (Cases)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([1,2,3,4,5,6] as const).map(n => (
              <CaseField key={n} label={`Case ${n}`}
                value={editing[`case${n}` as keyof typeof editing] as CaseEntry}
                onChange={v => setEditing(prev => ({ ...prev, [`case${n}`]: v }))} />
            ))}
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <button onClick={() => setEditModal(false)} className="btn-default">Откажи</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Запис...' : (isNew ? 'Добави' : 'Запази')}
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
              onChange={e => setSearch(v => ({ ...v, status: e.target.value as RequestStatus }))}>
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
            <button onClick={() => { setSearch({}); setSearchModal(false); load() }} className="btn-default">
              Изчисти
            </button>
            <button onClick={() => { setSearchModal(false); load() }} className="btn-primary">
              Търси
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
