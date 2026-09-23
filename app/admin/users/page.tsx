'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { deleteApp, initializeApp } from 'firebase/app'
import { db, firebaseConfig } from '@/lib/firebase'
import type { UserRole } from '@/types'
import { Plus, Shield } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// AdminUser с id (за DataTable)
interface AdminUserRow {
  id: string       // = uid, за да работи DataTable
  uid: string
  email: string
  displayName: string
  role: UserRole
  isOnline: boolean
  createdAt: string
}

const ROLES: UserRole[] = ['admin', 'user']
const roleLabel: Record<UserRole, string> = {
  admin:    'Администратор',
  user:     'Потребител',
  operator: 'Оператор',
  viewer:   'Преглед',
}
const EMPTY = { email: '', displayName: '', role: 'user' as UserRole, password: '' }

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map(d => ({
        id: d.id,
        uid: d.id,
        ...d.data()
      } as AdminUserRow)))
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
      const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`)
      const secondaryAuth = getAuth(secondaryApp)
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        isOnline: false,
        createdAt: new Date().toISOString(),
      })
      await signOut(secondaryAuth)
      await deleteApp(secondaryApp)
      toast.success('Потребителят е създаден!')
      setModal(false)
      setForm(EMPTY)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) toast.error('Имейлът вече се използва')
      else if (msg.includes('weak-password'))   toast.error('Паролата трябва да е поне 6 символа')
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

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Изтриване на ${selected.size} потребители?`)) return
    try {
      for (const id of Array.from(selected)) await deleteDoc(doc(db, 'users', id))
      toast.success(`${selected.size} потребители изтрити`)
      setSelected(new Set())
      load()
    } catch { toast.error('Грешка при изтриване') }
  }

  function toggleAll() {
    if (selected.size === users.length) setSelected(new Set())
    else setSelected(new Set(users.map(u => u.id)))
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  return (
    <AdminLayout>
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
            <strong>Роли:</strong> Администратор — вижда и управлява всичко · Потребител — вижда само създадените от него или възложените му записи
          </div>

          {/* Bulk delete bar */}
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <span className="text-sm text-blue-700 font-medium">Избрани: {selected.size}</span>
              <button onClick={handleDeleteSelected} className="btn-danger btn-sm">Изтрий избраните</button>
              <button onClick={() => setSelected(new Set())} className="btn-default btn-sm">Откажи</button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="primary-spinner animate-spin w-8 h-8 border-4 rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#f4f4f4' }} className="border-b border-gray-200">
                    <th className="px-3 py-3 text-left w-10">
                      <input type="checkbox"
                        checked={users.length > 0 && selected.size === users.length}
                        onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Иmе</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Имейл</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Роля</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Статус</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">Регистриран</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">Няма потребители</td>
                    </tr>
                  ) : users.map((u, idx) => (
                    <tr key={u.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors
                        ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}
                        ${selected.has(u.id) ? '!bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)} className="cursor-pointer" />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-700">{u.displayName}</td>
                      <td className="px-3 py-2 text-gray-600">{u.email}</td>
                      <td className="px-3 py-2">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.uid, e.target.value as UserRole)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-[var(--brand-primary)]"
                        >
                          {ROLES.map(role => (
                            <option key={role} value={role}>{roleLabel[role]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs text-white px-2 py-0.5 rounded font-medium
                          ${u.isOnline ? 'bg-[#00a65a]' : 'bg-gray-400'}`}>
                          {u.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {u.createdAt?.split('T')[0] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Нов потребител">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Иmе и фамилия *</label>
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
