'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import { addDonor, deleteDonor, getDonors, updateDonor } from '@/lib/db'
import type { DonationEntry, DonationFrequency, Donor, DonorEntityType } from '@/types'
import { Plus, Search, Trash2 } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const EMPTY: Partial<Donor> = {
  entityType: 'Физическо лице', firstName: '', lastName: '', organizationName: '', eik: '', egn: '',
  contactPerson: '', email: '', phone: '', address: '', basis: '', frequency: 'Еднократно', donations: [], notes: '',
}

function donorName(donor: Donor | Partial<Donor>) {
  return donor.entityType === 'Юридическо лице' ? donor.organizationName || '' : `${donor.firstName || ''} ${donor.lastName || ''}`.trim()
}

function donationStats(donor: Donor) {
  const sorted = [...(donor.donations || [])].filter(item => item.date).sort((a, b) => a.date.localeCompare(b.date))
  return {
    count: sorted.length,
    lastDate: sorted.at(-1)?.date || '—',
    total: sorted.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  }
}

export default function DonorsPage() {
  const [data, setData] = useState<Donor[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Donor>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { setData(await getDonors()) } catch { toast.error('Грешка при зареждане на дарителите') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => data.filter(item => !query || `${donorName(item)} ${item.eik || ''} ${item.egn || ''} ${item.email || ''} ${item.phone || ''}`.toLocaleLowerCase('bg-BG').includes(query.toLocaleLowerCase('bg-BG'))), [data, query])

  async function save() {
    if (!donorName(editing)) return toast.error(editing.entityType === 'Юридическо лице' ? 'Попълнете име на организацията' : 'Попълнете име и фамилия')
    if (!editing.basis?.trim()) return toast.error('Попълнете основание за дарението')
    setSaving(true)
    try {
      const payload = { ...editing, donations: editing.donations || [] }
      if (isNew) await addDonor(payload as Omit<Donor, 'id' | 'createdAt' | 'updatedAt'>)
      else await updateDonor(editing.id!, payload)
      toast.success(isNew ? 'Дарителят е добавен' : 'Данните са обновени')
      setModal(false)
      await load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  function updateDonation(index: number, patch: Partial<DonationEntry>) {
    setEditing(value => ({ ...value, donations: (value.donations || []).map((entry, current) => current === index ? { ...entry, ...patch } : entry) }))
  }

  function addDonation() {
    setEditing(value => ({ ...value, donations: [...(value.donations || []), { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), amount: 0, basis: value.basis || '', notes: '' }] }))
  }

  async function remove(ids: string[]) {
    try {
      for (const id of ids) await deleteDonor(id)
      toast.success('Избраните дарители са изтрити')
      await load()
    } catch { toast.error('Само администратор може да изтрива записи') }
  }

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">Дарители</span></div>
      <div className="box"><div className="box-header"><span className="box-title">Дарители и история на даренията</span></div><div className="box-body">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md"><input className="form-control pr-9" placeholder="Търси по име, ЕИК, ЕГН, телефон или имейл" value={query} onChange={event => setQuery(event.target.value)} /><Search size={16} className="absolute right-3 top-2.5 text-gray-400" /></div>
          <button className="btn-primary" onClick={() => { setEditing(EMPTY); setIsNew(true); setModal(true) }}><Plus size={16} /> Добави дарител</button>
        </div>
        <DataTable loading={loading} data={filtered} onEdit={row => { setEditing({ ...row, donations: [...(row.donations || [])] }); setIsNew(false); setModal(true) }} onDelete={remove} columns={[
          { key: 'name', label: 'Дарител', render: donorName },
          { key: 'entityType', label: 'Вид' }, { key: 'basis', label: 'Основание' }, { key: 'frequency', label: 'Честота' },
          { key: 'donationCount', label: 'Брой', render: row => donationStats(row).count },
          { key: 'lastDonation', label: 'Последно дарение', render: row => donationStats(row).lastDate },
          { key: 'total', label: 'Общо', render: row => `${donationStats(row).total.toFixed(2)} лв.` },
          { key: 'phone', label: 'Телефон' },
        ]} />
      </div></div>

      <Modal open={modal} onClose={() => setModal(false)} title={isNew ? 'Нов дарител' : 'Редакция на дарител'} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group"><label className="form-label">Вид дарител</label><select className="form-control" value={editing.entityType || 'Физическо лице'} onChange={event => setEditing(value => ({ ...value, entityType: event.target.value as DonorEntityType }))}><option>Физическо лице</option><option>Юридическо лице</option></select></div>
          <div className="form-group"><label className="form-label">Честота</label><select className="form-control" value={editing.frequency || 'Еднократно'} onChange={event => setEditing(value => ({ ...value, frequency: event.target.value as DonationFrequency }))}><option>Еднократно</option><option>Месечно</option><option>Тримесечно</option><option>Годишно</option><option>Друго</option></select></div>
          {editing.entityType === 'Юридическо лице' ? <><div className="form-group"><label className="form-label">Организация *</label><input className="form-control" value={editing.organizationName || ''} onChange={event => setEditing(value => ({ ...value, organizationName: event.target.value }))} /></div><div className="form-group"><label className="form-label">ЕИК</label><input className="form-control" value={editing.eik || ''} onChange={event => setEditing(value => ({ ...value, eik: event.target.value }))} /></div><div className="form-group"><label className="form-label">Лице за контакт</label><input className="form-control" value={editing.contactPerson || ''} onChange={event => setEditing(value => ({ ...value, contactPerson: event.target.value }))} /></div></> : <><div className="form-group"><label className="form-label">Име *</label><input className="form-control" value={editing.firstName || ''} onChange={event => setEditing(value => ({ ...value, firstName: event.target.value }))} /></div><div className="form-group"><label className="form-label">Фамилия *</label><input className="form-control" value={editing.lastName || ''} onChange={event => setEditing(value => ({ ...value, lastName: event.target.value }))} /></div><div className="form-group"><label className="form-label">ЕГН</label><input className="form-control" value={editing.egn || ''} onChange={event => setEditing(value => ({ ...value, egn: event.target.value }))} /></div></>}
          {([['email','Имейл'],['phone','Телефон'],['address','Адрес']] as const).map(([key, label]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-control" value={editing[key] || ''} onChange={event => setEditing(value => ({ ...value, [key]: event.target.value }))} /></div>)}
          <div className="form-group md:col-span-2"><label className="form-label">Основание / предназначение на дарението *</label><textarea className="form-control" rows={2} value={editing.basis || ''} onChange={event => setEditing(value => ({ ...value, basis: event.target.value }))} /></div>
          <div className="form-group md:col-span-2"><label className="form-label">Бележки</label><textarea className="form-control" rows={2} value={editing.notes || ''} onChange={event => setEditing(value => ({ ...value, notes: event.target.value }))} /></div>
        </div>

        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-3"><div><h3 className="font-semibold text-gray-800">История на даренията</h3><p className="text-xs text-gray-500">Всеки запис пази дата, сума и основание, за да се проследява реалната честота.</p></div><button className="btn-success" onClick={addDonation}><Plus size={15} /> Добави дарение</button></div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(editing.donations || []).length === 0 ? <p className="text-sm text-gray-400 py-3">Все още няма записани дарения.</p> : (editing.donations || []).map((entry, index) => <div key={entry.id} className="grid grid-cols-1 md:grid-cols-[140px_130px_1fr_1fr_36px] gap-2 items-center bg-gray-50 p-2 rounded">
              <input type="date" className="form-control" value={entry.date} onChange={event => updateDonation(index, { date: event.target.value })} />
              <input type="number" min="0" step="0.01" className="form-control" value={entry.amount ?? ''} placeholder="Сума" onChange={event => updateDonation(index, { amount: Number(event.target.value) })} />
              <input className="form-control" value={entry.basis} placeholder="Основание" onChange={event => updateDonation(index, { basis: event.target.value })} />
              <input className="form-control" value={entry.notes || ''} placeholder="Бележка" onChange={event => updateDonation(index, { notes: event.target.value })} />
              <button className="text-red-500 hover:text-red-700" onClick={() => setEditing(value => ({ ...value, donations: (value.donations || []).filter((_, current) => current !== index) }))}><Trash2 size={17} /></button>
            </div>)}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t pt-4 mt-4"><button className="btn-default" onClick={() => setModal(false)}>Откажи</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Запис...' : 'Запази'}</button></div>
      </Modal>
    </AdminLayout>
  )
}
