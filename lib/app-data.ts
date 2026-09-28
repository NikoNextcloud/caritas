import { supabase } from './supabase'

export interface AppDocument<T extends object = Record<string, unknown>> {
  collection_name: string
  id: string
  data: T
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function getAppDocument<T extends object>(collectionName: string, id: string) {
  const { data, error } = await supabase
    .from('app_documents')
    .select('id,data')
    .eq('collection_name', collectionName)
    .eq('id', id)
    .maybeSingle()
  fail(error)
  return data ? ({ id: data.id, ...(data.data as T) } as T & { id: string }) : null
}

export async function getAppDocuments<T extends object>(collectionName: string) {
  const { data, error } = await supabase
    .from('app_documents')
    .select('id,data')
    .eq('collection_name', collectionName)
  fail(error)
  return (data || []).map(row => ({ id: row.id, ...(row.data as T) } as T & { id: string }))
}

export async function getAppDocumentsByIds<T extends object>(collectionName: string, ids: string[]) {
  if (!ids.length) return []
  const rows: Array<T & { id: string }> = []
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase
      .from('app_documents')
      .select('id,data')
      .eq('collection_name', collectionName)
      .in('id', ids.slice(offset, offset + 200))
    fail(error)
    rows.push(...(data || []).map(row => ({ id: row.id, ...(row.data as T) } as T & { id: string })))
  }
  return rows
}

export async function upsertAppDocument(collectionName: string, id: string, value: Record<string, unknown>) {
  const { error } = await supabase.from('app_documents').upsert({
    collection_name: collectionName,
    id,
    data: value,
  }, { onConflict: 'collection_name,id' })
  fail(error)
}

export async function upsertAppDocuments(items: AppDocument[]) {
  if (!items.length) return
  for (let offset = 0; offset < items.length; offset += 500) {
    const { error } = await supabase.from('app_documents').upsert(items.slice(offset, offset + 500), {
      onConflict: 'collection_name,id',
    })
    fail(error)
  }
}

export async function updateAppDocument(collectionName: string, id: string, patch: Record<string, unknown>) {
  const current = await getAppDocument<Record<string, unknown>>(collectionName, id)
  if (!current) throw new Error(`Липсва запис ${collectionName}/${id}`)
  const { id: _id, ...data } = current
  await upsertAppDocument(collectionName, id, { ...data, ...patch })
}

export async function deleteAppDocuments(collectionName: string, ids?: string[]) {
  let request = supabase.from('app_documents').delete().eq('collection_name', collectionName)
  if (ids) {
    if (!ids.length) return 0
    request = request.in('id', ids)
  }
  const { data, error } = await request.select('id')
  fail(error)
  return data?.length || 0
}

export async function countAppDocuments(collectionName: string) {
  const { count, error } = await supabase
    .from('app_documents')
    .select('*', { count: 'exact', head: true })
    .eq('collection_name', collectionName)
  fail(error)
  return count || 0
}
