'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import { getBeneficiaries, addBeneficiary, updateBeneficiary, deleteBeneficiary } from '@/lib/db'
import type { Beneficiary } from '@/types'
import { Plus, Search } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const EMPTY: Partial<Beneficiary> = { firstName: '', lastName: '', email: '', phone: '', city: '', address: '' }

export default function BeneficiariesPage() {
  const [data, setData] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Beneficiary>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try { setData(await getBeneficiaries()) }
    catch { toast.error('Грешка при зареждане') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = query
    ? data.filter(b =>
        `${b.firstName} ${b.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        b.email?.toLowerCase().includes(query.toLowerCase()) ||
        b.phone?.includes(query)
      )
    : data

  function openNew() { setEditing(EMPTY); setIsNew(true); setModal(true) }
  function openEdit(row: Beneficiary) { setEditing({ ...row }); setIsNew(false); setModal(true) }

  async function handleSave() {
    if (!editing.firstName || !editing.lastName) { toast.error('Попълнете имената'); return }
    setSaving(true)
    try {
      if (isNew) {
        await addBeneficiary(editing as Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Бенефициентът е добавен!')
      } else {
        await updateBeneficiary(editing.id!, editing)
        toast.success('Бенефициентът е обновен!')
      }
      setModal(false); load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const id of ids) await deleteBeneficiary(id)
      toast.success(`${ids.length} записа изтрити`); load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const columns = [
    { key: 'id', label: 'Id', width: '80px' },
    { key: 'firstName', label: 'Първо Име' },
    { key: 'lastName', label: 'Фамилия' },
    { key: 'email', label: 'Имейл' },
    { key: 'phone', label: 'Телефон' },
    { key: 'city', label: 'Град' },
    { key: 'createdAt', label: 'Дата', render: (r: Beneficiary) => r.createdAt?.split('T')[0] ?? '' },
  ]

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Бенефициенти</span>
      </div>
      <div className="box">
        <div className="box-header">
          <span className="box-title">Бенефициенти</span>
        </div>
        <div className="box-body">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <input type="text" placeholder="Търси по имена, имейл, телефон..."
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
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}
        title={isNew ? 'Добавяне на бенефициент' : 'Редакция на бенефициент'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Първо Ime *</label>
            <input type="text" className="form-control"
              value={editing.firstName ?? ''}
              onChange={e => setEditing(v => ({ ...v, firstName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Фамилия *</label>
            <input type="text" className="form-control"
              value={editing.lastName ?? ''}
              onChange={e => setEditing(v => ({ ...v, lastName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Имейл</label>
            <input type="email" className="form-control"
              value={editing.email ?? ''}
              onChange={e => setEditing(v => ({ ...v, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Телефон</label>
            <input type="tel" className="form-control"
              value={editing.phone ?? ''}
              onChange={e => setEditing(v => ({ ...v, phone: e.target.value }))} />
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
          <div className="form-group md:col-span-2">
            <label className="form-label">Дата на раждане</label>
            <input type="date" className="form-control"
              value={editing.birthDate ?? ''}
              onChange={e => setEditing(v => ({ ...v, birthDate: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Бележки</label>
            <textarea className="form-control resize-none" rows={3}
              value={editing.notes ?? ''}
              onChange={e => setEditing(v => ({ ...v, notes: e.target.value }))} />
          </div>
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
