'use client'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import UserAssignment from '@/components/ui/UserAssignment'
import { getBeneficiaries, addBeneficiary, updateBeneficiary, deleteBeneficiary } from '@/lib/db'
import { prepareBeneficiaryPhoto, validateBeneficiaryPhoto } from '@/lib/beneficiary-images'
import type { Beneficiary } from '@/types'
import { ArrowDownAZ, ArrowUpAZ, ImageIcon, Plus, Search, Upload } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const EMPTY: Partial<Beneficiary> = {
  firstName: '', lastName: '', middleName: '', gender: '', birthDate: '', country: '', egn: '',
  status: '', email: '', phone: '', city: '', address: '', currentAddress: '', mentor: '',
  requestedHelp: '', education: '', vulnerability: '', notes: '',
}

function numericBeneficiaryId(beneficiary: Partial<Beneficiary>) {
  const externalId = String(beneficiary.externalId ?? '')
  if (/^\d+$/.test(externalId)) return externalId
  if (beneficiary.id && /^\d+$/.test(beneficiary.id)) return beneficiary.id

  const source = beneficiary.id || `${beneficiary.firstName}-${beneficiary.lastName}-${beneficiary.createdAt}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return String(100000 + (hash >>> 0) % 900000)
}

type SortKey = 'id' | 'firstName' | 'lastName'

export default function BeneficiariesPage() {
  const [data, setData] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Beneficiary>>(EMPTY)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [viewPhoto, setViewPhoto] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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
        b.middleName?.toLowerCase().includes(query.toLowerCase()) ||
        b.egn?.includes(query) ||
        b.email?.toLowerCase().includes(query.toLowerCase()) ||
        b.phone?.includes(query) ||
        numericBeneficiaryId(b).includes(query)
      )
    : data

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const first = sortKey === 'id' ? Number(numericBeneficiaryId(a)) : (a[sortKey] || '').toLocaleLowerCase('bg')
    const second = sortKey === 'id' ? Number(numericBeneficiaryId(b)) : (b[sortKey] || '').toLocaleLowerCase('bg')
    const result = typeof first === 'number' && typeof second === 'number'
      ? first - second
      : String(first).localeCompare(String(second), 'bg')
    return sortDirection === 'asc' ? result : -result
  }), [filtered, sortKey, sortDirection])

  function resetPhotoSelection() {
    if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview('')
  }

  function openNew() {
    resetPhotoSelection()
    setEditing(EMPTY)
    setIsNew(true)
    setModal(true)
  }

  function openEdit(row: Beneficiary) {
    resetPhotoSelection()
    setEditing({ ...row })
    setPhotoPreview(row.photoUrl || '')
    setIsNew(false)
    setModal(true)
  }

  function closeEditor() {
    resetPhotoSelection()
    setModal(false)
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      validateBeneficiaryPhoto(file)
      if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Невалидна снимка')
      event.target.value = ''
    }
  }

  async function handleSave() {
    if (!editing.firstName || !editing.lastName) { toast.error('Попълнете имената'); return }
    setSaving(true)
    try {
      const photoUrl = photoFile ? await prepareBeneficiaryPhoto(photoFile) : editing.photoUrl
      const record = {
        ...editing,
        ...(!isNew ? { externalId: numericBeneficiaryId(editing) } : {}),
        ...(photoUrl ? { photoUrl } : {}),
      }
      if (isNew) {
        await addBeneficiary(record as Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'>)
      } else {
        await updateBeneficiary(editing.id!, record)
      }
      closeEditor()
      await load()
      toast.success(isNew ? 'Бенефициентът е добавен!' : 'Бенефициентът е обновен!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Грешка при запис')
    }
    setSaving(false)
  }

  async function handleDelete(ids: string[]) {
    try {
      for (const id of ids) {
        await deleteBeneficiary(id)
      }
      toast.success(`${ids.length} записа изтрити`); load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const columns = [
    { key: 'id', label: 'ID', width: '80px', render: (r: Beneficiary) => numericBeneficiaryId(r) },
    {
      key: 'photoUrl', label: 'Снимка', width: '76px', render: (r: Beneficiary) => r.photoUrl ? (
        <button type="button" onClick={() => setViewPhoto(r.photoUrl!)}
          className="block rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-[#3c8dbc] focus:outline-none focus:ring-2 focus:ring-[#3c8dbc]"
          title="Виж снимка" aria-label={`Виж снимка на ${r.firstName} ${r.lastName}`}>
          <img src={r.photoUrl} alt={`${r.firstName} ${r.lastName}`}
            className="w-11 h-11 object-cover bg-gray-100" />
        </button>
      ) : <span className="text-gray-300">—</span>,
    },
    { key: 'firstName', label: 'Първо Име' },
    { key: 'lastName', label: 'Фамилия' },
    { key: 'middleName', label: 'Бащино име' },
    { key: 'egn', label: 'ЕГН' },
    { key: 'status', label: 'Статут' },
    { key: 'country', label: 'Държава' },
    { key: 'email', label: 'Имейл' },
    { key: 'phone', label: 'Телефон' },
    { key: 'city', label: 'Град' },
    { key: 'createdAt', label: 'Дата', render: (r: Beneficiary) => r.createdAt?.split('T')[0] ?? '' },
  ]

  return (
    <AdminLayout>
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
              <input type="text" placeholder="Търси по имена, ЕГН, имейл или телефон..."
                className="form-control max-w-xs" value={query}
                onChange={e => setQuery(e.target.value)} />
              <Search size={16} className="text-gray-400" />
            </div>
            <select className="form-control !w-auto" value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)} aria-label="Сортиране на бенефициентите">
              <option value="id">Сортиране по ID</option>
              <option value="firstName">Сортиране по име</option>
              <option value="lastName">Сортиране по фамилия</option>
            </select>
            <button type="button" onClick={() => setSortDirection(v => v === 'asc' ? 'desc' : 'asc')}
              className="btn-default px-3" title={sortDirection === 'asc' ? 'Възходящо' : 'Низходящо'}>
              {sortDirection === 'asc' ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}
            </button>
            <button onClick={openNew} className="btn-primary flex-shrink-0">
              <Plus size={16} /> Добави
            </button>
          </div>
          <DataTable columns={columns} data={sorted} loading={loading}
            onEdit={openEdit} onDelete={handleDelete} />
        </div>
      </div>

      <Modal open={modal} onClose={closeEditor}
        title={isNew ? 'Добавяне на бенефициент' : 'Редакция на бенефициент'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group md:col-span-2">
            <label className="form-label">Снимка</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded border border-gray-200 bg-gray-50 p-3">
              {photoPreview ? (
                <button type="button" onClick={() => setViewPhoto(photoPreview)}
                  className="w-24 h-24 rounded border border-gray-200 bg-white overflow-hidden hover:ring-2 hover:ring-[#3c8dbc] flex-shrink-0"
                  title="Виж снимка">
                  <img src={photoPreview} alt="Преглед на снимката" className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="w-24 h-24 rounded border border-dashed border-gray-300 bg-white flex items-center justify-center text-gray-300 flex-shrink-0">
                  <ImageIcon size={34} />
                </div>
              )}
              <div>
                <label htmlFor="beneficiary-photo" className="btn-default cursor-pointer">
                  <Upload size={16} /> {photoPreview ? 'Смени снимката' : 'Качи снимка'}
                </label>
                <input id="beneficiary-photo" type="file" accept="image/*" className="sr-only"
                  onChange={handlePhotoChange} />
                <p className="text-xs text-gray-500 mt-2">JPG, PNG или друго изображение до 10 MB. Снимката се оптимизира автоматично. Кликнете върху нея за голям преглед.</p>
              </div>
            </div>
          </div>
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
            <label className="form-label">Бащино име</label>
            <input type="text" className="form-control" value={editing.middleName ?? ''}
              onChange={e => setEditing(v => ({ ...v, middleName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Пол</label>
            <input type="text" className="form-control" value={editing.gender ?? ''}
              onChange={e => setEditing(v => ({ ...v, gender: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">ЕГН</label>
            <input type="text" className="form-control" value={editing.egn ?? ''}
              onChange={e => setEditing(v => ({ ...v, egn: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Статут</label>
            <input type="text" className="form-control" value={editing.status ?? ''}
              onChange={e => setEditing(v => ({ ...v, status: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Държава на раждане</label>
            <input type="text" className="form-control" value={editing.country ?? ''}
              onChange={e => setEditing(v => ({ ...v, country: e.target.value }))} />
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
          <div className="form-group">
            <label className="form-label">Настоящ адрес</label>
            <input type="text" className="form-control" value={editing.currentAddress ?? ''}
              onChange={e => setEditing(v => ({ ...v, currentAddress: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Ментор</label>
            <input type="text" className="form-control" value={editing.mentor ?? ''}
              onChange={e => setEditing(v => ({ ...v, mentor: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Дата на раждане</label>
            <input type="date" className="form-control"
              value={editing.birthDate ?? ''}
              onChange={e => setEditing(v => ({ ...v, birthDate: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Поискана помощ</label>
            <textarea className="form-control resize-none" rows={2} value={editing.requestedHelp ?? ''}
              onChange={e => setEditing(v => ({ ...v, requestedHelp: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Образование</label>
            <input type="text" className="form-control" value={editing.education ?? ''}
              onChange={e => setEditing(v => ({ ...v, education: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Уязвимост</label>
            <input type="text" className="form-control" value={editing.vulnerability ?? ''}
              onChange={e => setEditing(v => ({ ...v, vulnerability: e.target.value }))} />
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
          <button onClick={closeEditor} className="btn-default">Откажи</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Запис...' : (isNew ? 'Добави' : 'Запази')}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(viewPhoto)} onClose={() => setViewPhoto('')} title="Снимка на бенефициент" size="xl">
        <div className="flex items-center justify-center min-h-64 bg-gray-50 rounded">
          {viewPhoto && <img src={viewPhoto} alt="Снимка на бенефициент" className="max-w-full max-h-[72vh] object-contain" />}
        </div>
      </Modal>
    </AdminLayout>
  )
}
