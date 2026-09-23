import type { Beneficiary, BeneficiaryRequest, CaseEntry } from '@/types'

export type RawCell = string | number | boolean | null
export type RawRow = RawCell[]
export type ImportSheetType = 'combined' | 'beneficiaries' | 'requests' | 'unknown'

const normalize = (value: string) => value.trim().toLocaleLowerCase('bg-BG').replace(/\s+/g, ' ')

export function headerIndex(headers: string[], ...names: string[]) {
  const normalized = headers.map(normalize)
  for (const name of names) {
    const index = normalized.indexOf(normalize(name))
    if (index >= 0) return index
  }
  return -1
}

export function text(row: RawRow, headers: string[], ...names: string[]) {
  for (const name of names) {
    const index = headerIndex(headers, name)
    if (index < 0) continue
    const value = row[index]
    const result = value === null || value === undefined ? '' : String(value).trim()
    if (result) return result
  }
  return ''
}

export function numberValue(row: RawRow, headers: string[], ...names: string[]) {
  const value = text(row, headers, ...names)
  if (!value) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function sourceData(row: RawRow, headers: string[]) {
  return Object.fromEntries(headers.flatMap((header, index) => {
    const key = header.trim()
    const value = row[index]
    return key ? [[key, value === '' || value === undefined ? null : value]] : []
  })) as Record<string, RawCell>
}

export function detectSheetType(headers: string[]): ImportSheetType {
  const keys = new Set(headers.map(normalize))
  const has = (name: string) => keys.has(normalize(name))
  const hasRequest = has('Заявка ID') || has('Случай 1') || has('От Потребител')
  const hasBeneficiary = has('ID на бенефициента') || has('First Name') || has('EGN')
  if (hasRequest && hasBeneficiary) return 'combined'
  if (has('Phone number') || has('GDPR') || has('Requested help')) return 'beneficiaries'
  if (hasRequest) return 'requests'
  return 'unknown'
}

export function parseCase(value: RawCell): CaseEntry | undefined {
  const raw = value === null || value === undefined ? '' : String(value).trim()
  if (!raw || raw.toLocaleLowerCase('bg-BG') === 'none') return undefined

  const match = raw.match(/^\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})\s*(?:-|–)?\s*([^\n-]*?)\s*(?:-|–)\s*([\s\S]+)$/)
  if (match) return { date: match[1].trim(), operator: match[2].trim(), description: match[3].trim() }

  const firstSeparator = raw.indexOf(' - ')
  if (firstSeparator < 0) return { date: '', operator: '', description: raw }
  const date = raw.slice(0, firstSeparator).trim()
  const remainder = raw.slice(firstSeparator + 3)
  const secondSeparator = remainder.indexOf(' - ')
  if (secondSeparator < 0) return { date, operator: '', description: remainder.trim() }
  return {
    date,
    operator: remainder.slice(0, secondSeparator).trim(),
    description: remainder.slice(secondSeparator + 3).trim(),
  }
}

function clean<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== '')) as T
}

export function mapBeneficiaryRow(row: RawRow, headers: string[], importedAt: string) {
  const externalId = numberValue(row, headers, 'ID на бенефициента', 'ID')
  const beneficiary = clean({
    externalId,
    firstName: text(row, headers, 'First Name', 'Име'),
    lastName: text(row, headers, 'Last Name', 'Фамилия'),
    middleName: text(row, headers, 'Midle Name', 'Middle Name', 'Бащино име'),
    gender: text(row, headers, 'Gender', 'Пол'),
    birthDate: text(row, headers, 'Date of birth', 'Дата на раждане'),
    country: text(row, headers, 'Country of birth', 'Държава на раждане'),
    egn: text(row, headers, 'EGN', 'ЕГН'),
    gdpr: text(row, headers, 'GDPR'),
    phone: text(row, headers, 'Phone number', 'Телефон'),
    status: text(row, headers, 'Status', 'Статус'),
    mentor: text(row, headers, 'Mentor', 'Ментор'),
    address: text(row, headers, 'Address', 'Адрес'),
    currentAddress: text(row, headers, 'Current Address', 'Настоящ адрес'),
    email: text(row, headers, 'Email', 'Имейл'),
    requestedHelp: text(row, headers, 'Requested help'),
    education: text(row, headers, 'Education'),
    hasDocument: text(row, headers, 'Has Document'),
    experience: text(row, headers, 'Experience'),
    initialIncome: text(row, headers, 'Initial Income'),
    currentIncome: text(row, headers, 'Current Income'),
    caseDescription: text(row, headers, 'Case Description'),
    workExperience: text(row, headers, 'Work Experiance', 'Work Experience'),
    familyStatus: text(row, headers, 'Family status'),
    numberOfKids: text(row, headers, 'Number of Kids'),
    vulnerability: text(row, headers, 'Vulnerability'),
    lastEdited: text(row, headers, 'Last Edited'),
    sourceData: sourceData(row, headers),
    createdAt: text(row, headers, 'Created') || importedAt,
    importedAt,
    source: 'excel-import',
    updatedAt: importedAt,
  }) as Partial<Beneficiary> & Record<string, unknown>

  const documentId = externalId ? String(externalId) : ''
  return { documentId, beneficiary }
}

export function mapRequestRow(row: RawRow, headers: string[], importedAt: string) {
  const externalId = numberValue(row, headers, 'Заявка ID', 'ID')
  const beneficiaryId = numberValue(row, headers, 'ID на бенефициента')
  const cases = Array.from({ length: 6 }, (_, index) => parseCase(row[headerIndex(headers, `Случай ${index + 1}`)]))
  const createdAt = text(row, headers, 'Създаване', 'Created') || importedAt

  const request: Record<string, unknown> = clean({
    externalId,
    beneficiaryId: beneficiaryId ? String(beneficiaryId) : '',
    beneficiaryName: text(row, headers, 'Бенефициент') || `${text(row, headers, 'First Name')} ${text(row, headers, 'Last Name')}`.trim(),
    firstName: text(row, headers, 'First Name'),
    lastName: text(row, headers, 'Last Name'),
    middleName: text(row, headers, 'Midle Name', 'Middle Name'),
    gender: text(row, headers, 'Gender'),
    birthDate: text(row, headers, 'Date of birth'),
    country: text(row, headers, 'Country of birth'),
    egn: text(row, headers, 'EGN'),
    beneficiaryStatus: text(row, headers, 'Status'),
    activity: text(row, headers, 'Заглавие'),
    requestType: text(row, headers, 'Тип'),
    message: text(row, headers, 'Описание'),
    tags: text(row, headers, 'Тагове'),
    comment: text(row, headers, 'Коментар'),
    operator: text(row, headers, 'От Потребител'),
    vulnerability: text(row, headers, 'Vulnerability'),
    taskId: numberValue(row, headers, 'Задача ID'),
    taskFor: text(row, headers, 'Задача за'),
    status: 'Потвърдено',
    createdAt,
    updatedAt: importedAt,
    importedAt,
    source: 'excel-import',
    sourceData: sourceData(row, headers),
  })

  cases.forEach((entry, index) => { if (entry) request[`case${index + 1}`] = entry })
  const documentId = externalId ? String(externalId) : ''
  return { documentId, request: request as Partial<BeneficiaryRequest> & Record<string, unknown> }
}
