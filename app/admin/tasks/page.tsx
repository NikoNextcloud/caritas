'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import { getTasks, addTask, updateTask, deleteTask } from '@/lib/db'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { Plus } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const STATUSES: TaskStatus[] = ['Нова', 'В процес', 'Завършена', 'Отменена']
const PRIORITIES: TaskPriority[] = ['Ниска', 'Средна', 'Висока']
const EMPTY: Partial<Task> = { title: '', description: '', status: 'Нова', priority: 'Средна' }

const priorityColor: Record<TaskPriority, string> = {
  'Ниска':  'label-info',
  'Средна': 'label-warning',
  'Висока': 'label-danger',
}
const statusColor: Record<TaskStatus, string> = {
  'Нова':      'label-default',
  'В процес':  'label-warning',
  'Завършена': 'label-success',
  'Отменена':  'label-danger',
}

export default function TasksPage() {
  const [data, setData] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Task>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { setData(await getTasks()) }
    catch { toast.error('Грешка при зареждане') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditing(EMPTY); setIsNew(true); setModal(true) }
  function openEdit(row: Task) { setEditing({ ...row }); setIsNew(false); setModal(true) }

  async function handleSave() {
    if (!editing.title) { toast.error('Въведете заглавие'); return }
    setSaving(true)
    try {
      if (isNew) {
        await addTask(editing as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>)
        toast.success('Задачата е добавена!')
      } else {
        await updateTask(editing.id!, editing)
        toast.success('Задачата е обновена!')
      }
      setModal(false); load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const id of ids) await deleteTask(id)
      toast.success(`${ids.length} задачи изтрити`); load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const columns = [
    { key: 'id', label: 'Id', width: '80px' },
    { key: 'title', label: 'Заглавие' },
    { key: 'priority', label: 'Приоритет', render: (r: Task) =>
      <span className={priorityColor[r.priority]}>{r.priority}</span> },
    { key: 'status', label: 'Статус', render: (r: Task) =>
      <span className={statusColor[r.status]}>{r.status}</span> },
    { key: 'assignedTo', label: 'Назначено на' },
    { key: 'dueDate', label: 'Краен срок' },
    { key: 'createdAt', label: 'Дата', render: (r: Task) => r.createdAt?.split('T')[0] ?? '' },
  ]

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Списък Задачи</span>
      </div>
      <div className="box">
        <div className="box-header">
          <span className="box-title">Списък Задачи</span>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Добави Задача
          </button>
        </div>
        <div className="box-body">
          <DataTable columns={columns} data={data} loading={loading}
            onEdit={openEdit} onDelete={handleDelete} />
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}
        title={isNew ? 'Нова задача' : 'Редакция на задача'}>
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Заглавие *</label>
            <input type="text" className="form-control"
              value={editing.title ?? ''}
              onChange={e => setEditing(v => ({ ...v, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea className="form-control resize-none" rows={4}
              value={editing.description ?? ''}
              onChange={e => setEditing(v => ({ ...v, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-control" value={editing.status ?? 'Нова'}
                onChange={e => setEditing(v => ({ ...v, status: e.target.value as TaskStatus }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Приоритет</label>
              <select className="form-control" value={editing.priority ?? 'Средна'}
                onChange={e => setEditing(v => ({ ...v, priority: e.target.value as TaskPriority }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Назначено на</label>
              <input type="text" className="form-control"
                value={editing.assignedTo ?? ''}
                onChange={e => setEditing(v => ({ ...v, assignedTo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Краен срок</label>
              <input type="date" className="form-control"
                value={editing.dueDate ?? ''}
                onChange={e => setEditing(v => ({ ...v, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <button onClick={() => setModal(false)} className="btn-default">Откажи</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Запис...' : (isNew ? 'Добави' : 'Запази')}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
