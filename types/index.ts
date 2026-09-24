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
  lastSeen?: string
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
  photoUrl?: string
  lastEdited?: string
  sourceData?: Record<string, string | number | boolean | null>
  notes?: string
  documentProfile?: BeneficiaryDocumentProfile
  createdAt: string
  updatedAt: string
}

export interface FamilyMember {
  name?: string
  gender?: string
  birthDateOrId?: string
  relation?: string
}

export interface CvExperience {
  position?: string
  company?: string
  startDate?: string
  endDate?: string
  description?: string
}

export interface CvEducationEntry {
  institution?: string
  startDate?: string
  endDate?: string
  qualification?: string
}

export interface CvReference {
  name?: string
  organization?: string
  phone?: string
  email?: string
}

export interface BeneficiaryDocumentProfile {
  registrationDate?: string
  interviewer?: string
  registrationPlace?: string
  householdSummary?: string
  familyMembers?: FamilyMember[]
  requestedSupport?: string
  socialStatuses?: string
  residenceStatus?: string
  socialServices?: string
  socialActivities?: string

  careerLivingSituation?: string
  careerDependants?: string
  careerPhysicalLimitations?: string
  careerDrivingLicence?: string
  careerTravelReadiness?: string
  careerCityOrientation?: string
  careerLabourLawKnowledge?: string
  careerEmployerMeeting?: string
  careerComputerSkills?: string
  careerBulgarianLevel?: string
  careerWantsBulgarian?: string
  careerOtherLanguages?: string
  careerHobbies?: string
  careerEducation?: string
  careerQualificationNeeds?: string
  careerDesiredWork?: string
  careerDesiredSalary?: string
  careerJobPriorities?: string
  careerAvailability?: string
  careerDecisionTime?: string
  careerExperienceAbroad?: string
  careerExperienceBulgaria?: string
  careerAdditionalInfo?: string

  humanitarianFamilySituation?: string
  humanitarianSocialGroup?: string
  humanitarianHealthStatus?: string
  humanitarianIncomeSources?: string
  humanitarianDiseaseDescription?: string
  humanitarianLivingConditions?: string
  humanitarianCaseInfo?: string

  caseWorker?: string
  planDate?: string
  translationLanguage?: string
  translator?: string
  bulgarianLevel?: string
  otherLanguages?: string
  careerOrientation?: string
  skillsAndInterests?: string
  computerSkills?: string
  healthStatus?: string
  environmentOrientation?: string
  socialContacts?: string
  emotionalHealth?: string
  longTermGoal?: string
  strengths?: string
  skills?: string
  barriers?: string
  previousExperience?: string
  serviceProvider?: string
  planDeadline?: string

  cvProfessionalTitle?: string
  cvName?: string
  cvPhone?: string
  cvEmail?: string
  cvAddress?: string
  cvSummary?: string
  cvDesiredPosition?: string
  cvSkills?: string
  cvLanguages?: string
  cvEducation?: string
  cvWorkExperience?: string
  cvCourses?: string
  cvAdditionalInfo?: string
  cvExperiences?: CvExperience[]
  cvEducationEntries?: CvEducationEntry[]
  cvReferences?: CvReference[]
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

// ---- ГРАФИК ----
export interface ScheduleEntry extends OwnedRecord {
  id: string
  date: string
  time: string
  description: string
  phone?: string
  performers?: string
  sourceRow?: number
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
  positions?: JobPosition[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface JobPosition {
  id: string
  title: string
  description?: string
  skills?: string
  isActive: boolean
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
