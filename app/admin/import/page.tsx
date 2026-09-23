'use client'
import { useCallback, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { auth, db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  detectSheetType, mapBeneficiaryRow, mapRequestRow,
  type ImportSheetType, type RawRow,
} from '@/lib/import-mapping'

interface SheetPreview {
  name: string
  headers: string[]
  rows: RawRow[]
  type: ImportSheetType
}

interface ImportResult {
  sheet: string
  rows: number
  beneficiariesCreated: number
  beneficiariesUpdated: number
  requestsCreated: number
  requestsUpdated: number
  skipped: number
  errors: string[]
}

type WriteItem = { collectionName: 'beneficiaries' | 'beneficiaryRequests'; id: string; data: Record<string, unknown> }

async function requireAdmin() {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Необходим е вход в системата')
  const profile = await getDoc(doc(db, 'users', user.uid))
  if (!profile.exists() || profile.data().role !== 'admin') throw new Error('Само администратор може да импортира данни')
  return { uid: user.uid, name: profile.data().displayName || user.email || 'Администратор' }
}

async function deleteCollection(collectionName: string, onProgress: (value: number) => void) {
  const snapshot = await getDocs(collection(db, collectionName))
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = writeBatch(db)
    snapshot.docs.slice(offset, offset + 400).forEach(item => batch.delete(item.ref))
    await batch.commit()
    onProgress(Math.round(Math.min(offset + 400, snapshot.docs.length) / Math.max(snapshot.docs.length, 1) * 100))
  }
}

async function commitWrites(items: WriteItem[], onProgress: (value: number) => void) {
  for (let offset = 0; offset < items.length; offset += 400) {
    const batch = writeBatch(db)
    for (const item of items.slice(offset, offset + 400)) {
      batch.set(doc(db, item.collectionName, item.id), item.data, { merge: true })
    }
    await batch.commit()
    onProgress(Math.round(Math.min(offset + 400, items.length) / Math.max(items.length, 1) * 100))
  }
}

async function importSheet(sheet: SheetPreview, onProgress: (value: number) => void): Promise<ImportResult> {
  const admin = await requireAdmin()
  const importedAt = new Date().toISOString()
  const [beneficiarySnapshot, requestSnapshot] = await Promise.all([
    getDocs(collection(db, 'beneficiaries')),
    getDocs(collection(db, 'beneficiaryRequests')),
  ])
  const existingBeneficiaries = new Set(beneficiarySnapshot.docs.map(item => item.id))
  const existingRequests = new Set(requestSnapshot.docs.map(item => item.id))
  const beneficiaries = new Map<string, Record<string, unknown>>()
  const requests = new Map<string, Record<string, unknown>>()
  const errors: string[] = []
  let skipped = 0

  sheet.rows.forEach((row, index) => {
    try {
      if (sheet.type === 'combined' || sheet.type === 'beneficiaries') {
        const { documentId, beneficiary } = mapBeneficiaryRow(row, sheet.headers, importedAt)
        if (documentId && (beneficiary.firstName || beneficiary.lastName)) {
          beneficiaries.set(documentId, {
            ...beneficiary,
            createdByUid: admin.uid,
            createdByName: admin.name,
          })
        } else if (sheet.type === 'beneficiaries') skipped++
      }

      if (sheet.type === 'combined' || sheet.type === 'requests') {
        const { documentId, request } = mapRequestRow(row, sheet.headers, importedAt)
        if (documentId && (request.activity || request.beneficiaryName)) {
          requests.set(documentId, {
            ...request,
            createdByUid: admin.uid,
            createdByName: admin.name,
          })
        } else if (sheet.type === 'requests') skipped++
      }
    } catch (error) {
      errors.push(`Ред ${index + 2}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const writes: WriteItem[] = [
    ...Array.from(beneficiaries, ([id, data]) => ({ collectionName: 'beneficiaries' as const, id, data })),
    ...Array.from(requests, ([id, data]) => ({ collectionName: 'beneficiaryRequests' as const, id, data })),
  ]
  await commitWrites(writes, onProgress)

  return {
    sheet: sheet.name,
    rows: sheet.rows.length,
    beneficiariesCreated: Array.from(beneficiaries.keys()).filter(id => !existingBeneficiaries.has(id)).length,
    beneficiariesUpdated: Array.from(beneficiaries.keys()).filter(id => existingBeneficiaries.has(id)).length,
    requestsCreated: Array.from(requests.keys()).filter(id => !existingRequests.has(id)).length,
    requestsUpdated: Array.from(requests.keys()).filter(id => existingRequests.has(id)).length,
    skipped,
    errors,
  }
}

const TYPE_LABEL: Record<ImportSheetType, string> = {
  combined: 'Бенефициенти + заявки',
  beneficiaries: 'Бенефициенти',
  requests: 'Заявки за дейности',
  unknown: 'Неразпознат лист',
}

export default function ImportPage() {
  const [sheets, setSheets] = useState<SheetPreview[]>([])
  const [fileName, setFileName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearBeforeImport, setClearBeforeImport] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [results, setResults] = useState<ImportResult[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    setBusy(true)
    setResults([])
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false, cellDates: false })
      const parsed = workbook.SheetNames.flatMap(name => {
        const data = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[name], { header: 1, defval: null, raw: false })
        if (data.length < 2) return []
        const headers = data[0].map(value => String(value ?? '').trim())
        const rows = data.slice(1).filter(row => row.some(value => value !== null && value !== ''))
        return [{ name, headers, rows, type: detectSheetType(headers) }]
      })
      setSheets(parsed)
      setFileName(file.name)
      setExpanded(parsed[0]?.name || null)
      if (!parsed.length) toast.error('Файлът не съдържа данни')
    } catch (error) {
      console.error(error)
      toast.error('Файлът не може да бъде прочетен')
    } finally {
      setBusy(false)
    }
  }, [])

  async function handleImport() {
    const recognized = sheets.filter(sheet => sheet.type !== 'unknown')
    if (!recognized.length) return toast.error('Няма разпознати листове за импорт')
    if (clearBeforeImport && !confirm('Ще бъдат изтрити всички текущи бенефициенти и заявки. Продължавате ли?')) return

    setBusy(true)
    setResults([])
    try {
      await requireAdmin()
      if (clearBeforeImport) {
        setProgressLabel('Изчистване на текущите бенефициенти...')
        await deleteCollection('beneficiaries', setProgress)
        setProgressLabel('Изчистване на текущите заявки...')
        await deleteCollection('beneficiaryRequests', setProgress)
      }

      const completed: ImportResult[] = []
      for (const sheet of recognized) {
        setProgress(0)
        setProgressLabel(`Импорт на ${sheet.name}...`)
        completed.push(await importSheet(sheet, setProgress))
      }
      setResults(completed)
      toast.success('Импортът приключи успешно')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Грешка при импорт')
    } finally {
      setBusy(false)
      setProgressLabel('')
      setProgress(0)
    }
  }

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><span>Начало</span><span>/</span><span className="text-gray-800 font-medium">Импорт</span></div>
      <div className="max-w-5xl space-y-5">
        <div className="box">
          <div className="box-header"><span className="box-title flex items-center gap-2"><FileSpreadsheet size={18} /> Импорт от Excel</span></div>
          <div className="box-body">
            <p className="text-sm text-gray-600 mb-4">Импортът разпознава комбинираната таблица и записва всички колони в правилните полета. Съществуващите записи със същия ID се обновяват, вместо да се пропускат.</p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 hover:border-[var(--brand-primary)] rounded-lg p-10 text-center transition-colors">
              <Upload size={38} className="mx-auto mb-3 text-[var(--brand-primary)]" />
              <span className="block text-sm font-medium text-gray-700">{fileName || 'Избери .xlsx, .xls или .csv файл'}</span>
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => event.target.files?.[0] && parseFile(event.target.files[0])} />
          </div>
        </div>

        {sheets.map(sheet => (
          <div key={sheet.name} className="box">
            <button className="box-header w-full text-left" onClick={() => setExpanded(expanded === sheet.name ? null : sheet.name)}>
              <span className="flex items-center gap-3">
                <span className="box-title">{sheet.name}</span>
                <span className={sheet.type === 'unknown' ? 'label-warning' : 'label-success'}>{TYPE_LABEL[sheet.type]}</span>
                <span className="text-xs text-gray-500">{sheet.rows.length} реда · {sheet.headers.length} колони</span>
              </span>
              {expanded === sheet.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded === sheet.name && (
              <div className="box-body">
                <div className="flex flex-wrap gap-1 mb-4">{sheet.headers.map(header => <span key={header} className="text-xs border rounded px-2 py-1 bg-gray-50">{header}</span>)}</div>
                <div className="overflow-x-auto"><table className="text-xs min-w-full"><thead><tr>{sheet.headers.map(header => <th key={header} className="text-left px-2 py-2 border-b whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{sheet.rows.slice(0, 3).map((row, rowIndex) => <tr key={rowIndex}>{sheet.headers.map((header, columnIndex) => <td key={header} className="px-2 py-2 border-b max-w-[220px] truncate" title={String(row[columnIndex] ?? '')}>{String(row[columnIndex] ?? '')}</td>)}</tr>)}</tbody></table></div>
              </div>
            )}
          </div>
        ))}

        {sheets.length > 0 && (
          <div className="box"><div className="box-body">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={clearBeforeImport} onChange={event => setClearBeforeImport(event.target.checked)} /> Изтрий текущите бенефициенти и заявки преди импорт</label>
              <button onClick={handleImport} disabled={busy || sheets.every(sheet => sheet.type === 'unknown')} className="btn-primary disabled:opacity-50">
                {busy ? <><RefreshCw size={15} className="animate-spin" /> Обработка...</> : <><Upload size={15} /> Започни импорт</>}
              </button>
            </div>
            {clearBeforeImport && <p className="mt-3 flex items-center gap-2 text-xs text-red-600"><AlertTriangle size={14} /> Тази опция изтрива всички текущи бенефициенти и заявки. Използвай я само за пълна подмяна.</p>}
            {progressLabel && <div className="mt-4"><div className="flex justify-between text-xs text-gray-500"><span>{progressLabel}</span><span>{progress}%</span></div><div className="h-2 bg-gray-200 rounded mt-1"><div className="h-2 bg-[var(--brand-primary)] rounded" style={{ width: `${progress}%` }} /></div></div>}
          </div></div>
        )}

        {results.map(result => (
          <div key={result.sheet} className="box"><div className="box-header"><span className="box-title flex items-center gap-2"><CheckCircle size={18} className="text-green-600" /> Резултат: {result.sheet}</span></div><div className="box-body">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="bg-gray-50 p-3 rounded"><strong className="block text-xl">{result.rows}</strong><span className="text-xs text-gray-500">Редове</span></div>
              <div className="bg-green-50 p-3 rounded"><strong className="block text-xl text-green-700">{result.beneficiariesCreated}</strong><span className="text-xs text-gray-500">Нови бенефициенти</span></div>
              <div className="bg-blue-50 p-3 rounded"><strong className="block text-xl text-blue-700">{result.beneficiariesUpdated}</strong><span className="text-xs text-gray-500">Обновени бенефициенти</span></div>
              <div className="bg-green-50 p-3 rounded"><strong className="block text-xl text-green-700">{result.requestsCreated}</strong><span className="text-xs text-gray-500">Нови заявки</span></div>
              <div className="bg-blue-50 p-3 rounded"><strong className="block text-xl text-blue-700">{result.requestsUpdated}</strong><span className="text-xs text-gray-500">Обновени заявки</span></div>
            </div>
            {(result.skipped > 0 || result.errors.length > 0) && <p className="mt-3 text-sm text-amber-700">Пропуснати: {result.skipped}. Грешки: {result.errors.length}.</p>}
          </div></div>
        ))}
      </div>
    </AdminLayout>
  )
}
