import type { Employer } from '../types'

export const EMPLOYER_COLUMNS = [
  { key: 'id', label: 'ID', aliases: ['employerid', 'работодателid'] },
  { key: 'name', label: 'Наименование', aliases: ['name', 'име', 'фирма', 'работодател', 'company', 'companyname'] },
  { key: 'eik', label: 'ЕИК', aliases: ['eik', 'булстат', 'bulstat', 'vat'] },
  { key: 'city', label: 'Град', aliases: ['city', 'населеномясто'] },
  { key: 'address', label: 'Адрес', aliases: ['address'] },
  { key: 'contactPerson', label: 'Лице за контакт', aliases: ['contactperson', 'контакт', 'контактнолице'] },
  { key: 'phone', label: 'Телефон', aliases: ['phone', 'тел', 'телефоненномер', 'mobile'] },
  { key: 'email', label: 'Имейл', aliases: ['email', 'елпоща', 'електроннапоща'] },
  { key: 'industry', label: 'Бранш', aliases: ['industry', 'дейност', 'сектор'] },
  { key: 'notes', label: 'Бележки', aliases: ['notes', 'бележка', 'коментар'] },
] as const

type EmployerField = typeof EMPLOYER_COLUMNS[number]['key']
export type EmployerImportValues = Partial<Record<EmployerField, string>> & { name: string }
export interface EmployerImportRow { rowNumber: number; values: EmployerImportValues }
export interface EmployerImportItem extends EmployerImportRow {
  operation: 'create' | 'update' | 'skip' | 'error'
  existingId?: string
  message: string
}

const clean = (value: unknown) => String(value ?? '').trim()
const normalize = (value: unknown) => clean(value).toLocaleLowerCase('bg').replace(/[\s._\-:()]+/g, '')
const normalizeEik = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase()
const identity = (value: { name?: string; city?: string }) => `${normalize(value.name)}:${normalize(value.city)}`

/** Keeps identifiers and phone numbers as text, including their leading zeroes. */
export function employerExportRows(employers: Employer[]): string[][] {
  return [
    EMPLOYER_COLUMNS.map(column => column.label),
    ...employers.map(employer => EMPLOYER_COLUMNS.map(column => String(employer[column.key] ?? ''))),
  ]
}

export function parseEmployerRows(matrix: unknown[][]): EmployerImportRow[] {
  const aliases = new Map<string, EmployerField>()
  for (const column of EMPLOYER_COLUMNS) {
    for (const alias of [column.key, column.label, ...column.aliases]) aliases.set(normalize(alias), column.key)
  }
  const headerIndex = matrix.slice(0, 20).findIndex(row => row.some(cell => aliases.get(normalize(cell)) === 'name'))
  if (headerIndex < 0) throw new Error('Липсва колона „Наименование“. Използвайте шаблона или колони на български / английски.')
  const fields = matrix[headerIndex].map(cell => aliases.get(normalize(cell)))
  const mapped = fields.filter((field): field is EmployerField => Boolean(field))
  if (new Set(mapped).size !== mapped.length) throw new Error('Има повторени колони за едно и също поле. Оставете само по една колона за всяко поле.')
  const rows: EmployerImportRow[] = []
  for (let index = headerIndex + 1; index < matrix.length; index++) {
    const source = matrix[index]
    if (!source.some(cell => clean(cell))) continue
    const values: EmployerImportValues = { name: '' }
    fields.forEach((field, column) => {
      if (field) values[field] = clean(source[column])
    })
    rows.push({ rowNumber: index + 1, values })
  }
  if (!rows.length) throw new Error('Файлът не съдържа работодатели.')
  if (rows.length > 5000) throw new Error('Допускат се до 5000 работодатели в един импорт. Разделете файла на части.')
  return rows
}

/** Builds a read-only preview; no existing data is deleted or cleared. */
export function planEmployerImport(rows: EmployerImportRow[], existing: Employer[], updateExisting: boolean): EmployerImportItem[] {
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const seenNames = new Map<string, Set<string>>()
  return rows.map(row => {
    const values = row.values
    const item: EmployerImportItem = { ...row, operation: 'create', message: 'Нов работодател' }
    if (!values.name.trim()) return { ...item, operation: 'error', message: 'Липсва наименование' }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return { ...item, operation: 'error', message: 'Невалиден имейл' }
    if (EMPLOYER_COLUMNS.some(column => (values[column.key]?.length || 0) > 10000)) return { ...item, operation: 'error', message: 'Прекалено дълга стойност (максимум 10000 знака)' }

    const byId = values.id ? existing.find(employer => employer.id === values.id) : undefined
    const byEik = values.eik ? existing.filter(employer => normalizeEik(employer.eik) === normalizeEik(values.eik)) : []
    if (byEik.length > 1 || (byId && byEik.length && byEik[0].id !== byId.id)) {
      return { ...item, operation: 'error', message: 'ID и ЕИК сочат различни или повече от един съществуващи записи' }
    }
    const byName = !byId && !byEik.length
      ? existing.filter(employer => identity(employer) === identity(values) && (!values.eik || !employer.eik))
      : []
    if (byName.length > 1) return { ...item, operation: 'error', message: 'Няколко работодатели имат същото име и град. Попълнете ID или ЕИК.' }
    const match = byId || byEik[0] || byName[0]
    const key = values.eik ? `eik:${normalizeEik(values.eik)}` : `name:${identity(values)}`
    const nameKey = identity(values)
    const eikKey = normalizeEik(values.eik)
    const earlierEiks = seenNames.get(nameKey)
    if (seenKeys.has(key) || (match && seenIds.has(match.id)) || (earlierEiks && (!eikKey || earlierEiks.has('')))) {
      return { ...item, operation: 'error', message: 'Повторен работодател във файла. Оставете само един ред.' }
    }
    seenKeys.add(key)
    const eiks = earlierEiks || new Set<string>()
    eiks.add(eikKey)
    seenNames.set(nameKey, eiks)
    if (!match) return item
    seenIds.add(match.id)
    return {
      ...item,
      existingId: match.id,
      operation: updateExisting ? 'update' : 'skip',
      message: updateExisting ? 'Обновяване само на попълнените полета' : 'Вече съществува — ще се пропусне',
    }
  })
}

/** Whitelist business fields, never accept ownership, roles or timestamps from a file. */
export function employerImportPatch(values: EmployerImportValues) {
  const patch: Partial<Record<Exclude<EmployerField, 'id'>, string>> & { name: string } = { name: values.name.trim() }
  for (const column of EMPLOYER_COLUMNS) {
    const value = values[column.key]
    if (column.key !== 'id' && value?.trim()) patch[column.key] = value.trim()
  }
  return patch
}
