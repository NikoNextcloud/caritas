import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, writeBatch,
  type DocumentSnapshot, type DocumentData
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  BeneficiaryRequest, Beneficiary, Task, Employer,
  Notification, SearchParams, RequestStatus
} from '@/types'

const now = () => new Date().toISOString()

function toData<T>(snap: { exists: () => boolean; id: string; data: () => Record<string, unknown> | undefined }): T | null {
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

// ── BENEFICIARY REQUESTS ──────────────────────────────────────
export const requestsCol = collection(db, 'beneficiaryRequests')

export async function getRequests(params: {
  page?: number; perPage?: number; search?: SearchParams
} = {}) {
  const { page = 1, perPage = 20, search } = params
  let q = query(requestsCol, orderBy('createdAt', 'desc'))
  if (search?.status) q = query(q, where('status', '==', search.status))

  const snap = await getDocs(q)
  let all = snap.docs.map(d => ({ id: d.id, ...d.data() } as BeneficiaryRequest))

  // client-side filters
  if (search?.id)          all = all.filter(r => r.id.includes(search.id!))
  if (search?.beneficiary) all = all.filter(r => r.beneficiaryName?.toLowerCase().includes(search.beneficiary!.toLowerCase()))
  if (search?.activity)    all = all.filter(r => r.activity?.toLowerCase().includes(search.activity!.toLowerCase()))
  if (search?.dateFrom)    all = all.filter(r => r.createdAt >= search.dateFrom!)
  if (search?.dateTo)      all = all.filter(r => r.createdAt <= search.dateTo!)

  const start = (page - 1) * perPage
  return { data: all.slice(start, start + perPage), total: all.length, page, perPage }
}

export async function getRequest(id: string) {
  const snap = await getDoc(doc(requestsCol, id))
  return toData<BeneficiaryRequest>(snap)
}

export async function addRequest(data: Omit<BeneficiaryRequest, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(requestsCol, { ...data, createdAt: now(), updatedAt: now() })
  return ref.id
}

export async function updateRequest(id: string, data: Partial<BeneficiaryRequest>) {
  await updateDoc(doc(requestsCol, id), { ...data, updatedAt: now() })
}

export async function deleteRequests(ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach(id => batch.delete(doc(requestsCol, id)))
  await batch.commit()
}

export async function updateRequestStatus(id: string, status: RequestStatus) {
  await updateDoc(doc(requestsCol, id), { status, updatedAt: now() })
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
  const snap = await getDocs(query(beneficiariesCol, orderBy('lastName', 'asc')))
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Beneficiary))
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

export async function getBeneficiary(id: string) {
  const snap = await getDoc(doc(beneficiariesCol, id))
  return toData<Beneficiary>(snap)
}

export async function addBeneficiary(data: Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(beneficiariesCol, { ...data, createdAt: now(), updatedAt: now() })
  return ref.id
}

export async function updateBeneficiary(id: string, data: Partial<Beneficiary>) {
  await updateDoc(doc(beneficiariesCol, id), { ...data, updatedAt: now() })
}

export async function deleteBeneficiary(id: string) {
  await deleteDoc(doc(beneficiariesCol, id))
}

// ── TASKS ─────────────────────────────────────────────────────
export const tasksCol = collection(db, 'tasks')

export async function getTasks() {
  const snap = await getDocs(query(tasksCol, orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
}

export async function addTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(tasksCol, { ...data, createdAt: now(), updatedAt: now() })
  return ref.id
}

export async function updateTask(id: string, data: Partial<Task>) {
  await updateDoc(doc(tasksCol, id), { ...data, updatedAt: now() })
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(tasksCol, id))
}

// ── EMPLOYERS ─────────────────────────────────────────────────
export const employersCol = collection(db, 'employers')

export async function getEmployers(search?: string) {
  const snap = await getDocs(query(employersCol, orderBy('name', 'asc')))
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employer))
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
  const ref = await addDoc(employersCol, { ...data, createdAt: now(), updatedAt: now() })
  return ref.id
}

export async function updateEmployer(id: string, data: Partial<Employer>) {
  await updateDoc(doc(employersCol, id), { ...data, updatedAt: now() })
}

export async function deleteEmployer(id: string) {
  await deleteDoc(doc(employersCol, id))
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
export const notificationsCol = collection(db, 'notifications')

export async function getNotifications(unreadOnly = false) {
  let q = query(notificationsCol, orderBy('createdAt', 'desc'), limit(50))
  if (unreadOnly) q = query(q, where('isRead', '==', false))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
}

export async function addNotification(data: Omit<Notification, 'id' | 'createdAt'>) {
  await addDoc(notificationsCol, { ...data, createdAt: now() })
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(notificationsCol, id), { isRead: true })
}

export async function markAllNotificationsRead() {
  const snap = await getDocs(query(notificationsCol, where('isRead', '==', false)))
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { isRead: true }))
  await batch.commit()
}

export function subscribeToNotifications(callback: (notifs: Notification[]) => void) {
  const q = query(notificationsCol, orderBy('createdAt', 'desc'), limit(20))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)))
  })
}

// ── EXPORT ────────────────────────────────────────────────────
export async function getExportData(dateFrom?: string, dateTo?: string) {
  const snap = await getDocs(query(requestsCol, orderBy('createdAt', 'desc')))
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BeneficiaryRequest))
  if (dateFrom) data = data.filter(r => r.createdAt >= dateFrom)
  if (dateTo)   data = data.filter(r => r.createdAt <= dateTo)
  return data
}

// ── DASHBOARD STATS ───────────────────────────────────────────
export async function getDashboardStats() {
  const [reqSnap, benSnap, taskSnap, empSnap] = await Promise.all([
    getDocs(requestsCol),
    getDocs(beneficiariesCol),
    getDocs(tasksCol),
    getDocs(employersCol),
  ])

  const requests = reqSnap.docs.map(d => d.data() as BeneficiaryRequest)

  return {
    totalRequests:      requests.length,
    confirmedRequests:  requests.filter(r => r.status === 'Потвърдено').length,
    pendingRequests:    requests.filter(r => r.status === 'Чакащ').length,
    rejectedRequests:   requests.filter(r => r.status === 'Отхвърлено').length,
    totalBeneficiaries: benSnap.size,
    totalTasks:         taskSnap.size,
    totalEmployers:     empSnap.size,
  }
}
