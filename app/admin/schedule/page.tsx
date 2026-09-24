'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import {
  addScheduleEntry,
  deleteScheduleEntries,
  getScheduleEntries,
  importScheduleEntries,
  updateScheduleEntry,
} from '@/lib/db'
import { auth } from '@/lib/firebase'
import { getAdminUser } from '@/lib/auth'
import type { ScheduleEntry } from '@/types'
import { CalendarDays, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'

const currentMonth = new Date().toISOString().slice(0, 7)
const EMPTY: Partial<ScheduleEntry> = {
  date: new Date().toISOString().slice(0, 10),
  time: '09:00',
  description: '',
  phone: '',
  performers: '',
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function parseDate(value: unknown) {
  const text = clean(value)
  const local = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  if (/^\d+(\.\d+)?$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text))
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return ''
}

function parseTime(value: unknown) {
  const text = clean(value)
  const time = text.match(/^(\d{1,2}):(\d{2})/)
  if (time) return `${time[1].padStart(2, '0')}:${time[2]}`
  if (/^\d+(\.\d+)?$/.test(text)) {
    const fraction = Number(text) % 1
    const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60)
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
  }
  return text
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<ScheduleEntry>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try { setData(await getScheduleEntries(month)) }
    catch { toast.error('Графикът не може да бъде зареден') }
    setLoading(false)
  }

  useEffect(() => { load() }, [month])
  useEffect(() => {
    void auth.authStateReady().then(async () => {
      if (auth.currentUser) setIsAdmin((await getAdminUser(auth.currentUser.uid))?.role === 'admin')
    })
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('bg-BG')
    if (!term) return data
    return data.filter(item => `${item.date} ${item.time} ${item.description} ${item.phone || ''} ${item.performers || ''}`.toLocaleLowerCase('bg-BG').includes(term))
  }, [data, search])

  function openNew() {
    setEditing({ ...EMPTY, date: month === currentMonth ? EMPTY.date : `${month}-01` })
    setIsNew(true)
    setModal(true)
  }

  async function save() {
    if (!editing.date || !editing.description?.trim()) return toast.error('Попълнете ден и описание')
    setSaving(true)
    try {
      if (isNew) await addScheduleEntry(editing as Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>)
      else await updateScheduleEntry(editing.id!, editing)
      toast.success(isNew ? 'Записът е добавен' : 'Записът е обновен')
      setModal(false)
      await load()
    } catch { toast.error('Грешка при запис') }
    setSaving(false)
  }

  async function remove(ids: string[]) {
    try {
      await deleteScheduleEntries(ids)
      toast.success('Избраните записи са изтрити')
      await load()
    } catch { toast.error('Само администратор може да изтрива записи') }
  }

  async function importFile(file: File) {
    setImporting(true)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false, cellDates: false })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
      const entries = rows.flatMap((row, index) => {
        const date = parseDate(row[0])
        const time = parseTime(row[1])
        const description = clean(row[2])
        const phone = clean(row[3])
        const performers = clean(row[4])
        if (!date || (!description && !phone && !performers)) return []
        return [{ date, time, description: description || 'Без описание', phone, performers, sourceRow: index + 1 }]
      })
      if (!entries.length) throw new Error('Файлът не съдържа разпознаваеми записи')
      const count = await importScheduleEntries(entries)
      toast.success(`Импортирани са ${count} записа`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Файлът не може да бъде импортиран')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">График</span></div>
      <div className="box">
        <div className="box-header">
          <span className="box-title flex items-center gap-2"><CalendarDays size={18} /> График</span>
          <div className="flex flex-wrap gap-2">
            {isAdmin && <>
              <button className="btn-default" disabled={importing} onClick={() => fileRef.current?.click()}><FileSpreadsheet size={16} /> {importing ? 'Импорт...' : 'Импорт от Excel'}</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={event => event.target.files?.[0] && importFile(event.target.files[0])} />
            </>}
            <button className="btn-primary" onClick={openNew}><Plus size={16} /> Добави запис</button>
          </div>
        </div>
        <div className="box-body">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="form-group mb-0"><label className="form-label">Месец</label><input type="month" className="form-control" value={month} onChange={event => setMonth(event.target.value)} /></div>
            <div className="form-group mb-0 flex-1 min-w-[240px] max-w-lg"><label className="form-label">Търсене</label><div className="relative"><input className="form-control pr-9" placeholder="Описание, телефон или изпълнител" value={search} onChange={event => setSearch(event.target.value)} /><Search size={16} className="absolute right-3 top-2.5 text-gray-400" /></div></div>
          </div>
          <DataTable key={`${month}:${search}`} perPage={25} loading={loading} data={filtered} selectable={isAdmin} onDelete={isAdmin ? remove : undefined} onEdit={row => { setEditing({ ...row }); setIsNew(false); setModal(true) }} columns={[
            { key: 'date', label: 'Ден', width: '120px', render: row => <span className="font-medium whitespace-nowrap">{formatDate(row.date)}</span> },
            { key: 'time', label: 'Час', width: '80px', render: row => <span className="font-medium text-[var(--brand-primary)] whitespace-nowrap">{row.time || 'Цял ден'}</span> },
            { key: 'description', label: 'Описание' },
            { key: 'phone', label: 'Телефон', width: '150px' },
            { key: 'performers', label: 'Изпълнители' },
          ]} />
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={isNew ? 'Нов запис в графика' : 'Редакция на запис'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group"><label className="form-label">Ден *</label><input type="date" className="form-control" value={editing.date || ''} onChange={event => setEditing(value => ({ ...value, date: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Час</label><input type="time" className="form-control" value={editing.time || ''} onChange={event => setEditing(value => ({ ...value, time: event.target.value }))} /></div>
          <div className="form-group md:col-span-2"><label className="form-label">Описание *</label><textarea className="form-control" rows={4} value={editing.description || ''} onChange={event => setEditing(value => ({ ...value, description: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Телефон</label><input type="tel" className="form-control" value={editing.phone || ''} onChange={event => setEditing(value => ({ ...value, phone: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Изпълнители</label><input className="form-control" value={editing.performers || ''} onChange={event => setEditing(value => ({ ...value, performers: event.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-3 border-t pt-4"><button className="btn-default" onClick={() => setModal(false)}>Откажи</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Запис...' : 'Запази'}</button></div>
      </Modal>
    </AdminLayout>
  )
}
