import { auth } from './firebase'
import { supabase } from './supabase'
import { fileFromDataUrl, prepareBeneficiaryPhoto } from './beneficiary-images'
import type { Beneficiary } from '@/types'

const BUCKET = 'beneficiary-photos'
const SIGNED_URL_LIFETIME = 4 * 60 * 60

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function uploadBeneficiaryPhoto(beneficiaryId: string, source: File | Blob, previousPath?: string) {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Необходим е вход в системата')

  const prepared = await prepareBeneficiaryPhoto(source)
  const path = `${uid}/${beneficiaryId}/profile.${prepared.extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, {
    cacheControl: '14400',
    contentType: prepared.contentType,
    upsert: true,
  })
  fail(error)

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([previousPath])
    if (removeError) console.warn('Old beneficiary photo could not be removed', removeError)
  }

  return { path, bytes: prepared.blob.size, width: prepared.width, height: prepared.height }
}

export async function removeBeneficiaryPhoto(path?: string) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  fail(error)
}

export async function removeBeneficiaryPhotos(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))
  for (let offset = 0; offset < uniquePaths.length; offset += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(uniquePaths.slice(offset, offset + 100))
    fail(error)
  }
}

export async function resolveBeneficiaryPhotoUrls<T extends Beneficiary>(beneficiaries: T[]) {
  const paths = Array.from(new Set(beneficiaries.map(item => item.photoPath).filter((path): path is string => Boolean(path))))
  if (!paths.length) return beneficiaries

  const signed = new Map<string, string>()
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths.slice(offset, offset + 100), SIGNED_URL_LIFETIME)
    if (error) {
      console.warn('Beneficiary photos could not be signed', error)
      continue
    }
    for (const item of data || []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl)
  }
  return beneficiaries.map(item => item.photoPath && signed.has(item.photoPath)
    ? { ...item, photoUrl: signed.get(item.photoPath) }
    : item)
}

export async function migrateLegacyPhoto(beneficiary: Beneficiary) {
  if (beneficiary.photoPath || !beneficiary.photoUrl?.startsWith('data:')) return null
  const blob = await fileFromDataUrl(beneficiary.photoUrl)
  return uploadBeneficiaryPhoto(beneficiary.id, blob)
}
