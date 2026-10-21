'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { currentAccess, importEmployers } from '@/lib/db'
import { employerExportRows, parseEmployerRows, planEmployerImport, type EmployerImportRow } from '@/lib/employer-transfer'
import type { Employer } from '@/types'

export default function EmployerTransfer({ employers, exportEmployers, loading, onChanged }: {
  employers: Employer[]
  exportEmployers: Employer[]
  loading: boolean
  onChanged: () => Promise<void>
}) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<EmployerImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const plan = useMemo(() => planEmployerImport(rows, employers, updateExisting), [rows, employers, updateExisting])
  const counts = useMemo(() => ({
    create: plan.filter(item => item.operation === 'create').length,
    update: plan.filter(item => item.operation === 'update').length,
    skip: plan.filter(item => item.operation === 'skip').length,
    error: plan.filter(item => item.operation === 'error').length,
  }), [plan])

  useEffect(() => {
    let active = true
    void currentAccess().then(access => { if (active) setIsAdmin(access.isAdmin) }).catch(() => {})
    return () => { active = false }
  }, [])

  async function exportFile(template = false) {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const sheet = XLSX.utils.aoa_to_sheet(employerExportRows(template ? [] : exportEmployers))
      sheet['!cols'] = [36, 32, 16, 20, 35, 26, 22, 32, 24, 50].map(wch => ({ wch }))
      sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1:J1' }
      XLSX.utils.book_append_sheet(workbook, sheet, 'Работодатели')
      XLSX.writeFile(workbook, template ? 'rabotodateli-shablon.xlsx' : `rabotodateli-${new Date().toISOString().slice(0, 10)}.xlsx`)
      if (!template) toast.success(`Експортирани са ${exportEmployers.length} работодатели`)
    } catch {
      toast.error('Файлът не може да бъде създаден')
    } finally { setExporting(false) }
  }

  async function readFile(file: File) {
    setReading(true)
    setRows([])
    setFileName(file.name)
    setResult('')
    setError('')
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Изберете Excel (.xlsx, .xls) или CSV файл')
      if (file.size > 10 * 1024 * 1024) throw new Error('Максималният размер на файла е 10 MB')
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, codepage: 65001, cellDates: false })
      const sheetName = workbook.SheetNames.find(name => name.toLocaleLowerCase('bg') === 'работодатели') || workbook.SheetNames[0]
      if (!sheetName) throw new Error('Файлът не съдържа таблица')
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
      setRows(parseEmployerRows(matrix))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Файлът не може да бъде прочетен')
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function importFile() {
    if (importing || counts.error || !rows.length || !(counts.create + counts.update)) return
    setImporting(true)
    setError('')
    setProgress('Записване...')
    try {
      const saved = await importEmployers(rows, updateExisting, (completed, total) => setProgress(`Записани ${completed} от ${total}`))
      const message = `${saved.created} нови, ${saved.updated} обновени, ${saved.skipped} пропуснати работодатели.`
      setResult(message)
      setRows([])
      await onChanged()
      toast.success(message)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Грешка при импорт')
      await onChanged()
    } finally {
      setImporting(false)
      setProgress('')
    }
  }

  return <>
    {isAdmin && <button type="button" className="btn-default" disabled={loading} onClick={() => { setOpen(true); setRows([]); setFileName(''); setError(''); setResult(''); setUpdateExisting(false) }}><Upload size={16} /> Импорт</button>}
    <button type="button" className="btn-default" disabled={loading || exporting || !exportEmployers.length} onClick={() => void exportFile()} title="Експорт на всички намерени работодатели, не само на текущата страница"><Download size={16} /> {exporting ? 'Експорт...' : 'Експорт Excel'}</button>
    <Modal open={open} onClose={() => { if (!importing && !reading) setOpen(false) }} title="Импорт на работодатели" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Excel или CSV с колони: Наименование, ЕИК, Град, Адрес, Лице за контакт, Телефон, Имейл, Бранш и Бележки. Задължително е само наименованието. За редакция на съществуващи записи може да използвате експортирания файл с ID.</p>
        <p className="text-xs text-gray-500">Телефоните и ЕИК трябва да са текст в Excel, за да се запазят началните нули. Позициите за работа и разпределението към потребители не се променят.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-default" disabled={importing || reading || exporting} onClick={() => void exportFile(true)}><FileSpreadsheet size={16} /> Свали шаблон</button>
          <button type="button" className="btn-primary" disabled={importing || reading} onClick={() => fileRef.current?.click()}><Upload size={16} /> {reading ? 'Прочитане...' : 'Избери файл'}</button>
          <span className="text-sm text-gray-600 break-all">{fileName}</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Файл с работодатели" onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file) }} />
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={updateExisting} disabled={importing || reading} onChange={event => setUpdateExisting(event.target.checked)} className="mt-1" /><span>Обнови съществуващите работодатели по ID, ЕИК или същото име и град. Празните клетки не изтриват налични данни. Без тази отметка съществуващите работодатели се пропускат.</span></label>
        {result && <p role="status" className="p-3 rounded bg-green-50 text-green-800 border border-green-200">{result}</p>}
        {error && <p role="alert" className="p-3 rounded bg-red-50 text-red-800 border border-red-200">{error}</p>}
        {plan.length > 0 && <>
          <p className="text-sm text-gray-700">Общо: {plan.length} · Нови: {counts.create} · За обновяване: {counts.update} · Пропуснати: {counts.skip} · Грешки: {counts.error}</p>
          {counts.error > 0 && <p className="text-sm text-red-700">Поправете грешките във файла и го изберете отново. Нищо няма да се запише, докато има грешки.</p>}
          <div className="overflow-auto max-h-72 rounded border border-gray-200">
            <table className="w-full text-sm"><thead className="bg-gray-100 text-left"><tr>{['Ред', 'Наименование', 'ЕИК', 'Телефон', 'Резултат'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>
              {plan.slice(0, 100).map(item => <tr key={item.rowNumber} className={`border-t border-gray-200 ${item.operation === 'error' ? 'bg-red-50 text-red-800' : 'text-gray-700'}`}><td className="p-2">{item.rowNumber}</td><td className="p-2">{item.values.name || '—'}</td><td className="p-2">{item.values.eik || '—'}</td><td className="p-2">{item.values.phone || '—'}</td><td className="p-2">{item.message}</td></tr>)}
            </tbody></table>
          </div>
          {plan.length > 100 && <p className="text-xs text-gray-500">Преглед на първите 100 реда. Всички {plan.length} реда са проверени и ще бъдат обработени.</p>}
          {counts.error > 0 && <ul className="text-sm text-red-700 list-disc pl-5">{plan.filter(item => item.operation === 'error').slice(0, 20).map(item => <li key={item.rowNumber}>Ред {item.rowNumber}: {item.message}</li>)}</ul>}
        </>}
        <div className="flex flex-wrap justify-end items-center gap-3 border-t pt-4">
          <span role="status" aria-live="polite" className="text-sm text-gray-600">{progress}</span>
          <button type="button" className="btn-default" disabled={importing || reading} onClick={() => setOpen(false)}>Затвори</button>
          <button type="button" className="btn-primary disabled:opacity-50" disabled={importing || reading || counts.error > 0 || !(counts.create + counts.update)} onClick={() => void importFile()}>{importing ? 'Импортиране...' : `Импортирай (${counts.create + counts.update})`}</button>
        </div>
      </div>
    </Modal>
  </>
}
