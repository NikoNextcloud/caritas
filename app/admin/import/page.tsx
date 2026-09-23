'use client'
import { useState, useRef, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { db } from '@/lib/firebase'
import { collection, doc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore'
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Trash2
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ── Типове ──────────────────────────────────────────────────────
type RawRow = (string | number | null)[]

interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

interface SheetPreview {
  name: string
  headers: string[]
  rows: RawRow[]
  totalRows: number
  type: 'beneficiaries' | 'requests' | 'unknown'
}

// ── Helpers ──────────────────────────────────────────────────────
function str(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function detectType(headers: string[]): SheetPreview['type'] {
  const h = headers.map(x => String(x).toLowerCase())
  if (h.includes('egn') || h.includes('phone number')) return 'beneficiaries'
  if (h.some(x => x.includes('случай') || x.includes('заявка id'))) return 'requests'
  return 'unknown'
}

// ── Mapper: Beneficients sheet → Firestore beneficiaries ─────────
// Точни имена от Excel:
// ID | Created | First Name | Last Name | Midle Name | Gender |
// Date of birth | Country of birth | EGN | GDPR | Phone number |
// Status | Mentor | Address | Current Address | Email |
// Requested help | Education | Has Document | Experience |
// Initial Income | Current Income | Case Description |
// Work Experiance | Family status | Number of Kids | Vulnerability | Last Edited

function mapBeneficiary(row: RawRow, headers: string[]) {
  const h = headers
  const g = (name: string) => str(row[h.indexOf(name)])
  const n = (name: string) => num(row[h.indexOf(name)])

  const id = n('ID') // числово ID от старата база

  return {
    id:              id ? String(id) : null,   // ще се използва като document ID
    externalId:      id,
    firstName:       g('First Name'),
    lastName:        g('Last Name'),
    middleName:      g('Midle Name'),
    gender:          g('Gender'),
    birthDate:       g('Date of birth'),
    country:         g('Country of birth'),
    egn:             str(row[h.indexOf('EGN')]),
    gdpr:            g('GDPR'),
    phone:           str(row[h.indexOf('Phone number')]),
    status:          g('Status'),
    mentor:          g('Mentor'),
    address:         g('Address'),
    currentAddress:  g('Current Address'),
    email:           g('Email'),
    requestedHelp:   g('Requested help'),
    education:       g('Education'),
    hasDocument:     g('Has Document'),
    experience:      g('Experience'),
    initialIncome:   g('Initial Income'),
    currentIncome:   g('Current Income'),
    caseDescription: g('Case Description'),
    workExperience:  g('Work Experiance'),
    familyStatus:    g('Family status'),
    numberOfKids:    g('Number of Kids'),
    vulnerability:   g('Vulnerability'),
    createdAt:       g('Created') || new Date().toISOString(),
    lastEdited:      g('Last Edited'),
    updatedAt:       new Date().toISOString(),
    importedAt:      new Date().toISOString(),
    source:          'import',
  }
}

// ── Mapper: Beneficients Data sheet → Firestore beneficiaryRequests ──
// Точни имена от Excel:
// ID на бенефициента | First Name | Last Name | Midle Name | Gender |
// Date of birth | Country of birth | EGN | Status | ID |
// Създаване | Заглавие | Тип | Описание | Тагове | Коментар |
// Случай 1..6 | Бенефициент | От Потребител | Заявка ID |
// Vulnerability | Задача ID | Задача за

function parseCase(raw: string | number | null) {
  const s = str(raw)
  if (!s || s === 'None') return undefined
  // Формат: "31.08.2026 - Николета - Описание..."
  const dashIdx = s.indexOf(' - ')
  if (dashIdx < 0) return { date: '', operator: '', description: s }
  const date = s.slice(0, dashIdx).trim()
  const rest = s.slice(dashIdx + 3)
  const dash2 = rest.indexOf(' - ')
  if (dash2 < 0) return { date, operator: rest.trim(), description: '' }
  return {
    date,
    operator: rest.slice(0, dash2).trim(),
    description: rest.slice(dash2 + 3).trim(),
  }
}

function mapRequest(row: RawRow, headers: string[]) {
  const h = headers
  const g = (name: string) => str(row[h.indexOf(name)])
  const n = (name: string) => num(row[h.indexOf(name)])

  const requestId = n('Заявка ID') || n('ID')
  const benefId   = n('ID на бенефициента')

  const c1 = parseCase(row[h.indexOf('Случай 1')])
  const c2 = parseCase(row[h.indexOf('Случай 2')])
  const c3 = parseCase(row[h.indexOf('Случай 3')])
  const c4 = parseCase(row[h.indexOf('Случай 4')])
  const c5 = parseCase(row[h.indexOf('Случай 5')])
  const c6 = parseCase(row[h.indexOf('Случай 6')])

  const obj: Record<string, unknown> = {
    id:              requestId ? String(requestId) : null,
    externalId:      requestId,
    beneficiaryId:   benefId ? String(benefId) : '',
    beneficiaryName: g('Бенефициент'),
    firstName:       g('First Name'),
    lastName:        g('Last Name'),
    middleName:      g('Midle Name'),
    gender:          g('Gender'),
    birthDate:       g('Date of birth'),
    country:         g('Country of birth'),
    egn:             str(row[h.indexOf('EGN')]),
    benefStatus:     g('Status'),
    activity:        g('Заглавие'),
    type:            g('Тип'),
    message:         g('Описание'),
    tags:            g('Тагове'),
    comment:         g('Коментар'),
    operator:        g('От Потребител'),
    vulnerability:   g('Vulnerability'),
    taskId:          n('Задача ID'),
    taskFor:         g('Задача за'),
    status:          'Потвърдено',
    createdAt:       g('Създаване') || new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
    importedAt:      new Date().toISOString(),
    source:          'import',
  }

  // Добавяме само непразните cases
  if (c1) obj.case1 = c1
  if (c2) obj.case2 = c2
  if (c3) obj.case3 = c3
  if (c4) obj.case4 = c4
  if (c5) obj.case5 = c5
  if (c6) obj.case6 = c6

  // Изчистваме празни стойности
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  )
}

// ── Firestore import ──────────────────────────────────────────────
async function importBeneficiaries(
  rows: RawRow[],
  headers: string[],
  onProgress: (n: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] }

  // Намери съществуващите IDs
  const existing = await getDocs(collection(db, 'beneficiaries'))
  const existingIds = new Set(existing.docs.map(d => d.id))

  const BATCH = 400
  let batch = writeBatch(db)
  let batchCount = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapBeneficiary(rows[i], headers)
      if (!mapped.firstName && !mapped.lastName) { result.skipped++; continue }

      // Използваме числовото ID от старата база като document ID
      const docId = mapped.id ? String(mapped.id) : `ben_${Date.now()}_${i}`

      if (existingIds.has(docId)) { result.skipped++; continue }

      // Изчистваме null/'' стойности преди запис
      const clean = Object.fromEntries(
        Object.entries(mapped).filter(([k, v]) => k !== 'id' && v !== null && v !== '' && v !== undefined)
      )

      batch.set(doc(db, 'beneficiaries', docId), clean)
      batchCount++
      result.imported++

      if (batchCount >= BATCH) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }

      if (i % 20 === 0) onProgress(Math.round((i / rows.length) * 100))
    } catch (err) {
      result.errors.push(`Ред ${i + 2}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (batchCount > 0) await batch.commit()
  onProgress(100)
  return result
}

async function importRequests(
  rows: RawRow[],
  headers: string[],
  onProgress: (n: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] }

  const existing = await getDocs(collection(db, 'beneficiaryRequests'))
  const existingIds = new Set(existing.docs.map(d => d.id))

  const BATCH = 400
  let batch = writeBatch(db)
  let batchCount = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapRequest(rows[i], headers)
      if (!mapped.activity) { result.skipped++; continue }

      // Заявка ID от старата база като document ID
      const docId = mapped.id ? String(mapped.id) : `req_${Date.now()}_${i}`
      if (existingIds.has(docId)) { result.skipped++; continue }

      const { id: _id, ...clean } = mapped
      void _id

      batch.set(doc(db, 'beneficiaryRequests', docId), clean)
      batchCount++
      result.imported++

      if (batchCount >= BATCH) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }

      if (i % 50 === 0) onProgress(Math.round((i / rows.length) * 100))
    } catch (err) {
      result.errors.push(`Ред ${i + 2}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (batchCount > 0) await batch.commit()
  onProgress(100)
  return result
}

// ── Изтрий всички бенефициенти + заявки ─────────────────────────
async function deleteAllFromCollection(
  colName: string,
  onProgress: (n: number) => void
): Promise<number> {
  const snap = await getDocs(collection(db, colName))
  const total = snap.docs.length
  if (total === 0) return 0

  const BATCH = 400
  let batch = writeBatch(db)
  let count = 0
  let deleted = 0

  for (const d of snap.docs) {
    batch.delete(doc(db, colName, d.id))
    count++
    deleted++
    if (count >= BATCH) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
      onProgress(Math.round((deleted / total) * 100))
    }
  }
  if (count > 0) await batch.commit()
  onProgress(100)
  return deleted
}

// ── UI ───────────────────────────────────────────────────────────
export default function ImportPage() {
  const [sheets, setSheets]               = useState<SheetPreview[]>([])
  const [fileName, setFileName]           = useState('')
  const [dragging, setDragging]           = useState(false)
  const [parsing, setParsing]             = useState(false)
  const [importing, setImporting]         = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [clearBeforeImport, setClearBeforeImport] = useState(true)
  const [progress, setProgress]           = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [results, setResults]             = useState<{ sheet: string; result: ImportResult }[]>([])
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null)
  const [deleteCount, setDeleteCount]     = useState<{ben: number, req: number} | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    setParsing(true)
    setSheets([])
    setResults([])
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', raw: false, cellDates: false })

      const parsed: SheetPreview[] = []
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        const rawData = XLSX.utils.sheet_to_json<RawRow>(ws, {
          header: 1, defval: null, raw: false,
        })

        if (rawData.length < 2) continue

        const headers = (rawData[0] as (string | null)[]).map(h => String(h ?? ''))
        const rows = rawData.slice(1) as RawRow[]
        const validRows = rows.filter(r => r.some(v => v !== null && v !== ''))

        parsed.push({
          name: sheetName,
          headers,
          rows: validRows,
          totalRows: validRows.length,
          type: detectType(headers),
        })
      }

      setSheets(parsed)
      setFileName(file.name)
      if (parsed.length > 0) setExpandedSheet(parsed[0].name)
    } catch (err) {
      toast.error('Грешка при четене на файла')
      console.error(err)
    }
    setParsing(false)
  }, [])

  async function handleDeleteAll() {
    if (!confirm('⚠️ Внимание! Ще изтриеш ВСИЧКИ бенефициенти и заявки от Firebase. Сигурен ли си?')) return
    if (!confirm('Последно потвърждение — изтриване на ВСИЧКИ данни?')) return

    setDeleting(true)
    setDeleteCount(null)
    try {
      setProgressLabel('Изтриване на бенефициенти...')
      setProgress(0)
      const ben = await deleteAllFromCollection('beneficiaries', setProgress)

      setProgressLabel('Изтриване на заявки...')
      setProgress(0)
      const req = await deleteAllFromCollection('beneficiaryRequests', setProgress)

      setDeleteCount({ ben, req })
      toast.success(`Изтрити: ${ben} бенефициента и ${req} заявки`)
    } catch (err) {
      toast.error('Грешка при изтриване')
      console.error(err)
    }
    setDeleting(false)
    setProgressLabel('')
    setProgress(0)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
    else toast.error('Само .xlsx, .xls или .csv файлове')
  }

  async function handleImport() {
    const toImport = sheets.filter(s => s.type !== 'unknown')
    if (toImport.length === 0) { toast.error('Няма разпознати листове'); return }

    setImporting(true)
    setResults([])
    const allResults: { sheet: string; result: ImportResult }[] = []

    // Изтрий преди импорт ако е избрано
    if (clearBeforeImport) {
      try {
        const hasBen = toImport.some(s => s.type === 'beneficiaries')
        const hasReq = toImport.some(s => s.type === 'requests')
        if (hasBen) {
          setProgressLabel('Изчистване на стари бенефициенти...')
          setProgress(0)
          await deleteAllFromCollection('beneficiaries', setProgress)
        }
        if (hasReq) {
          setProgressLabel('Изчистване на стари заявки...')
          setProgress(0)
          await deleteAllFromCollection('beneficiaryRequests', setProgress)
        }
      } catch (err) {
        toast.error('Грешка при изчистване')
        console.error(err)
        setImporting(false)
        return
      }
    }

    for (const sheet of toImport) {
      setProgressLabel(`Импортиране: ${sheet.name} (${sheet.totalRows} реда)...`)
      setProgress(0)
      try {
        let result: ImportResult
        if (sheet.type === 'beneficiaries') {
          result = await importBeneficiaries(sheet.rows, sheet.headers, setProgress)
        } else {
          result = await importRequests(sheet.rows, sheet.headers, setProgress)
        }
        allResults.push({ sheet: sheet.name, result })
        toast.success(`${sheet.name}: ${result.imported} импортирани`)
      } catch (err) {
        toast.error(`Грешка при ${sheet.name}`)
        allResults.push({
          sheet: sheet.name,
          result: { total: sheet.totalRows, imported: 0, skipped: 0, errors: [String(err)] }
        })
      }
    }

    setResults(allResults)
    setImporting(false)
    setProgressLabel('')
    setProgress(0)
  }

  const typeLabel: Record<SheetPreview['type'], { label: string; cls: string }> = {
    beneficiaries: { label: 'Бенефициенти',       cls: 'label-success' },
    requests:      { label: 'Заявки за дейности', cls: 'label-info' },
    unknown:       { label: 'Непознат',            cls: 'label-default' },
  }

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Импорт на данни</span>
      </div>

      <div className="max-w-4xl space-y-5">

        {/* DROP ZONE */}
        <div className="box">
          <div className="box-header">
            <span className="box-title flex items-center gap-2">
              <FileSpreadsheet size={18} /> Импорт от Excel
            </span>
          </div>
          <div className="box-body">
            <p className="text-sm text-gray-500 mb-4">
              Провлачи или избери <strong>export.xlsx</strong> от старата Caritas система.
              Автоматично разпознава листовете и импортира <strong>всички колони</strong>.
              ID-тата запазват числовите стойности от старата база.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all
                ${dragging
                  ? 'border-[#3c8dbc] bg-blue-50'
                  : 'border-gray-300 hover:border-[#3c8dbc] hover:bg-gray-50'}`}
            >
              <Upload size={40} className={`mx-auto mb-3 ${dragging ? 'text-[#3c8dbc]' : 'text-gray-300'}`} />
              {fileName
                ? <p className="text-sm font-medium text-[#3c8dbc]">📊 {fileName}</p>
                : <p className="text-sm font-medium text-gray-600">Провлачи файла тук или клик за избор</p>
              }
              <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                className="hidden" onChange={onFileChange} />
            </div>

            {parsing && (
              <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
                <RefreshCw size={16} className="animate-spin text-[#3c8dbc]" />
                Четене на файла...
              </div>
            )}
          </div>
        </div>

        {/* SHEET PREVIEWS */}
        {sheets.map(sheet => (
          <div key={sheet.name} className="box">
            <div
              className="box-header cursor-pointer select-none"
              onClick={() => setExpandedSheet(expandedSheet === sheet.name ? null : sheet.name)}
            >
              <div className="flex items-center gap-3">
                <span className="box-title">{sheet.name}</span>
                <span className={typeLabel[sheet.type].cls + ' text-xs'}>
                  {typeLabel[sheet.type].label}
                </span>
                <span className="text-xs text-gray-400">{sheet.totalRows} реда · {sheet.headers.length} колони</span>
                {sheet.type === 'unknown' && (
                  <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangle size={13} /> Ще бъде пропуснат
                  </span>
                )}
              </div>
              {expandedSheet === sheet.name
                ? <ChevronUp size={16} className="text-gray-400" />
                : <ChevronDown size={16} className="text-gray-400" />
              }
            </div>

            {expandedSheet === sheet.name && (
              <div className="box-body p-0">
                {/* Колони */}
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Колони ({sheet.headers.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {sheet.headers.filter(Boolean).map(h => (
                      <span key={h} className="bg-white border border-gray-200 text-gray-600
                        text-xs px-2 py-0.5 rounded">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {sheet.headers.slice(0, 10).map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b">
                            {h}
                          </th>
                        ))}
                        {sheet.headers.length > 10 && (
                          <th className="px-3 py-2 text-gray-400 border-b">
                            +{sheet.headers.length - 10} още
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          {sheet.headers.slice(0, 10).map((h, hi) => (
                            <td key={h} className="px-3 py-2 text-gray-600 max-w-[160px] truncate"
                              title={String(row[hi] ?? '')}>
                              {String(row[hi] ?? '')}
                            </td>
                          ))}
                          {sheet.headers.length > 10 && <td />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-2 text-xs text-gray-400 border-t">
                  Показани 3 от {sheet.totalRows} реда
                </p>
              </div>
            )}
          </div>
        ))}

        {/* IMPORT BUTTON + PROGRESS */}
        {sheets.length > 0 && (
          <div className="box">
            <div className="box-body">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  {sheets.filter(s => s.type !== 'unknown').map(s => (
                    <p key={s.name} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle size={15} className="text-green-500" />
                      <strong>{s.name}</strong> — {s.totalRows} реда за импорт
                    </p>
                  ))}
                  {sheets.filter(s => s.type === 'unknown').map(s => (
                    <p key={s.name} className="flex items-center gap-2 text-sm text-gray-400">
                      <XCircle size={15} />
                      <strong>{s.name}</strong> — ще бъде пропуснат
                    </p>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-3">
                  {/* Опция за изчистване преди импорт */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={clearBeforeImport}
                      onChange={e => setClearBeforeImport(e.target.checked)}
                      className="w-4 h-4 cursor-pointer accent-[#3c8dbc]"
                    />
                    <span className="text-sm text-gray-600">
                      Изчисти старите данни преди импорт <span className="text-[#3c8dbc] font-medium">(препоръчано)</span>
                    </span>
                  </label>

                  <button
                    onClick={handleImport}
                    disabled={importing || deleting || sheets.every(s => s.type === 'unknown')}
                    className="btn-primary disabled:opacity-50 px-6 py-2.5"
                  >
                    {importing
                      ? <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Импортиране...
                        </span>
                      : <><Upload size={15} /> Започни импорт</>
                    }
                  </button>
                </div>
              </div>

              {importing && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{progressLabel}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-[#3c8dbc] h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {results.length > 0 && (
          <div className="box">
            <div className="box-header">
              <span className="box-title flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" /> Резултати
              </span>
            </div>
            <div className="box-body space-y-4">
              {results.map(({ sheet, result }) => (
                <div key={sheet} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-700 mb-3">{sheet}</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Общо реда</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                      <p className="text-xs text-gray-500 mt-1">Импортирани</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded">
                      <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                      <p className="text-xs text-gray-500 mt-1">Пропуснати</p>
                    </div>
                  </div>
                  {result.errors.length > 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                        <XCircle size={13} /> {result.errors.length} грешки
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {result.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">{e}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle size={15} /> Успешен импорт без грешки!
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ОПАСНА ЗОНА - Изтриване */}
        <div className="box border-red-200">
          <div className="box-header" style={{borderBottom: '1px solid #fecaca'}}>
            <span className="box-title flex items-center gap-2 text-red-700">
              <Trash2 size={18} /> Опасна зона
            </span>
          </div>
          <div className="box-body space-y-4">
            <p className="text-sm text-gray-600">
              Изтрий <strong>всички</strong> бенефициенти и заявки от Firebase преди нов импорт.
              Използвай само ако искаш да започнеш от нулата.
            </p>

            {deleteCount && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                <CheckCircle size={14} className="inline mr-1" />
                Изтрити: <strong>{deleteCount.ben}</strong> бенефициента и <strong>{deleteCount.req}</strong> заявки
              </div>
            )}

            {deleting && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleDeleteAll()}
                disabled={deleting || importing}
                className="btn-danger disabled:opacity-50"
              >
                {deleting
                  ? <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Изтриване...
                    </span>
                  : <><Trash2 size={15} /> Изтрий всички бенефициенти и заявки</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* INFO */}
        <div className="box">
          <div className="box-header"><span className="box-title">Информация</span></div>
          <div className="box-body text-sm text-gray-600 space-y-2">
            <p>• Лист <strong>Beneficients</strong> (249 реда) → колекция <code>beneficiaries</code> — всички 28 колони</p>
            <p>• Лист <strong>Beneficients Data</strong> (2968 реда) → колекция <code>beneficiaryRequests</code> — всички 28 колони + Cases</p>
            <p>• <strong>ID-тата са числови</strong> от старата база (950, 1218...) — не случайни низове</p>
            <p>• <strong>Изчисти преди импорт</strong> — гарантира без дублиране</p>
            <p>• Cases се парсват автоматично: <code>31.08.2026 - Оператор - Описание</code></p>
            <p>• При 2968 реда импортът отнема около 2-3 минути</p>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}
