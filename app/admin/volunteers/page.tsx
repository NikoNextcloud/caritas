'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import UserAssignment from '@/components/ui/UserAssignment'
import { addVolunteer, deleteVolunteer, getVolunteers, updateVolunteer } from '@/lib/db'
import type { Volunteer, VolunteerStatus } from '@/types'
import { Plus, Search } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const EMPTY: Partial<Volunteer> = {
  firstName: '', lastName: '', email: '', phone: '', city: '', address: '',
  skills: '', availability: '', startDate: '', status: 'Активен', notes: '',
}

export default function VolunteersPage() {
  const [data, setData] = useState<Volunteer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Volunteer>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { setData(await getVolunteers()) } catch { toast.error('Грешка при зареждане на доброволците') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = data.filter(item => !query || `${item.firstName} ${item.lastName} ${item.email || ''} ${item.phone || ''} ${item.skills || ''}`.toLocaleLowerCase('bg-BG').includes(query.toLocaleLowerCase('bg-BG')))

  async function save() {
    if (!editing.firstName?.trim() || !editing.lastName?.trim()) return toast.error('Попълнете име и фамилия')
    setSaving(true)
    try {
      if (isNew) await addVolunteer(editing as Omit<Volunteer, 'id' | 'createdAt' | 'updatedAt'>)
      else await updateVolunteer(editing.id!, editing)
      toast.success(isNew ? 'Доброволецът е добавен' : 'Данните са обновени')
      setModal(false)
      await load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function remove(ids: string[]) {
    try {
      for (const id of ids) await deleteVolunteer(id)
      toast.success('Избраните доброволци са изтрити')
      await load()
    } catch { toast.error('Само администратор може да изтрива записи') }
  }

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">Доброволци</span></div>
      <div className="box"><div className="box-header"><span className="box-title">Доброволци</span></div><div className="box-body">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md"><input className="form-control pr-9" placeholder="Търси по име, телефон, имейл или умения" value={query} onChange={event => setQuery(event.target.value)} /><Search size={16} className="absolute right-3 top-2.5 text-gray-400" /></div>
          <button className="btn-primary" onClick={() => { setEditing(EMPTY); setIsNew(true); setModal(true) }}><Plus size={16} /> Добави доброволец</button>
        </div>
        <DataTable loading={loading} data={filtered} onEdit={row => { setEditing({ ...row }); setIsNew(false); setModal(true) }} onDelete={remove} columns={[
          { key: 'firstName', label: 'Име', render: row => `${row.firstName} ${row.lastName}` },
          { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Имейл' }, { key: 'city', label: 'Град' },
          { key: 'skills', label: 'Умения' }, { key: 'availability', label: 'Наличност' },
          { key: 'status', label: 'Статус', render: row => <span className={row.status === 'Активен' ? 'label-success' : row.status === 'Пауза' ? 'label-warning' : 'label-default'}>{row.status}</span> },
        ]} />
      </div></div>

      <Modal open={modal} onClose={() => setModal(false)} title={isNew ? 'Нов доброволец' : 'Редакция на доброволец'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([['firstName','Име *'],['lastName','Фамилия *'],['email','Имейл'],['phone','Телефон'],['city','Град'],['address','Адрес'],['skills','Умения и квалификации'],['availability','Дни и часове за доброволчество']] as const).map(([key, label]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-control" value={editing[key] || ''} onChange={event => setEditing(value => ({ ...value, [key]: event.target.value }))} /></div>)}
          <div className="form-group"><label className="form-label">Начална дата</label><input type="date" className="form-control" value={editing.startDate || ''} onChange={event => setEditing(value => ({ ...value, startDate: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Статус</label><select className="form-control" value={editing.status || 'Активен'} onChange={event => setEditing(value => ({ ...value, status: event.target.value as VolunteerStatus }))}><option>Активен</option><option>Пауза</option><option>Неактивен</option></select></div>
          <div className="form-group md:col-span-2"><label className="form-label">Бележки</label><textarea className="form-control" rows={3} value={editing.notes || ''} onChange={event => setEditing(value => ({ ...value, notes: event.target.value }))} /></div>
          <UserAssignment value={editing.assignedToUid} onChange={(uid, name) => setEditing(value => ({ ...value, assignedToUid: uid, assignedToName: name }))} />
        </div>
        <div className="flex justify-end gap-3 border-t pt-4"><button className="btn-default" onClick={() => setModal(false)}>Откажи</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Запис...' : 'Запази'}</button></div>
      </Modal>
    </AdminLayout>
  )
}
