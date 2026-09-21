'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import DataTable from '@/components/ui/DataTable'
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import type { AdminUser, UserRole } from '@/types'
import { Plus, Shield } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const ROLES: UserRole[] = ['admin', 'operator', 'viewer']
const roleLabel: Record<UserRole, string> = {
  admin:    'Администратор',
  operator: 'Оператор',
  viewer:   'Преглед',
}
const roleColor: Record<UserRole, string> = {
  admin:    'label-danger',
  operator: 'label-warning',
  viewer:   'label-info',
}

const EMPTY = { email: '', displayName: '', role: 'operator' as UserRole, password: '' }

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser)))
    } catch { toast.error('Грешка при зареждане') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.email || !form.displayName || !form.password) {
      toast.error('Попълнете всички полета'); return
    }
    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        isOnline: false,
        createdAt: new Date().toISOString(),
      })
      toast.success('Потребителят е създаден!')
      setModal(false)
      setForm(EMPTY)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) toast.error('Имейлът вече се използва')
      else if (msg.includes('weak-password')) toast.error('Паролата трябва да е поне 6 символа')
      else toast.error('Грешка при създаване')
    }
    setSaving(false)
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    try {
      await updateDoc(doc(db, 'users', uid), { role })
      toast.success('Ролята е обновена')
      load()
    } catch { toast.error('Грешка') }
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const id of ids) await deleteDoc(doc(db, 'users', id))
      toast.success(`${ids.length} потребители изтрити`); load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const columns = [
    { key: 'uid', label: 'UID', width: '80px', render: (r: AdminUser) =>
      <span className="text-xs text-gray-400 font-mono">{r.uid.slice(0, 8)}…</span> },
    { key: 'displayName', label: 'Имe' },
    { key: 'email', label: 'Имейл' },
    { key: 'role', label: 'Роля', render: (r: AdminUser) => (
      <select
        value={r.role}
        onChange={e => handleRoleChange(r.uid, e.target.value as UserRole)}
        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-[#3c8dbc]"
      >
        {ROLES.map(role => <option key={role} value={role}>{roleLabel[role]}</option>)}
      </select>
    )},
    { key: 'isOnline', label: 'Статус', render: (r: AdminUser) => (
      <span className={r.isOnline ? 'label-success' : 'label-default'}>
        {r.isOnline ? 'Online' : 'Offline'}
      </span>
    )},
    { key: 'createdAt', label: 'Регистриран', render: (r: AdminUser) => r.createdAt?.split('T')[0] ?? '' },
  ]

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Потребители</span>
      </div>

      <div className="box">
        <div className="box-header">
          <span className="box-title flex items-center gap-2">
            <Shield size={18} /> Управление на потребители
          </span>
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={16} /> Нов потребител
          </button>
        </div>
        <div className="box-body">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            <strong>Роли:</strong> Администратор — пълен достъп · Оператор — добавяне/редакция · Преглед — само четене
          </div>
          <DataTable columns={columns} data={users} loading={loading}
            onDelete={handleDelete} selectable />
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Нов потребител">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Имe и фамилия *</label>
            <input type="text" className="form-control"
              value={form.displayName}
              onChange={e => setForm(v => ({ ...v, displayName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Имейл *</label>
            <input type="email" className="form-control"
              value={form.email}
              onChange={e => setForm(v => ({ ...v, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Парола *</label>
            <input type="password" className="form-control" placeholder="Минимум 6 символа"
              value={form.password}
              onChange={e => setForm(v => ({ ...v, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Роля</label>
            <select className="form-control" value={form.role}
              onChange={e => setForm(v => ({ ...v, role: e.target.value as UserRole }))}>
              {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <button onClick={() => setModal(false)} className="btn-default">Откажи</button>
            <button onClick={handleAdd} disabled={saving} className="btn-primary">
              {saving ? 'Създаване...' : 'Създай потребител'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
