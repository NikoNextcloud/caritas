'use client'
import { useMemo, useState } from 'react'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import { updateEmployer } from '@/lib/db'
import type { Employer, JobPosition } from '@/types'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface JobPositionRow extends JobPosition {
  employerId: string
  employerName: string
}

const EMPTY: Partial<JobPositionRow> = {
  employerId: '', title: '', description: '', skills: '', isActive: true,
}

export default function JobPositionsSection({ employers, onChanged }: {
  employers: Employer[]
  onChanged: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<JobPositionRow>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const positions = useMemo(() => employers.flatMap(employer =>
    (employer.positions || []).map(position => ({
      ...position,
      employerId: employer.id,
      employerName: employer.name,
    }))
  ), [employers])

  const filtered = query ? positions.filter(position => {
    const search = query.toLocaleLowerCase('bg')
    return position.title.toLocaleLowerCase('bg').includes(search) ||
      position.employerName.toLocaleLowerCase('bg').includes(search) ||
      position.skills?.toLocaleLowerCase('bg').includes(search)
  }) : positions

  function openNew() {
    setEditing({ ...EMPTY, employerId: employers[0]?.id || '' })
    setIsNew(true)
    setModal(true)
  }

  function openEdit(row: JobPositionRow) {
    setEditing({ ...row })
    setIsNew(false)
    setModal(true)
  }

  async function handleSave() {
    if (!editing.employerId || !editing.title?.trim()) {
      toast.error('Изберете работодател и въведете заглавие')
      return
    }
    setSaving(true)
    try {
      const target = employers.find(item => item.id === editing.employerId)
      if (!target) throw new Error('Работодателят не е намерен')

      let positionId = editing.id
      if (isNew) {
        do { positionId = String(100000 + Math.floor(Math.random() * 900000)) }
        while (positions.some(item => item.id === positionId))
      }
      const position: JobPosition = {
        id: positionId!,
        title: editing.title.trim(),
        description: editing.description?.trim() || '',
        skills: editing.skills?.trim() || '',
        isActive: editing.isActive !== false,
      }

      const next = isNew
        ? [...(target.positions || []), position]
        : (target.positions || []).map(item => item.id === position.id ? position : item)
      await updateEmployer(target.id, { positions: next })
      setModal(false)
      await onChanged()
      toast.success(isNew ? 'Позицията е добавена!' : 'Позицията е обновена!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Грешка при запис')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const employer of employers) {
        const current = employer.positions || []
        const next = current.filter(position => !ids.includes(position.id))
        if (next.length !== current.length) await updateEmployer(employer.id, { positions: next })
      }
      await onChanged()
      toast.success(`${ids.length} позиции изтрити`)
    } catch {
      toast.error('Грешка при изтриване')
    }
  }

  const columns = [
    { key: 'title', label: 'Заглавие' },
    { key: 'employerName', label: 'Работодател' },
    { key: 'description', label: 'Описание' },
    { key: 'skills', label: 'Умения' },
    { key: 'isActive', label: 'Активна', render: (row: JobPositionRow) => (
      <span className={row.isActive ? 'label-success' : 'label-default'}>{row.isActive ? 'Да' : 'Не'}</span>
    ) },
  ]

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <input className="form-control max-w-xs" value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Търси по позиция, работодател или умения..." />
          <Search size={16} className="text-gray-400" />
        </div>
        <button onClick={openNew} disabled={employers.length === 0} className="btn-primary disabled:opacity-50">
          <Plus size={16} /> Добави позиция
        </button>
      </div>
      {employers.length === 0 && <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">Първо добавете работодател.</p>}
      <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} />

      <Modal open={modal} onClose={() => setModal(false)}
        title={isNew ? 'Нова позиция за работа' : 'Редакция на позиция'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Работодател *</label>
            <select className="form-control" value={editing.employerId || ''}
              disabled={!isNew}
              onChange={event => setEditing(value => ({ ...value, employerId: event.target.value }))}>
              <option value="">Изберете работодател</option>
              {employers.map(employer => <option key={employer.id} value={employer.id}>{employer.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Заглавие *</label>
            <input className="form-control" value={editing.title || ''}
              onChange={event => setEditing(value => ({ ...value, title: event.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Описание</label>
            <textarea className="form-control resize-none" rows={3} value={editing.description || ''}
              onChange={event => setEditing(value => ({ ...value, description: event.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Умения</label>
            <textarea className="form-control resize-none" rows={2} value={editing.skills || ''}
              placeholder="Например: шофьорска книжка, работа с клиенти, MS Office"
              onChange={event => setEditing(value => ({ ...value, skills: event.target.value }))} />
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={editing.isActive !== false}
              onChange={event => setEditing(value => ({ ...value, isActive: event.target.checked }))} />
            Активна позиция
          </label>
        </div>
        <div className="flex gap-3 justify-end border-t pt-4 mt-4">
          <button onClick={() => setModal(false)} className="btn-default">Откажи</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Запис...' : 'Запази'}
          </button>
        </div>
      </Modal>
    </>
  )
}
