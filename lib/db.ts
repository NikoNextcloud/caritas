import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, writeBatch, startAfter, startAt, endAt,
  getCountFromServer,
  type DocumentSnapshot, type DocumentData, type QueryConstraint, type QuerySnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import { auth } from './firebase'
import type {
  BeneficiaryRequest, Beneficiary, Task, Employer,
  Notification, SearchParams, RequestStatus, Donor, Volunteer, AdminUser
} from '@/types'

const now = () => new Date().toISOString()
const COLLECTION_CACHE_MS = 60_000

type Access = Awaited<ReturnType<typeof loadCurrentAccess>>
type CachedCollection = { expiresAt: number; data: unknown[] }

let accessCache: { uid: string; value: Access } | null = null
const collectionCache = new Map<string, CachedCollection>()
const collectionCountCache = new Map<string, { expiresAt: number; count: number }>()

function toData<T>(snap: { exists: () => boolean; id: string; data: () => Record<string, unknown> | undefined }): T | null {
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

async function loadCurrentAccess() {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Необходим е вход в системата')
  const profile = await getDoc(doc(db, 'users', user.uid))
  const data = profile.exists() ? profile.data() as Partial<AdminUser> : {}
  return {
    uid: user.uid,
    name: data.displayName || user.displayName || user.email || 'Потребител',
    role: data.role || 'user',
    isAdmin: data.role === 'admin',
  }
}

async function currentAccess() {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Необходим е вход в системата')
  if (accessCache?.uid === uid) return accessCache.value
  const value = await loadCurrentAccess()
  accessCache = { uid, value }
  return value
}

function clearCollectionCache(collectionName: string) {
  for (const key of Array.from(collectionCache.keys())) {
    if (key.endsWith(`:${collectionName}`)) collectionCache.delete(key)
  }
  collectionCountCache.delete(collectionName)
}

const sharedReadCollections = new Set([
  'beneficiaries',
  'employers',
  'volunteers',
  'donors',
])

async function visibleCollection<T>(collectionName: string): Promise<T[]> {
  const access = await currentAccess()
  const cacheKey = `${access.uid}:${collectionName}`
  const cached = collectionCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data as T[]

  const ref = collection(db, collectionName)
  if (access.isAdmin || sharedReadCollections.has(collectionName)) {
    const snap = await getDocs(ref)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as T))
    collectionCache.set(cacheKey, { data, expiresAt: Date.now() + COLLECTION_CACHE_MS })
    return data
  }

  const [created, assigned] = await Promise.all([
    getDocs(query(ref, where('createdByUid', '==', access.uid))),
    getDocs(query(ref, where('assignedToUid', '==', access.uid))),
  ])
  const unique = new Map<string, T>()
  for (const d of [...created.docs, ...assigned.docs]) {
    unique.set(d.id, { id: d.id, ...d.data() } as T)
  }
  const data = Array.from(unique.values())
  collectionCache.set(cacheKey, { data, expiresAt: Date.now() + COLLECTION_CACHE_MS })
  return data
}

export interface CursorPage<T> {
  data: T[]
  total: number
  nextCursor: DocumentSnapshot<DocumentData> | null
  hasNext: boolean
}

async function publicCursorPage<T>(
  collectionName: string,
  pageSize: number,
  cursor: DocumentSnapshot<DocumentData> | null,
  sortField: string,
  direction: 'asc' | 'desc' = 'asc',
): Promise<CursorPage<T>> {
  await currentAccess()
  const ref = collection(db, collectionName)
  const constraints: QueryConstraint[] = [orderBy(sortField, direction)]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize + 1))

  const cachedCount = collectionCountCache.get(collectionName)
  const [snap, total] = await Promise.all([
    getDocs(query(ref, ...constraints)),
    cachedCount && cachedCount.expiresAt > Date.now()
      ? Promise.resolve(cachedCount.count)
      : getCountFromServer(ref).then(result => {
          const count = result.data().count
          collectionCountCache.set(collectionName, { count, expiresAt: Date.now() + COLLECTION_CACHE_MS })
          return count
        }),
  ])
  const pageDocs = snap.docs.slice(0, pageSize)
  return {
    data: pageDocs.map(item => ({ id: item.id, ...item.data() } as T)),
    total,
    nextCursor: pageDocs.at(-1) || null,
    hasNext: snap.docs.length > pageSize,
  }
}

async function ownership() {
  const access = await currentAccess()
  return { createdByUid: access.uid, createdByName: access.name }
}

// ── BENEFICIARY REQUESTS ──────────────────────────────────────
export const requestsCol = collection(db, 'beneficiaryRequests')

export async function getRequests(params: {
  page?: number; perPage?: number; search?: SearchParams
} = {}) {
  const { page = 1, perPage = 20, search } = params

  // Без orderBy за да избегнем нужда от composite index
  let all = await visibleCollection<BeneficiaryRequest>('beneficiaryRequests')

  // Всички останали филтри client-side
  if (search?.id)          all = all.filter(r => r.id.includes(search.id!))
  if (search?.beneficiary) all = all.filter(r => r.beneficiaryName?.toLowerCase().includes(search.beneficiary!.toLowerCase()))
  if (search?.activity)    all = all.filter(r => r.activity?.toLowerCase().includes(search.activity!.toLowerCase()))
  if (search?.dateFrom)    all = all.filter(r => r.createdAt >= search.dateFrom!)
  if (search?.dateTo)      all = all.filter(r => r.createdAt <= search.dateTo!)

  // Сортираме client-side по createdAt desc
  all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  const start = (page - 1) * perPage
  return { data: all.slice(start, start + perPage), total: all.length, page, perPage }
}

export async function getRequestsPage(
  pageSize = 25,
  cursor: DocumentSnapshot<DocumentData> | null = null,
): Promise<CursorPage<BeneficiaryRequest>> {
  const access = await currentAccess()
  if (!access.isAdmin) {
    const visible = await visibleCollection<BeneficiaryRequest>('beneficiaryRequests')
    visible.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return {
      data: visible,
      total: visible.length,
      nextCursor: null,
      hasNext: false,
    }
  }
  return publicCursorPage<BeneficiaryRequest>('beneficiaryRequests', pageSize, cursor, 'createdAt', 'desc')
}

export async function getRequest(id: string) {
  const snap = await getDoc(doc(requestsCol, id))
  return toData<BeneficiaryRequest>(snap)
}

export async function addRequest(data: Omit<BeneficiaryRequest, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(requestsCol, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() })
  clearCollectionCache('beneficiaryRequests')
  return ref.id
}

export async function updateRequest(id: string, data: Partial<BeneficiaryRequest>) {
  await updateDoc(doc(requestsCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('beneficiaryRequests')
}

export async function deleteRequests(ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach(id => batch.delete(doc(requestsCol, id)))
  await batch.commit()
  clearCollectionCache('beneficiaryRequests')
}

export async function updateRequestStatus(id: string, status: RequestStatus) {
  await updateDoc(doc(requestsCol, id), { status, updatedAt: now() })
  clearCollectionCache('beneficiaryRequests')
  await addNotification({
    type: 'status_change',
    title: 'Промяна на статус на заявка',
    message: `Заявка #${id} е променена на: ${status}`,
    isRead: false,
    relatedId: id,
    relatedType: 'beneficiaryRequest'
  })
}

// ── BENEFICIARIES ─────────────────────────────────────────────
export const beneficiariesCol = collection(db, 'beneficiaries')

export async function getBeneficiaries(search?: string) {
  let data = await visibleCollection<Beneficiary>('beneficiaries')
  data.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'bg'))
  if (search) {
    const s = search.toLowerCase()
    data = data.filter(b =>
      b.firstName?.toLowerCase().includes(s) ||
      b.lastName?.toLowerCase().includes(s) ||
      b.email?.toLowerCase().includes(s) ||
      b.phone?.includes(s)
    )
  }
  return data
}

export async function searchBeneficiaries(term: string, resultLimit = 100) {
  await currentAccess()
  const value = term.trim()
  if (!value) return []

  const results = new Map<string, Beneficiary>()
  const variants = Array.from(new Set([
    value,
    value.charAt(0).toLocaleUpperCase('bg-BG') + value.slice(1).toLocaleLowerCase('bg-BG'),
  ]))
  const searches: Array<Promise<QuerySnapshot<DocumentData>>> = []
  for (const field of ['firstName', 'lastName', 'middleName', 'email']) {
    for (const variant of variants) {
      searches.push(getDocs(query(
        beneficiariesCol,
        orderBy(field),
        startAt(variant),
        endAt(`${variant}\uf8ff`),
        limit(Math.min(resultLimit, 50)),
      )))
    }
  }
  searches.push(getDocs(query(beneficiariesCol, where('egn', '==', value), limit(resultLimit))))
  searches.push(getDocs(query(beneficiariesCol, where('phone', '==', value), limit(resultLimit))))

  if (/^\d+$/.test(value)) {
    const exact = await getDoc(doc(beneficiariesCol, value))
    if (exact.exists()) results.set(exact.id, { id: exact.id, ...exact.data() } as Beneficiary)
  }

  const snapshots = await Promise.all(searches)
  for (const snap of snapshots) {
    for (const item of snap.docs) {
      results.set(item.id, { id: item.id, ...item.data() } as Beneficiary)
      if (results.size >= resultLimit) break
    }
  }
  return Array.from(results.values()).slice(0, resultLimit)
}

export async function getBeneficiariesPage(
  pageSize = 25,
  cursor: DocumentSnapshot<DocumentData> | null = null,
  sortKey: 'id' | 'firstName' | 'lastName' = 'lastName',
  direction: 'asc' | 'desc' = 'asc',
) {
  const sortField = sortKey === 'id' ? 'externalId' : sortKey
  return publicCursorPage<Beneficiary>('beneficiaries', pageSize, cursor, sortField, direction)
}

export async function getBeneficiary(id: string) {
  const snap = await getDoc(doc(beneficiariesCol, id))
  return toData<Beneficiary>(snap)
}

export async function addBeneficiary(data: Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'>) {
  let numericId = ''
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = String(100000 + Math.floor(Math.random() * 900000))
    if (!(await getDoc(doc(beneficiariesCol, candidate))).exists()) {
      numericId = candidate
      break
    }
  }
  if (!numericId) throw new Error('Не може да бъде създаден свободен цифров ID')
  await setDoc(doc(beneficiariesCol, numericId), {
    ...data,
    externalId: Number(data.externalId || numericId),
    ...await ownership(),
    createdAt: now(),
    updatedAt: now(),
  })
  clearCollectionCache('beneficiaries')
  return numericId
}

export async function updateBeneficiary(id: string, data: Partial<Beneficiary>) {
  await updateDoc(doc(beneficiariesCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('beneficiaries')
}

export async function deleteBeneficiary(id: string) {
  await deleteDoc(doc(beneficiariesCol, id))
  clearCollectionCache('beneficiaries')
}

// ── TASKS ─────────────────────────────────────────────────────
export const tasksCol = collection(db, 'tasks')

export async function getTasks() {
  const data = await visibleCollection<Task>('tasks')
  return data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function addTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(tasksCol, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() })
  clearCollectionCache('tasks')
  return ref.id
}

export async function updateTask(id: string, data: Partial<Task>) {
  await updateDoc(doc(tasksCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('tasks')
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(tasksCol, id))
  clearCollectionCache('tasks')
}

// ── EMPLOYERS ─────────────────────────────────────────────────
export const employersCol = collection(db, 'employers')

export async function getEmployers(search?: string) {
  let data = await visibleCollection<Employer>('employers')
  data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bg'))
  if (search) {
    const s = search.toLowerCase()
    data = data.filter(e =>
      e.name?.toLowerCase().includes(s) ||
      e.city?.toLowerCase().includes(s) ||
      e.eik?.includes(s)
    )
  }
  return data
}

export async function addEmployer(data: Omit<Employer, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(employersCol, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() })
  clearCollectionCache('employers')
  return ref.id
}

export async function updateEmployer(id: string, data: Partial<Employer>) {
  await updateDoc(doc(employersCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('employers')
}

export async function deleteEmployer(id: string) {
  await deleteDoc(doc(employersCol, id))
  clearCollectionCache('employers')
}

// ── VOLUNTEERS ────────────────────────────────────────────────
export const volunteersCol = collection(db, 'volunteers')

export async function getVolunteers() {
  const data = await visibleCollection<Volunteer>('volunteers')
  return data.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'bg'))
}

export async function addVolunteer(data: Omit<Volunteer, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(volunteersCol, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() })
  clearCollectionCache('volunteers')
  return ref.id
}

export async function updateVolunteer(id: string, data: Partial<Volunteer>) {
  await updateDoc(doc(volunteersCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('volunteers')
}

export async function deleteVolunteer(id: string) {
  await deleteDoc(doc(volunteersCol, id))
  clearCollectionCache('volunteers')
}

// ── DONORS ────────────────────────────────────────────────────
export const donorsCol = collection(db, 'donors')

export async function getDonors() {
  const data = await visibleCollection<Donor>('donors')
  return data.sort((a, b) => {
    const an = a.entityType === 'Юридическо лице' ? a.organizationName : `${a.firstName} ${a.lastName}`
    const bn = b.entityType === 'Юридическо лице' ? b.organizationName : `${b.firstName} ${b.lastName}`
    return (an || '').localeCompare(bn || '', 'bg')
  })
}

export async function addDonor(data: Omit<Donor, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(donorsCol, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() })
  clearCollectionCache('donors')
  return ref.id
}

export async function updateDonor(id: string, data: Partial<Donor>) {
  await updateDoc(doc(donorsCol, id), { ...data, updatedAt: now() })
  clearCollectionCache('donors')
}

export async function deleteDonor(id: string) {
  await deleteDoc(doc(donorsCol, id))
  clearCollectionCache('donors')
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
export const notificationsCol = collection(db, 'notifications')

export async function getNotifications(unreadOnly = false) {
  let data = await visibleCollection<Notification>('notifications')
  if (unreadOnly) data = data.filter(item => !item.isRead)
  return data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50)
}

export async function addNotification(data: Omit<Notification, 'id' | 'createdAt'>) {
  await addDoc(notificationsCol, { ...data, ...await ownership(), createdAt: now() })
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(notificationsCol, id), { isRead: true })
}

export async function markAllNotificationsRead() {
  const visible = await getNotifications(true)
  const batch = writeBatch(db)
  visible.forEach(item => batch.update(doc(notificationsCol, item.id), { isRead: true }))
  await batch.commit()
}

export function subscribeToNotifications(callback: (notifs: Notification[]) => void) {
  const uid = auth.currentUser?.uid
  if (!uid) return () => {}
  const q = query(notificationsCol, where('createdByUid', '==', uid), limit(50))
  return onSnapshot(q, snap => {
    callback(snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Notification))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20))
  })
}

export function subscribeToOnlineUsers(callback: (users: AdminUser[]) => void, onError?: () => void) {
  const q = query(collection(db, 'presence'), where('isOnline', '==', true))
  return onSnapshot(q, snap => {
    callback(snap.docs
      .map(d => ({ uid: d.id, email: '', role: 'user', createdAt: '', ...d.data() } as AdminUser))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'bg')))
  }, () => onError?.())
}

// ── EXPORT ────────────────────────────────────────────────────
export async function getExportData(dateFrom?: string, dateTo?: string) {
  let data = await visibleCollection<BeneficiaryRequest>('beneficiaryRequests')
  if (dateFrom) data = data.filter(r => r.createdAt >= dateFrom)
  if (dateTo)   data = data.filter(r => r.createdAt <= dateTo)
  return data
}

// ── DASHBOARD STATS ───────────────────────────────────────────
export async function getDashboardStats() {
  const access = await currentAccess()
  const sharedCounts = await Promise.all([
    getCountFromServer(beneficiariesCol),
    getCountFromServer(employersCol),
    getCountFromServer(volunteersCol),
    getCountFromServer(donorsCol),
  ])

  if (access.isAdmin) {
    const [allRequests, confirmed, pending, rejected, allTasks] = await Promise.all([
      getCountFromServer(requestsCol),
      getCountFromServer(query(requestsCol, where('status', '==', 'Потвърдено'))),
      getCountFromServer(query(requestsCol, where('status', '==', 'Чакащ'))),
      getCountFromServer(query(requestsCol, where('status', '==', 'Отхвърлено'))),
      getCountFromServer(tasksCol),
    ])

    return {
      totalRequests: allRequests.data().count,
      confirmedRequests: confirmed.data().count,
      pendingRequests: pending.data().count,
      rejectedRequests: rejected.data().count,
      totalBeneficiaries: sharedCounts[0].data().count,
      totalTasks: allTasks.data().count,
      totalEmployers: sharedCounts[1].data().count,
      totalVolunteers: sharedCounts[2].data().count,
      totalDonors: sharedCounts[3].data().count,
    }
  }

  const [requests, tasks] = await Promise.all([
    visibleCollection<BeneficiaryRequest>('beneficiaryRequests'),
    visibleCollection<Task>('tasks'),
  ])

  return {
    totalRequests:      requests.length,
    confirmedRequests:  requests.filter(r => r.status === 'Потвърдено').length,
    pendingRequests:    requests.filter(r => r.status === 'Чакащ').length,
    rejectedRequests:   requests.filter(r => r.status === 'Отхвърлено').length,
    totalBeneficiaries: sharedCounts[0].data().count,
    totalTasks:         tasks.length,
    totalEmployers:     sharedCounts[1].data().count,
    totalVolunteers:    sharedCounts[2].data().count,
    totalDonors:        sharedCounts[3].data().count,
  }
}
