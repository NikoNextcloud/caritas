'use client'
import { useState, useRef, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { db } from '@/lib/firebase'
import {
  collection, doc, setDoc, writeBatch, getDocs, query, where
} from 'firebase/firestore'
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ── Типове ──────────────────────────────────────────────────
interface ImportRow { [key: string]: string | number | null }

interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

interface SheetPreview {
  name: string
  headers: string[]
  rows: ImportRow[]
  totalRows: number
  type: 'beneficiaries' | 'requests' | 'unknown'
}

// ── Mapping на колони от XLSX към Firestore ──────────────────
function detectSheetType(headers: string[]): SheetPreview['type'] {
  const h = headers.map(x => String(x).toLowerCase())
  if (h.includes('egn') || h.includes('phone number') || h.includes('gdpr')) return 'beneficiaries'
  if (h.some(x => x.includes('случай') || x.includes('заявка id') || x.includes('заглавие'))) return 'requests'
  return 'unknown'
}

function mapBeneficiary(row: ImportRow, headers: string[]) {
  const get = (key: string) => {
    const idx = headers.findIndex(h =>
      h.toLowerCase() === key.toLowerCase() ||
      h.toLowerCase().includes(key.toLowerCase())
    )
    return idx >= 0 ? String(row[headers[idx]] ?? '').trim() : ''
  }

  return {
    externalId: String(get('ID') || get('id') || ''),
    firstName:  get('First Name'),
    lastName:   get('Last Name'),
    middleName: get('Midle Name') || get('Middle Name'),
    gender:     get('Gender'),
    birthDate:  get('Date of birth'),
    country:    get('Country of birth'),
    egn:        get('EGN'),
    status:     get('Status'),
    phone:      get('Phone number'),
    email:      get('Email'),
    address:    get('Address'),
    currentAddress: get('Current Address'),
    familyStatus:   get('Family status'),
    numberOfKids:   get('Number of Kids'),
    vulnerability:  get('Vulnerability'),
    education:      get('Education'),
    notes:          get('Case Description'),
    createdAt:  get('Created') || new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    importedAt: new Date().toISOString(),
    source:     'import',
  }
}

function mapRequest(row: ImportRow, headers: string[]) {
  const get = (key: string) => {
    const idx = headers.findIndex(h =>
      h.toLowerCase() === key.toLowerCase() ||
      h.toLowerCase().includes(key.toLowerCase())
    )
    return idx >= 0 ? String(row[headers[idx]] ?? '').trim() : ''
  }

  const parseCase = (raw: string) => {
    if (!raw || raw === 'None' || raw === '') return undefined
    // Формат: "31.08.2026 - Николета - Описание..."
    const parts = raw.split(' - ')
    return {
      date: parts[0]?.trim() ?? '',
      operator: parts[1]?.trim() ?? '',
      description: parts.slice(2).join(' - ').trim(),
    }
  }

  return {
    externalId:      get('Заявка ID') || get('ID'),
    activity:        get('Заглавие'),
    message:         get('Описание'),
    type:            get('Тип'),
    comment:         get('Коментар'),
    tags:            get('Тагове'),
    case1:           parseCase(get('Случай 1')),
    case2:           parseCase(get('Случай 2')),
    case3:           parseCase(get('Случай 3')),
    case4:           parseCase(get('Случай 4')),
    case5:           parseCase(get('Случай 5')),
    case6:           parseCase(get('Случай 6')),
    beneficiaryId:   get('ID на бенефициента'),
    beneficiaryName: get('Бенефициент'),
    operator:        get('От Потребител'),
    status:          'Потвърдено' as const,
    createdAt:       get('Създаване') || new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
    importedAt:      new Date().toISOString(),
    source:          'import',
  }
}

// ── Firestore import функции ──────────────────────────────────
async function importBeneficiaries(
  rows: ImportRow[],
  headers: string[],
  onProgress: (n: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] }
  const BATCH_SIZE = 450

  // Вземи съществуващите externalIds за да не дублираме
  const existingSnap = await getDocs(
    query(collection(db, 'beneficiaries'), where('source', '==', 'import'))
  )
  const existingIds = new Set(existingSnap.docs.map(d => d.data().externalId))

  let batch = writeBatch(db)
  let batchCount = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapBeneficiary(rows[i], headers)
      if (!mapped.firstName && !mapped.lastName) { result.skipped++; continue }
      if (existingIds.has(mapped.externalId) && mapped.externalId) { result.skipped++; continue }

      const ref = doc(collection(db, 'beneficiaries'))
      batch.set(ref, mapped)
      batchCount++
      result.imported++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }
      if (i % 10 === 0) onProgress(Math.round((i / rows.length) * 100))
    } catch (err) {
      result.errors.push(`Ред ${i + 2}: ${err instanceof Error ? err.message : 'Грешка'}`)
    }
  }

  if (batchCount > 0) await batch.commit()
  onProgress(100)
  return result
}

async function importRequests(
  rows: ImportRow[],
  headers: string[],
  onProgress: (n: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] }
  const BATCH_SIZE = 450

  const existingSnap = await getDocs(
    query(collection(db, 'beneficiaryRequests'), where('source', '==', 'import'))
  )
  const existingIds = new Set(existingSnap.docs.map(d => d.data().externalId))

  let batch = writeBatch(db)
  let batchCount = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapRequest(rows[i], headers)
      if (!mapped.activity) { result.skipped++; continue }
      if (existingIds.has(mapped.externalId) && mapped.externalId) { result.skipped++; continue }

      // Изчисти undefined стойности
      const clean = Object.fromEntries(
        Object.entries(mapped).filter(([, v]) => v !== undefined && v !== '')
      )

      const ref = doc(collection(db, 'beneficiaryRequests'))
      batch.set(ref, clean)
      batchCount++
      result.imported++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }
      if (i % 50 === 0) onProgress(Math.round((i / rows.length) * 100))
    } catch (err) {
      result.errors.push(`Ред ${i + 2}: ${err instanceof Error ? err.message : 'Грешка'}`)
    }
  }

  if (batchCount > 0) await batch.commit()
  onProgress(100)
  return result
}

// ── Компонент ─────────────────────────────────────────────────
export default function ImportPage() {
  const [sheets, setSheets]           = useState<SheetPreview[]>([])
  const [fileName, setFileName]       = useState('')
  const [dragging, setDragging]       = useState(false)
  const [parsing, setParsing]         = useState(false)
  const [importing, setImporting]     = useState(false)
  const [progress, setProgress]       = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [results, setResults]         = useState<{ sheet: string; result: ImportResult }[]>([])
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    setParsing(true)
    setSheets([])
    setResults([])
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

      const parsed: SheetPreview[] = []
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
          header: 1,
          defval: null,
          raw: false,
        })

        if (rawData.length < 2) continue

        const headers = (rawData[0] as (string | null)[]).map(h => String(h ?? ''))
        const rows = rawData.slice(1).map(row => {
          const obj: ImportRow = {}
          headers.forEach((h, i) => { obj[h] = (row as (string | number | null)[])[i] ?? null })
          return obj
        }).filter(row => Object.values(row).some(v => v !== null && v !== ''))

        const type = detectSheetType(headers)
        parsed.push({
          name: sheetName,
          headers,
          rows,
          totalRows: rows.length,
          type,
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

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file)
    } else {
      toast.error('Само .xlsx, .xls или .csv файлове')
    }
  }

  async function handleImport() {
    const toImport = sheets.filter(s => s.type !== 'unknown')
    if (toImport.length === 0) { toast.error('Няма разпознати листове за импорт'); return }

    setImporting(true)
    setResults([])
    const allResults: { sheet: string; result: ImportResult }[] = []

    for (const sheet of toImport) {
      setProgressLabel(`Импортиране: ${sheet.name}...`)
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

  const typeLabel: Record<SheetPreview['type'], { label: string; color: string }> = {
    beneficiaries: { label: 'Бенефициенти',        color: 'label-success' },
    requests:      { label: 'Заявки за дейности',  color: 'label-info' },
    unknown:       { label: 'Непознат',             color: 'label-default' },
  }

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Импорт на данни</span>
      </div>

      <div className="max-w-4xl space-y-5">

        {/* ── UPLOAD ZONE ── */}
        <div className="box">
          <div className="box-header">
            <span className="box-title flex items-center gap-2">
              <FileSpreadsheet size={18} /> Импорт от Excel / CSV
            </span>
          </div>
          <div className="box-body">
            <p className="text-sm text-gray-500 mb-4">
              Поддържа файловете от стария Caritas export. Автоматично разпознава
              листовете <strong>Beneficients</strong> и <strong>Beneficients Data</strong>.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all
                ${dragging ? 'border-[#3c8dbc] bg-blue-50' : 'border-gray-300 hover:border-[#3c8dbc] hover:bg-gray-50'}`}
            >
              <Upload size={40} className={`mx-auto mb-3 ${dragging ? 'text-[#3c8dbc]' : 'text-gray-300'}`} />
              <p className="text-sm font-medium text-gray-600">
                {fileName
                  ? <span className="text-[#3c8dbc]">📊 {fileName}</span>
                  : 'Провлачи файла тук или клик за избор'}
              </p>
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

        {/* ── SHEET PREVIEWS ── */}
        {sheets.length > 0 && (
          <div className="space-y-3">
            {sheets.map(sheet => (
              <div key={sheet.name} className="box">
                <div
                  className="box-header cursor-pointer select-none"
                  onClick={() => setExpandedSheet(expandedSheet === sheet.name ? null : sheet.name)}
                >
                  <div className="flex items-center gap-3">
                    <span className="box-title">{sheet.name}</span>
                    <span className={typeLabel[sheet.type].color + ' text-xs'}>
                      {typeLabel[sheet.type].label}
                    </span>
                    <span className="text-xs text-gray-400">{sheet.totalRows} реда</span>
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
                    {/* Headers */}
                    <div className="px-4 py-3 bg-gray-50 border-b text-xs text-gray-500">
                      <strong>Колони ({sheet.headers.length}):</strong>{' '}
                      {sheet.headers.filter(Boolean).join(' · ')}
                    </div>
                    {/* Preview rows */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            {sheet.headers.slice(0, 8).map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b">
                                {h}
                              </th>
                            ))}
                            {sheet.headers.length > 8 && (
                              <th className="px-3 py-2 text-gray-400">+{sheet.headers.length - 8}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(0, 3).map((row, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              {sheet.headers.slice(0, 8).map(h => (
                                <td key={h} className="px-3 py-2 text-gray-600 max-w-[150px] truncate">
                                  {String(row[h] ?? '')}
                                </td>
                              ))}
                              {sheet.headers.length > 8 && <td />}
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

            {/* Import summary */}
            <div className="box">
              <div className="box-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Готово за импорт:</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {sheets.filter(s => s.type === 'beneficiaries').map(s => (
                        <span key={s.name} className="flex items-center gap-1 text-green-700">
                          <CheckCircle size={14} />
                          {s.name}: <strong>{s.totalRows}</strong> бенефициента
                        </span>
                      ))}
                      {sheets.filter(s => s.type === 'requests').map(s => (
                        <span key={s.name} className="flex items-center gap-1 text-blue-700">
                          <CheckCircle size={14} />
                          {s.name}: <strong>{s.totalRows}</strong> заявки
                        </span>
                      ))}
                      {sheets.filter(s => s.type === 'unknown').map(s => (
                        <span key={s.name} className="flex items-center gap-1 text-gray-400">
                          <XCircle size={14} />
                          {s.name}: пропуснат
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={importing || sheets.filter(s => s.type !== 'unknown').length === 0}
                    className="btn-primary disabled:opacity-50"
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

                {/* Progress bar */}
                {importing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{progressLabel}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#3c8dbc] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {results.length > 0 && (
          <div className="box">
            <div className="box-header">
              <span className="box-title flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" /> Резултати от импорта
              </span>
            </div>
            <div className="box-body space-y-4">
              {results.map(({ sheet, result }) => (
                <div key={sheet} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-semibold text-gray-700 mb-3">{sheet}</p>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                      <p className="text-xs text-gray-500">Общо реда</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                      <p className="text-xs text-gray-500">Импортирани</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded">
                      <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                      <p className="text-xs text-gray-500">Пропуснати (дубликати)</p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                        <XCircle size={13} /> {result.errors.length} грешки:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {result.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">{e}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.errors.length === 0 && result.imported > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle size={16} />
                      Успешен импорт без грешки!
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INFO BOX ── */}
        <div className="box">
          <div className="box-header">
            <span className="box-title">Информация</span>
          </div>
          <div className="box-body text-sm text-gray-600 space-y-2">
            <p>• Поддържани формати: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong></p>
            <p>• Листът <strong>Beneficients</strong> → импортира се в колекция <code>beneficiaries</code></p>
            <p>• Листът <strong>Beneficients Data</strong> → импортира се в колекция <code>beneficiaryRequests</code></p>
            <p>• Дубликатите се пропускат автоматично (по External ID)</p>
            <p>• Импортът може да се пуска многократно — съществуващите записи не се презаписват</p>
            <p>• При голям файл (2000+ реда) може да отнеме 1-2 минути</p>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}
