import { auth } from './firebase'
import { migrateLegacyPhoto, removeBeneficiaryPhoto, removeBeneficiaryPhotos, resolveBeneficiaryPhotoUrls } from './beneficiary-photo-storage'
import {
  countAppDocuments, deleteAppDocuments, getAppDocument, getAppDocuments,
  getAppDocumentsByIds, getAppUsage, updateAppDocument, upsertAppDocument, upsertAppDocuments,
} from './app-data'
import type {
  BeneficiaryRequest, Beneficiary, Task, Employer, Notification, SearchParams,
  RequestStatus, Donor, Volunteer, AdminUser, ScheduleEntry, AuditAction, AuditLog, UserRole,
} from '@/types'

const now = () => new Date().toISOString()
const CACHE_MS = 60_000
type Cursor = string
type Access = Awaited<ReturnType<typeof loadCurrentAccess>>
let accessCache: { uid: string; value: Access } | null = null
const cache = new Map<string, { expiresAt: number; data: unknown[] }>()

async function loadCurrentAccess() {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Необходим е вход в системата')
  const profile = await getAppDocument<Partial<AdminUser>>('users', user.uid)
  const role = (profile?.role || 'user') as UserRole
  return { uid: user.uid, name: profile?.displayName || user.displayName || user.email || 'Потребител', role, isAdmin: role === 'admin' }
}

export async function currentAccess() {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Необходим е вход в системата')
  if (accessCache?.uid === uid) return accessCache.value
  const value = await loadCurrentAccess(); accessCache = { uid, value }; return value
}

function clearCache(collectionName: string) {
  for (const key of Array.from(cache.keys())) if (key.endsWith(`:${collectionName}`)) cache.delete(key)
}

async function visibleCollection<T>(collectionName: string): Promise<T[]> {
  const access = await currentAccess()
  const key = `${access.uid}:${collectionName}`
  const saved = cache.get(key)
  if (saved && saved.expiresAt > Date.now()) return saved.data as T[]
  const data = await getAppDocuments<Record<string, unknown>>(collectionName) as T[]
  cache.set(key, { data, expiresAt: Date.now() + CACHE_MS })
  return data
}

async function ownership() { const access = await currentAccess(); return { createdByUid: access.uid, createdByName: access.name } }
function withoutId<T extends object>(value: T) { const { id: _id, ...rest } = value as T & { id?: string }; return rest }
function newId() { return crypto.randomUUID() }

export async function addAuditLog(data: { action: AuditAction; entityType: string; entityId?: string; description: string; changedFields?: string[]; path?: string }) {
  const access = await currentAccess()
  await upsertAppDocument('auditLogs', newId(), {
    actorUid: access.uid, actorName: access.name, actorRole: access.role, action: data.action,
    entityType: data.entityType, ...(data.entityId ? { entityId: data.entityId } : {}),
    description: data.description, ...(data.changedFields?.length ? { changedFields: data.changedFields } : {}),
    path: data.path || (typeof window !== 'undefined' ? window.location.pathname : ''), createdAt: now(),
  })
}

async function auditChange(action: AuditAction, entityType: string, entityId: string | undefined, description: string, changedFields?: string[]) {
  try { await addAuditLog({ action, entityType, entityId, description, changedFields }) } catch (error) { console.error('Audit log could not be written', error) }
}

export async function getAuditLogs(resultLimit = 500) {
  if (!(await currentAccess()).isAdmin) throw new Error('Само администратор има достъп до историята')
  const rows = await getAppDocuments<Record<string, unknown>>('auditLogs') as unknown as AuditLog[]
  return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, resultLimit)
}

export async function clearAuditHistory() {
  if (!(await currentAccess()).isAdmin) throw new Error('Само администратор може да изтрива историята')
  const count = await deleteAppDocuments('auditLogs')
  await addAuditLog({ action: 'delete', entityType: 'auditHistory', description: `Изтрита е историята с ${count} събития`, path: '/admin/history' })
  return count
}

export interface CursorPage<T> { data: T[]; total: number; nextCursor: Cursor | null; hasNext: boolean }
async function cursorPage<T extends { id: string }>(collectionName: string, pageSize: number, cursor: Cursor | null, sortField: string, direction: 'asc' | 'desc' = 'asc'): Promise<CursorPage<T>> {
  const rows = await visibleCollection<T>(collectionName)
  rows.sort((a, b) => {
    const av = sortField === 'externalId' ? Number((a as unknown as Record<string, unknown>)[sortField] || a.id) : String((a as unknown as Record<string, unknown>)[sortField] || '')
    const bv = sortField === 'externalId' ? Number((b as unknown as Record<string, unknown>)[sortField] || b.id) : String((b as unknown as Record<string, unknown>)[sortField] || '')
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'bg')
    return direction === 'asc' ? cmp : -cmp
  })
  const offset = Number(cursor || 0), data = rows.slice(offset, offset + pageSize), next = offset + data.length
  return { data, total: rows.length, nextCursor: next < rows.length ? String(next) : null, hasNext: next < rows.length }
}

export async function getRequests(params: { page?: number; perPage?: number; search?: SearchParams } = {}) {
  const { page = 1, perPage = 20, search } = params; let all = await visibleCollection<BeneficiaryRequest>('beneficiaryRequests')
  if (search?.id) all = all.filter(r => r.id.includes(search.id!))
  if (search?.beneficiary) all = all.filter(r => r.beneficiaryName?.toLowerCase().includes(search.beneficiary!.toLowerCase()))
  if (search?.activity) all = all.filter(r => r.activity?.toLowerCase().includes(search.activity!.toLowerCase()))
  if (search?.dateFrom) all = all.filter(r => r.createdAt >= search.dateFrom!)
  if (search?.dateTo) all = all.filter(r => r.createdAt <= search.dateTo!)
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); const start = (page - 1) * perPage
  return { data: all.slice(start, start + perPage), total: all.length, page, perPage }
}
export function getRequestsPage(pageSize = 25, cursor: Cursor | null = null) { return cursorPage<BeneficiaryRequest>('beneficiaryRequests', pageSize, cursor, 'createdAt', 'desc') }
export function getRequest(id: string) { return getAppDocument<BeneficiaryRequest>('beneficiaryRequests', id) }
export async function addRequest(data: Omit<BeneficiaryRequest, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('beneficiaryRequests', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('beneficiaryRequests'); await auditChange('create', 'beneficiaryRequest', id, 'Създадена е заявка за дейност', Object.keys(data)); return id }
export async function updateRequest(id: string, data: Partial<BeneficiaryRequest>) { await updateAppDocument('beneficiaryRequests', id, { ...withoutId(data), updatedAt: now() }); clearCache('beneficiaryRequests'); await auditChange('update', 'beneficiaryRequest', id, 'Редактирана е заявка за дейност', Object.keys(data)) }
export async function deleteRequests(ids: string[]) { await deleteAppDocuments('beneficiaryRequests', ids); clearCache('beneficiaryRequests'); await auditChange('delete', 'beneficiaryRequest', ids.join(', '), `Изтрити са ${ids.length} заявки`) }
export async function updateRequestStatus(id: string, status: RequestStatus) { await updateRequest(id, { status }); await addNotification({ type: 'status_change', title: 'Промяна на статус на заявка', message: `Заявка #${id} е променена на: ${status}`, isRead: false, relatedId: id, relatedType: 'beneficiaryRequest' }) }

export async function getBeneficiaries(search?: string) { let data = await visibleCollection<Beneficiary>('beneficiaries'); data.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'bg')); if (search) { const s = search.toLowerCase(); data = data.filter(b => b.firstName?.toLowerCase().includes(s) || b.lastName?.toLowerCase().includes(s) || b.email?.toLowerCase().includes(s) || b.phone?.includes(s)) } return resolveBeneficiaryPhotoUrls(data) }
export async function searchBeneficiaries(term: string, resultLimit = 100) { const value = term.trim().toLocaleLowerCase('bg'); if (!value) return []; const rows = (await visibleCollection<Beneficiary>('beneficiaries')).filter(item => [item.id, item.firstName, item.lastName, item.middleName, item.email, item.egn, item.phone].some(field => String(field || '').toLocaleLowerCase('bg').includes(value))).slice(0, resultLimit); return resolveBeneficiaryPhotoUrls(rows) }
export async function getBeneficiariesPage(pageSize = 25, cursor: Cursor | null = null, sortKey: 'id' | 'firstName' | 'lastName' = 'lastName', direction: 'asc' | 'desc' = 'asc') { const result = await cursorPage<Beneficiary>('beneficiaries', pageSize, cursor, sortKey === 'id' ? 'externalId' : sortKey, direction); return { ...result, data: await resolveBeneficiaryPhotoUrls(result.data) } }
export async function getBeneficiary(id: string) { const row = await getAppDocument<Beneficiary>('beneficiaries', id); return row ? (await resolveBeneficiaryPhotoUrls([row]))[0] : null }
export async function addBeneficiary(data: Omit<Beneficiary, 'id' | 'createdAt' | 'updatedAt'>) { let id = ''; for (let attempt = 0; attempt < 20; attempt++) { const candidate = String(100000 + Math.floor(Math.random() * 900000)); if (!(await getAppDocument('beneficiaries', candidate))) { id = candidate; break } } if (!id) throw new Error('Не може да бъде създаден свободен цифров ID'); await upsertAppDocument('beneficiaries', id, { ...data, externalId: Number(data.externalId || id), ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('beneficiaries'); await auditChange('create', 'beneficiary', id, 'Създаден е нов бенефициент', Object.keys(data)); return id }
export async function updateBeneficiary(id: string, data: Partial<Beneficiary>) { await updateAppDocument('beneficiaries', id, { ...withoutId(data), updatedAt: now() }); clearCache('beneficiaries'); await auditChange('update', 'beneficiary', id, 'Редактиран е бенефициент', Object.keys(data)) }
export async function deleteBeneficiary(id: string) { const current = await getAppDocument<Beneficiary>('beneficiaries', id); await deleteAppDocuments('beneficiaries', [id]); clearCache('beneficiaries'); if (current?.photoPath) { try { await removeBeneficiaryPhoto(current.photoPath) } catch (error) { console.error('Beneficiary photo could not be removed', error) } } await auditChange('delete', 'beneficiary', id, 'Изтрит е бенефициент') }

export async function migrateLegacyBeneficiaryPhotos() {
  if (!(await currentAccess()).isAdmin) return 0
  const rows = await visibleCollection<Beneficiary>('beneficiaries')
  const legacy = rows.filter(item => !item.photoPath && item.photoUrl?.startsWith('data:'))
  let migrated = 0
  for (const beneficiary of legacy) {
    const result = await migrateLegacyPhoto(beneficiary)
    if (!result) continue
    await updateAppDocument('beneficiaries', beneficiary.id, { photoPath: result.path, photoUrl: '', updatedAt: now() })
    migrated++
  }
  if (migrated) {
    clearCache('beneficiaries')
    await auditChange('update', 'beneficiaryPhoto', undefined, `Преместени са ${migrated} стари снимки в Supabase Storage`, ['photoPath'])
  }
  return migrated
}

export async function getTasks() { return (await visibleCollection<Task>('tasks')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) }
export async function addTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('tasks', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('tasks'); await auditChange('create', 'task', id, 'Създадена е задача', Object.keys(data)); return id }
export async function updateTask(id: string, data: Partial<Task>) { await updateAppDocument('tasks', id, { ...withoutId(data), updatedAt: now() }); clearCache('tasks'); await auditChange('update', 'task', id, 'Редактирана е задача', Object.keys(data)) }
export async function deleteTask(id: string) { await deleteAppDocuments('tasks', [id]); clearCache('tasks'); await auditChange('delete', 'task', id, 'Изтрита е задача') }

export async function getScheduleEntries(month: string) { const next = new Date(`${month}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); const end = next.toISOString().slice(0, 10); return (await visibleCollection<ScheduleEntry>('schedule')).filter(item => item.date >= `${month}-01` && item.date < end).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`, 'bg')) }
export async function addScheduleEntry(data: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('schedule', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('schedule'); await auditChange('create', 'schedule', id, 'Добавен е запис в графика', Object.keys(data)); return id }
export async function updateScheduleEntry(id: string, data: Partial<ScheduleEntry>) { await updateAppDocument('schedule', id, { ...withoutId(data), updatedAt: now() }); clearCache('schedule'); await auditChange('update', 'schedule', id, 'Редактиран е запис в графика', Object.keys(data)) }
export async function deleteScheduleEntries(ids: string[]) { await deleteAppDocuments('schedule', ids); clearCache('schedule'); await auditChange('delete', 'schedule', ids.join(', '), `Изтрити са ${ids.length} записа от графика`) }
export async function importScheduleEntries(entries: Array<Pick<ScheduleEntry, 'date' | 'time' | 'description' | 'phone' | 'performers' | 'sourceRow'>>) { const access = await currentAccess(); if (!access.isAdmin) throw new Error('Само администратор може да импортира график'); const stamp = now(); await upsertAppDocuments(entries.map((entry, index) => ({ collection_name: 'schedule', id: `schedule-2026-plovdiv-${String(entry.sourceRow || index + 1).padStart(5, '0')}`, data: { ...entry, createdByUid: access.uid, createdByName: access.name, createdAt: stamp, updatedAt: stamp } }))); clearCache('schedule'); await auditChange('import', 'schedule', undefined, `Импортирани са ${entries.length} записа в графика`); return entries.length }

export async function getEmployers(search?: string) { let data = (await visibleCollection<Employer>('employers')).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bg')); if (search) { const s = search.toLowerCase(); data = data.filter(e => e.name?.toLowerCase().includes(s) || e.city?.toLowerCase().includes(s) || e.eik?.includes(s)) } return data }
export async function addEmployer(data: Omit<Employer, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('employers', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('employers'); await auditChange('create', 'employer', id, 'Създаден е работодател', Object.keys(data)); return id }
export async function updateEmployer(id: string, data: Partial<Employer>) { await updateAppDocument('employers', id, { ...withoutId(data), updatedAt: now() }); clearCache('employers'); await auditChange('update', 'employer', id, 'Редактиран е работодател', Object.keys(data)) }
export async function deleteEmployer(id: string) { await deleteAppDocuments('employers', [id]); clearCache('employers'); await auditChange('delete', 'employer', id, 'Изтрит е работодател') }
export async function getVolunteers() { return (await visibleCollection<Volunteer>('volunteers')).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'bg')) }
export async function addVolunteer(data: Omit<Volunteer, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('volunteers', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('volunteers'); await auditChange('create', 'volunteer', id, 'Създаден е доброволец', Object.keys(data)); return id }
export async function updateVolunteer(id: string, data: Partial<Volunteer>) { await updateAppDocument('volunteers', id, { ...withoutId(data), updatedAt: now() }); clearCache('volunteers'); await auditChange('update', 'volunteer', id, 'Редактиран е доброволец', Object.keys(data)) }
export async function deleteVolunteer(id: string) { await deleteAppDocuments('volunteers', [id]); clearCache('volunteers'); await auditChange('delete', 'volunteer', id, 'Изтрит е доброволец') }
export async function getDonors() { return (await visibleCollection<Donor>('donors')).sort((a, b) => { const an = a.entityType === 'Юридическо лице' ? a.organizationName : `${a.firstName} ${a.lastName}`, bn = b.entityType === 'Юридическо лице' ? b.organizationName : `${b.firstName} ${b.lastName}`; return (an || '').localeCompare(bn || '', 'bg') }) }
export async function addDonor(data: Omit<Donor, 'id' | 'createdAt' | 'updatedAt'>) { const id = newId(); await upsertAppDocument('donors', id, { ...data, ...await ownership(), createdAt: now(), updatedAt: now() }); clearCache('donors'); await auditChange('create', 'donor', id, 'Създаден е дарител', Object.keys(data)); return id }
export async function updateDonor(id: string, data: Partial<Donor>) { await updateAppDocument('donors', id, { ...withoutId(data), updatedAt: now() }); clearCache('donors'); await auditChange('update', 'donor', id, 'Редактиран е дарител', Object.keys(data)) }
export async function deleteDonor(id: string) { await deleteAppDocuments('donors', [id]); clearCache('donors'); await auditChange('delete', 'donor', id, 'Изтрит е дарител') }

export async function getNotifications(unreadOnly = false) { let data = await visibleCollection<Notification>('notifications'); if (unreadOnly) data = data.filter(item => !item.isRead); return data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 50) }
export async function addNotification(data: Omit<Notification, 'id' | 'createdAt'>) { await upsertAppDocument('notifications', newId(), { ...data, ...await ownership(), createdAt: now() }); clearCache('notifications') }
export async function markNotificationRead(id: string) { await updateAppDocument('notifications', id, { isRead: true }); clearCache('notifications') }
export async function markAllNotificationsRead() { await Promise.all((await getNotifications(true)).map(item => updateAppDocument('notifications', item.id, { isRead: true }))); clearCache('notifications') }
export function subscribeToNotifications(callback: (notifs: Notification[]) => void) { let active = true; const refresh = () => { clearCache('notifications'); void getNotifications().then(rows => { if (active) callback(rows.slice(0, 20)) }).catch(() => {}) }; refresh(); const timer = window.setInterval(refresh, 60_000); return () => { active = false; window.clearInterval(timer) } }
export function subscribeToOnlineUsers(callback: (users: AdminUser[]) => void, onError?: () => void) { let active = true; const refresh = () => { clearCache('presence'); void getAppDocuments<Record<string, unknown>>('presence').then(rows => { if (active) callback((rows as unknown as AdminUser[]).filter(item => item.isOnline).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'bg'))) }).catch(() => onError?.()) }; refresh(); const timer = window.setInterval(refresh, 30_000); return () => { active = false; window.clearInterval(timer) } }

export async function getUsers() { const rows = await getAppDocuments<AdminUser>('users'); return rows.map(row => ({ ...row, uid: row.uid || row.id })) }
export async function getUser(uid: string) { const row = await getAppDocument<AdminUser>('users', uid); return row ? { ...row, uid } : null }
export async function saveUser(uid: string, data: Partial<AdminUser>) { await upsertAppDocument('users', uid, withoutId(data)); accessCache = null; clearCache('users') }
export async function patchUser(uid: string, data: Partial<AdminUser>) { await updateAppDocument('users', uid, withoutId(data)); accessCache = null; clearCache('users') }
export async function deleteUsers(ids: string[]) { const count = await deleteAppDocuments('users', ids); clearCache('users'); return count }
export async function replaceImportDocuments(items: Array<{ collectionName: 'beneficiaries' | 'beneficiaryRequests'; id: string; data: Record<string, unknown> }>) { await upsertAppDocuments(items.map(item => ({ collection_name: item.collectionName, id: item.id, data: item.data }))); clearCache('beneficiaries'); clearCache('beneficiaryRequests') }
export async function getExistingImportIds(collectionName: 'beneficiaries' | 'beneficiaryRequests', ids: string[]) { return new Set((await getAppDocumentsByIds<Record<string, unknown>>(collectionName, ids)).map(item => item.id)) }
export async function clearImportCollection(collectionName: 'beneficiaries' | 'beneficiaryRequests') { if (collectionName === 'beneficiaries') { const rows = await getAppDocuments<Beneficiary>('beneficiaries'); await removeBeneficiaryPhotos(rows.map(item => item.photoPath).filter((path): path is string => Boolean(path))) } const count = await deleteAppDocuments(collectionName); clearCache(collectionName); return count }

const CLEANABLE_COLLECTIONS = new Set([
  'beneficiaryRequests', 'beneficiaries', 'schedule', 'tasks', 'employers',
  'volunteers', 'donors', 'notifications', 'auditLogs',
])

export async function getSupabaseUsage() {
  if (!(await currentAccess()).isAdmin) throw new Error('Само администратор има достъп до потреблението')
  return getAppUsage()
}

export async function clearUsageCollection(collectionName: string) {
  if (!(await currentAccess()).isAdmin) throw new Error('Само администратор може да изтрива данни')
  if (!CLEANABLE_COLLECTIONS.has(collectionName)) throw new Error('Тази категория е защитена от изтриване')
  if (collectionName === 'beneficiaries') {
    const rows = await getAppDocuments<Beneficiary>('beneficiaries')
    await removeBeneficiaryPhotos(rows.map(item => item.photoPath).filter((path): path is string => Boolean(path)))
  }
  const count = await deleteAppDocuments(collectionName)
  clearCache(collectionName)
  await auditChange('delete', collectionName, undefined, `Изтрити са всички ${count} записа от категория ${collectionName}`)
  return count
}

export async function getExportData(dateFrom?: string, dateTo?: string) { let data = await visibleCollection<BeneficiaryRequest>('beneficiaryRequests'); if (dateFrom) data = data.filter(r => r.createdAt >= dateFrom); if (dateTo) data = data.filter(r => r.createdAt <= dateTo); return data }
export async function getDashboardStats() { const [requests, tasks, totalBeneficiaries, totalEmployers, totalVolunteers, totalDonors] = await Promise.all([visibleCollection<BeneficiaryRequest>('beneficiaryRequests'), visibleCollection<Task>('tasks'), countAppDocuments('beneficiaries'), countAppDocuments('employers'), countAppDocuments('volunteers'), countAppDocuments('donors')]); return { totalRequests: requests.length, confirmedRequests: requests.filter(r => r.status === 'Потвърдено').length, pendingRequests: requests.filter(r => r.status === 'Чакащ').length, rejectedRequests: requests.filter(r => r.status === 'Отхвърлено').length, totalBeneficiaries, totalTasks: tasks.length, totalEmployers, totalVolunteers, totalDonors } }
