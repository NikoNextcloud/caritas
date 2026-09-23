// ============================================================
// CARITAS ADMIN — TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'user' | 'operator' | 'viewer'

export interface OwnedRecord {
  createdByUid?: string
  createdByName?: string
  assignedToUid?: string
  assignedToName?: string
}

export interface AdminUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  isOnline: boolean
  createdAt: string
}

// ---- БЕНЕФИЦИЕНТ ----
export interface Beneficiary extends OwnedRecord {
  id: string
  externalId?: number | string
  firstName: string
  lastName: string
  middleName?: string
  gender?: string
  email?: string
  phone?: string
  address?: string
  currentAddress?: string
  city?: string
  country?: string
  birthDate?: string
  egn?: string
  gdpr?: string
  status?: string
  mentor?: string
  requestedHelp?: string
  education?: string
  hasDocument?: string
  experience?: string
  initialIncome?: string
  currentIncome?: string
  caseDescription?: string
  workExperience?: string
  familyStatus?: string
  numberOfKids?: string
  vulnerability?: string
  lastEdited?: string
  sourceData?: Record<string, string | number | boolean | null>
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---- ЗАЯВКА ЗА ДЕЙНОСТ ----
export type RequestStatus = 'Потвърдено' | 'Отхвърлено' | 'Чакащ' | 'Приключен'

export interface CaseEntry {
  date: string       // "18.09.2026"
  operator: string   // "Таня"
  description: string
}

export interface BeneficiaryRequest extends OwnedRecord {
  id: string
  activity: string          // Дейност — "ХКЦ Пловдив - Управление на случай..."
  message: string           // Съобщение (локация)
  case1?: CaseEntry
  case2?: CaseEntry
  case3?: CaseEntry
  case4?: CaseEntry
  case5?: CaseEntry
  case6?: CaseEntry
  status: RequestStatus
  beneficiaryId: string
  beneficiaryName: string   // denormalized за бързо листване
  externalId?: number | string
  firstName?: string
  lastName?: string
  middleName?: string
  gender?: string
  birthDate?: string
  country?: string
  egn?: string
  beneficiaryStatus?: string
  requestType?: string
  tags?: string
  comment?: string
  operator?: string
  vulnerability?: string
  taskId?: number | string
  taskFor?: string
  sourceData?: Record<string, string | number | boolean | null>
  createdAt: string
  updatedAt: string
}

// ---- ЗАДАЧА ----
export type TaskStatus = 'Нова' | 'В процес' | 'Завършена' | 'Отменена'
export type TaskPriority = 'Ниска' | 'Средна' | 'Висока'

export interface Task extends OwnedRecord {
  id: string
  title: string
  description?: string
  assignedTo?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  createdAt: string
  updatedAt: string
}

// ---- РАБОТОДАТЕЛ ----
export interface Employer extends OwnedRecord {
  id: string
  name: string
  eik?: string              // ЕИК
  city?: string
  address?: string
  contactPerson?: string
  phone?: string
  email?: string
  industry?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---- ДОБРОВОЛЕЦ ----
export type VolunteerStatus = 'Активен' | 'Неактивен' | 'Пауза'

export interface Volunteer extends OwnedRecord {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  city?: string
  address?: string
  skills?: string
  availability?: string
  startDate?: string
  status: VolunteerStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---- ДАРИТЕЛ ----
export type DonorEntityType = 'Физическо лице' | 'Юридическо лице'
export type DonationFrequency = 'Еднократно' | 'Месечно' | 'Тримесечно' | 'Годишно' | 'Друго'

export interface DonationEntry {
  id: string
  date: string
  amount?: number
  basis: string
  notes?: string
}

export interface Donor extends OwnedRecord {
  id: string
  entityType: DonorEntityType
  firstName?: string
  lastName?: string
  organizationName?: string
  eik?: string
  egn?: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  basis: string
  frequency: DonationFrequency
  donations: DonationEntry[]
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---- НОТИФИКАЦИЯ ----
export type NotificationType = 'order' | 'user' | 'review' | 'contact' | 'status_change'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: string
  relatedId?: string
  relatedType?: string
}

// ---- EXPORT ----
export interface ExportRecord {
  id: string
  beneficiaryName: string
  beneficiaryId: string
  activity: string
  status: RequestStatus
  date: string
  operator: string
  amount?: number
}

// ---- PAGINATION ----
export interface PaginationState {
  page: number
  perPage: number
  total: number
}

// ---- SEARCH PARAMS ----
export interface SearchParams {
  id?: string
  status?: RequestStatus | ''
  beneficiary?: string
  activity?: string
  dateFrom?: string
  dateTo?: string
}
