'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import UserAssignment from '@/components/ui/UserAssignment'
import JobPositionsSection from './JobPositionsSection'
import { getEmployers, addEmployer, updateEmployer, deleteEmployer } from '@/lib/db'
import type { Employer } from '@/types'
import { BriefcaseBusiness, Building2, Plus, Search } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const EMPTY: Partial<Employer> = {
  name: '', eik: '', city: '', address: '', contactPerson: '', phone: '', email: '', industry: ''
}

export default function EmployersPage() {
  const [data, setData] = useState<Employer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Employer>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<'employers' | 'positions'>('employers')

  async function load() {
    setLoading(true)
    try { setData(await getEmployers()) }
    catch { toast.error('Грешка при зареждане') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = query
    ? data.filter(e =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.city?.toLowerCase().includes(query.toLowerCase()) ||
        e.eik?.includes(query)
      )
    : data

  function openNew() { setEditing(EMPTY); setIsNew(true); setModal(true) }
  function openEdit(row: Employer) { setEditing({ ...row }); setIsNew(false); setModal(true) }

  async function handleSave() {
    if (!editing.name) { toast.error('Въведете наименование'); return }
    setSaving(true)
    try {
      if (isNew) {
        await addEmployer(editing as Omit<Employer, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Работодателят е добавен!')
      } else {
        await updateEmployer(editing.id!, editing)
        toast.success('Работодателят е обновен!')
      }
      setModal(false); load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const id of ids) await deleteEmployer(id)
      toast.success(`${ids.length} записа изтрити`); load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const columns = [
    { key: 'id', label: 'Id', width: '80px' },
    { key: 'name', label: 'Наименование' },
    { key: 'eik', label: 'ЕИК' },
    { key: 'city', label: 'Град' },
    { key: 'contactPerson', label: 'Лице за контакт' },
    { key: 'phone', label: 'Телефон' },
    { key: 'industry', label: 'Бранш' },
  ]

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Работодатели</span>
      </div>
      <div className="box">
        <div className="box-header">
          <div className="flex items-center gap-2">
            <button onClick={() => setSection('employers')}
              className={section === 'employers' ? 'btn-primary' : 'btn-default'}>
              <Building2 size={16} /> Работодатели
            </button>
            <button onClick={() => setSection('positions')}
              className={section === 'positions' ? 'btn-primary' : 'btn-default'}>
              <BriefcaseBusiness size={16} /> Позиции за работа
            </button>
          </div>
        </div>
        <div className="box-body">
          {section === 'employers' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <input type="text" placeholder="Търси по наименование, ЕИК, град..."
                    className="form-control max-w-xs" value={query}
                    onChange={e => setQuery(e.target.value)} />
                  <Search size={16} className="text-gray-400" />
                </div>
                <button onClick={openNew} className="btn-primary flex-shrink-0">
                  <Plus size={16} /> Добави
                </button>
              </div>
              <DataTable columns={columns} data={filtered} loading={loading}
                onEdit={openEdit} onDelete={handleDelete} />
            </>
          ) : (
            <JobPositionsSection employers={data} onChanged={load} />
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}
        title={isNew ? 'Нов работодател' : 'Редакция на работодател'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group md:col-span-2">
            <label className="form-label">Наименование *</label>
            <input type="text" className="form-control"
              value={editing.name ?? ''}
              onChange={e => setEditing(v => ({ ...v, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">ЕИК</label>
            <input type="text" className="form-control"
              value={editing.eik ?? ''}
              onChange={e => setEditing(v => ({ ...v, eik: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Бранш</label>
            <input type="text" className="form-control"
              value={editing.industry ?? ''}
              onChange={e => setEditing(v => ({ ...v, industry: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Град</label>
            <input type="text" className="form-control"
              value={editing.city ?? ''}
              onChange={e => setEditing(v => ({ ...v, city: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Адрес</label>
            <input type="text" className="form-control"
              value={editing.address ?? ''}
              onChange={e => setEditing(v => ({ ...v, address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Лице за контакт</label>
            <input type="text" className="form-control"
              value={editing.contactPerson ?? ''}
              onChange={e => setEditing(v => ({ ...v, contactPerson: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Телефон</label>
            <input type="tel" className="form-control"
              value={editing.phone ?? ''}
              onChange={e => setEditing(v => ({ ...v, phone: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Имейл</label>
            <input type="email" className="form-control"
              value={editing.email ?? ''}
              onChange={e => setEditing(v => ({ ...v, email: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Бележки</label>
            <textarea className="form-control resize-none" rows={3}
              value={editing.notes ?? ''}
              onChange={e => setEditing(v => ({ ...v, notes: e.target.value }))} />
          </div>
          <UserAssignment value={editing.assignedToUid} onChange={(uid, name) => setEditing(v => ({ ...v, assignedToUid: uid, assignedToName: name }))} />
        </div>
        <div className="flex gap-3 justify-end border-t pt-4 mt-2">
          <button onClick={() => setModal(false)} className="btn-default">Откажи</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Запис...' : (isNew ? 'Добави' : 'Запази')}
          </button>
        </div>
      </Modal>
    </AdminLayout>
  )
}
