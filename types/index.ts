// ============================================================
// CARITAS ADMIN — TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'operator' | 'viewer'

export interface AdminUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  isOnline: boolean
  createdAt: string
}

// ---- БЕНЕФИЦИЕНТ ----
export interface Beneficiary {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  birthDate?: string
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

export interface BeneficiaryRequest {
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
  createdAt: string
  updatedAt: string
}

// ---- ЗАДАЧА ----
export type TaskStatus = 'Нова' | 'В процес' | 'Завършена' | 'Отменена'
export type TaskPriority = 'Ниска' | 'Средна' | 'Висока'

export interface Task {
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
export interface Employer {
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
