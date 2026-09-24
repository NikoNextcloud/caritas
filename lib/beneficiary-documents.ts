'use client'

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'
import type { Beneficiary, BeneficiaryDocumentProfile, CvEducationEntry, CvExperience, CvReference, FamilyMember } from '@/types'

export type BeneficiaryDocumentKind = 'career-card' | 'humanitarian-card' | 'individual-plan' | 'cv'

const TEMPLATE_PATHS: Record<Exclude<BeneficiaryDocumentKind, 'cv'>, string> = {
  'career-card': '/templates/participation-career.docx',
  'humanitarian-card': '/templates/participation-humanitarian.docx',
  'individual-plan': '/templates/individual-plan.docx',
}

function displayDate(value?: string) {
  if (!value) return ''
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : value
}

function fullName(beneficiary: Beneficiary) {
  return [beneficiary.firstName, beneficiary.middleName, beneficiary.lastName].filter(Boolean).join(' ')
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

function fallback(value: string | undefined, alternative = '') {
  return value?.trim() || alternative
}

function familyValue(members: FamilyMember[], index: number, field: keyof FamilyMember) {
  return members[index]?.[field] || ''
}

export function beneficiaryDocumentData(beneficiary: Beneficiary) {
  const profile: BeneficiaryDocumentProfile = beneficiary.documentProfile || {}
  const family = profile.familyMembers || []
  const name = fullName(beneficiary)
  const date = profile.registrationDate || beneficiary.createdAt?.slice(0, 10) || ''
  const worker = fallback(profile.caseWorker, fallback(beneficiary.assignedToName, beneficiary.mentor || ''))

  return {
    beneficiaryId: String(beneficiary.externalId || beneficiary.id),
    fullName: name,
    egn: beneficiary.egn || '',
    birthDate: displayDate(beneficiary.birthDate),
    country: beneficiary.country || '',
    status: beneficiary.status || '',
    phone: beneficiary.phone || '',
    email: beneficiary.email || '',
    registrationDate: displayDate(date),
    interviewer: fallback(profile.interviewer, worker),
    registrationPlace: fallback(profile.registrationPlace, 'Хуманитарно-консултативен център Пловдив'),
    householdSummary: profile.householdSummary || '',
    requestedSupport: fallback(profile.requestedSupport, beneficiary.requestedHelp || ''),
    socialStatuses: fallback(profile.socialStatuses, beneficiary.vulnerability || ''),
    residenceStatus: fallback(profile.residenceStatus, beneficiary.status || ''),
    socialServices: profile.socialServices || '',
    socialActivities: profile.socialActivities || '',
    family1Name: familyValue(family, 0, 'name'),
    family1Gender: familyValue(family, 0, 'gender'),
    family1BirthId: familyValue(family, 0, 'birthDateOrId'),
    family1Relation: familyValue(family, 0, 'relation'),
    family2Name: familyValue(family, 1, 'name'),
    family2Gender: familyValue(family, 1, 'gender'),
    family2BirthId: familyValue(family, 1, 'birthDateOrId'),
    family2Relation: familyValue(family, 1, 'relation'),
    family3Name: familyValue(family, 2, 'name'),
    family3Gender: familyValue(family, 2, 'gender'),
    family3BirthId: familyValue(family, 2, 'birthDateOrId'),
    family3Relation: familyValue(family, 2, 'relation'),
    family4Name: familyValue(family, 3, 'name'),
    family4Gender: familyValue(family, 3, 'gender'),
    family4BirthId: familyValue(family, 3, 'birthDateOrId'),
    family4Relation: familyValue(family, 3, 'relation'),
    family5Name: familyValue(family, 4, 'name'),
    family5Gender: familyValue(family, 4, 'gender'),
    family5BirthId: familyValue(family, 4, 'birthDateOrId'),
    family5Relation: familyValue(family, 4, 'relation'),

    careerLivingSituation: profile.careerLivingSituation || '',
    careerDependants: profile.careerDependants || '',
    careerPhysicalLimitations: profile.careerPhysicalLimitations || '',
    careerDrivingLicence: profile.careerDrivingLicence || '',
    careerTravelReadiness: profile.careerTravelReadiness || '',
    careerCityOrientation: profile.careerCityOrientation || '',
    careerLabourLawKnowledge: profile.careerLabourLawKnowledge || '',
    careerEmployerMeeting: profile.careerEmployerMeeting || '',
    careerComputerSkills: fallback(profile.careerComputerSkills, profile.computerSkills || ''),
    careerBulgarianLevel: fallback(profile.careerBulgarianLevel, profile.bulgarianLevel || ''),
    careerWantsBulgarian: profile.careerWantsBulgarian || '',
    careerOtherLanguages: fallback(profile.careerOtherLanguages, profile.otherLanguages || ''),
    careerHobbies: profile.careerHobbies || '',
    careerEducation: fallback(profile.careerEducation, beneficiary.education || ''),
    careerQualificationNeeds: profile.careerQualificationNeeds || '',
    careerDesiredWork: fallback(profile.careerDesiredWork, profile.cvDesiredPosition || ''),
    careerDesiredSalary: profile.careerDesiredSalary || '',
    careerJobPriorities: profile.careerJobPriorities || '',
    careerAvailability: profile.careerAvailability || '',
    careerDecisionTime: profile.careerDecisionTime || '',
    careerExperienceAbroad: profile.careerExperienceAbroad || '',
    careerExperienceBulgaria: fallback(profile.careerExperienceBulgaria, beneficiary.workExperience || ''),
    careerAdditionalInfo: profile.careerAdditionalInfo || '',

    humanitarianFamilySituation: fallback(profile.humanitarianFamilySituation, beneficiary.familyStatus || ''),
    humanitarianSocialGroup: profile.humanitarianSocialGroup || '',
    humanitarianHealthStatus: profile.humanitarianHealthStatus || '',
    humanitarianIncomeSources: profile.humanitarianIncomeSources || '',
    humanitarianDiseaseDescription: profile.humanitarianDiseaseDescription || '',
    humanitarianLivingConditions: profile.humanitarianLivingConditions || '',
    humanitarianCaseInfo: fallback(profile.humanitarianCaseInfo, beneficiary.caseDescription || beneficiary.notes || ''),

    caseWorker: worker,
    planDate: displayDate(profile.planDate || date),
    translationLanguage: profile.translationLanguage || '',
    translator: profile.translator || '',
    bulgarianLevel: fallback(profile.bulgarianLevel, profile.careerBulgarianLevel || ''),
    otherLanguages: fallback(profile.otherLanguages, profile.careerOtherLanguages || ''),
    education: fallback(profile.cvEducation, beneficiary.education || ''),
    careerOrientation: fallback(profile.careerOrientation, profile.careerDesiredWork || ''),
    skillsAndInterests: fallback(profile.skillsAndInterests, profile.cvSkills || ''),
    computerSkills: fallback(profile.computerSkills, profile.careerComputerSkills || ''),
    healthStatus: fallback(profile.healthStatus, profile.humanitarianHealthStatus || ''),
    environmentOrientation: profile.environmentOrientation || '',
    familyStatus: fallback(beneficiary.familyStatus, profile.humanitarianFamilySituation || ''),
    socialContacts: profile.socialContacts || '',
    emotionalHealth: profile.emotionalHealth || '',
    longTermGoal: fallback(profile.longTermGoal, profile.cvDesiredPosition || 'Осигуряване на трудова заетост'),
    strengths: profile.strengths || '',
    skills: fallback(profile.skills, profile.cvSkills || ''),
    barriers: profile.barriers || '',
    previousExperience: fallback(profile.previousExperience, profile.cvWorkExperience || beneficiary.workExperience || ''),
    serviceProvider: fallback(profile.serviceProvider, 'Каритас Витания'),
    planDeadline: displayDate(profile.planDeadline),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function renderTemplate(kind: Exclude<BeneficiaryDocumentKind, 'cv'>, beneficiary: Beneficiary) {
  const response = await fetch(TEMPLATE_PATHS[kind])
  if (!response.ok) throw new Error('Шаблонът не може да бъде зареден')
  const zip = new PizZip(await response.arrayBuffer())
  const template = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })
  template.render(beneficiaryDocumentData(beneficiary))
  return template.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

type CvFonts = { regular: PDFFont, bold: PDFFont }
type CvFlow = { doc: PDFDocument, page: PDFPage, fonts: CvFonts, x: number, width: number, y: number, name: string }

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const INK = rgb(0.22, 0.22, 0.22)
const MUTED = rgb(0.43, 0.43, 0.43)
const RULE = rgb(0.72, 0.72, 0.72)
const HEADER = rgb(0.96, 0.96, 0.96)

function listItems(value?: string) {
  return (value || '').split(/\r?\n|[,;]+/).map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
}

function splitLines(font: PDFFont, text: string, size: number, maxWidth: number) {
  const result: string[] = []
  for (const paragraph of String(text || '').split(/\r?\n/)) {
    if (!paragraph.trim()) { result.push(''); continue }
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue }
      if (line) result.push(line)
      if (font.widthOfTextAtSize(word, size) <= maxWidth) { line = word; continue }
      let part = ''
      for (const character of word) {
        if (font.widthOfTextAtSize(part + character, size) > maxWidth && part) { result.push(part); part = character } else part += character
      }
      line = part
    }
    if (line) result.push(line)
  }
  return result
}

function drawLines(page: PDFPage, lines: string[], font: PDFFont, size: number, x: number, y: number, lineHeight: number, color = MUTED, prefix = '') {
  let cursor = y
  for (const line of lines) {
    page.drawText(`${prefix}${line}`, { x, y: cursor, size, font, color })
    cursor -= lineHeight
  }
  return cursor
}

function sectionHeading(page: PDFPage, title: string, fonts: CvFonts, x: number, y: number) {
  page.drawText(title.toLocaleUpperCase('bg-BG'), { x, y, size: 13, font: fonts.bold, color: INK })
  return y - 24
}

function addContinuationPage(flow: CvFlow) {
  const page = flow.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 72, width: PAGE_WIDTH, height: 72, color: HEADER })
  page.drawText(flow.name, { x: 44, y: PAGE_HEIGHT - 45, size: 18, font: flow.fonts.bold, color: INK })
  page.drawLine({ start: { x: 44, y: PAGE_HEIGHT - 75 }, end: { x: PAGE_WIDTH - 44, y: PAGE_HEIGHT - 75 }, thickness: 0.7, color: RULE })
  flow.page = page
  flow.x = 44
  flow.width = PAGE_WIDTH - 88
  flow.y = PAGE_HEIGHT - 105
}

function ensureSpace(flow: CvFlow, height: number) {
  if (flow.y - height < 45) addContinuationPage(flow)
}

function flowHeading(flow: CvFlow, title: string) {
  ensureSpace(flow, 40)
  flow.y = sectionHeading(flow.page, title, flow.fonts, flow.x, flow.y)
}

function flowText(flow: CvFlow, text: string, options: { size?: number, bold?: boolean, color?: ReturnType<typeof rgb>, gap?: number } = {}) {
  const size = options.size || 9.5
  const font = options.bold ? flow.fonts.bold : flow.fonts.regular
  const lineHeight = size + 4
  const lines = splitLines(font, text, size, flow.width)
  for (const line of lines) {
    ensureSpace(flow, lineHeight + 4)
    flow.page.drawText(line, { x: flow.x, y: flow.y, size, font, color: options.color || MUTED })
    flow.y -= lineHeight
  }
  flow.y -= options.gap ?? 8
}

function flowBullets(flow: CvFlow, value: string) {
  const items = listItems(value)
  for (const item of items) {
    const lines = splitLines(flow.fonts.regular, item, 9.2, flow.width - 14)
    for (let index = 0; index < lines.length; index++) {
      ensureSpace(flow, 14)
      flow.page.drawText(index === 0 ? '•' : '', { x: flow.x, y: flow.y, size: 9, font: flow.fonts.bold, color: MUTED })
      flow.page.drawText(lines[index], { x: flow.x + 12, y: flow.y, size: 9.2, font: flow.fonts.regular, color: MUTED })
      flow.y -= 13
    }
  }
  flow.y -= 8
}

function hasValues(entry: object) {
  return Object.values(entry as Record<string, string | undefined>).some(value => value?.trim())
}

function cvExperiences(profile: BeneficiaryDocumentProfile, beneficiary: Beneficiary) {
  const saved = (profile.cvExperiences || []).filter(entry => hasValues(entry))
  if (profile.cvExperiences !== undefined) return saved
  const legacy = fallback(profile.cvWorkExperience, beneficiary.workExperience || beneficiary.experience || '')
  return legacy ? [{ description: legacy } satisfies CvExperience] : []
}

function cvEducation(profile: BeneficiaryDocumentProfile, beneficiary: Beneficiary) {
  const saved = (profile.cvEducationEntries || []).filter(entry => hasValues(entry))
  if (profile.cvEducationEntries !== undefined) return saved
  const legacy = fallback(profile.cvEducation, beneficiary.education || '')
  return legacy ? [{ qualification: legacy } satisfies CvEducationEntry] : []
}

function dateRange(start?: string, end?: string) {
  return [start, end].filter(Boolean).join(' - ')
}

async function circularPhoto(photoUrl?: string) {
  if (!photoUrl) return null
  try {
    const response = await fetch(photoUrl)
    if (!response.ok) return null
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (!context) return null
    const scale = Math.max(320 / bitmap.width, 320 / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    context.beginPath()
    context.arc(160, 160, 160, 0, Math.PI * 2)
    context.clip()
    context.drawImage(bitmap, (320 - width) / 2, (320 - height) / 2, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  } catch {
    return null
  }
}

function drawCompactSection(page: PDFPage, title: string, texts: string[], fonts: CvFonts, x: number, width: number, y: number) {
  if (!texts.length) return y
  let cursor = sectionHeading(page, title, fonts, x, y)
  for (const text of texts) {
    const lines = splitLines(fonts.regular, text, 8.7, width - 10)
    for (let index = 0; index < lines.length; index++) {
      page.drawText(index === 0 ? '•' : '', { x, y: cursor, size: 8.7, font: fonts.bold, color: MUTED })
      page.drawText(lines[index], { x: x + 10, y: cursor, size: 8.7, font: fonts.regular, color: MUTED })
      cursor -= 12
    }
  }
  return cursor - 22
}

export async function createCv(beneficiary: Beneficiary) {
  const profile = beneficiary.documentProfile || {}
  const name = fallback(profile.cvName, fullName(beneficiary))
  const professionalTitle = fallback(profile.cvProfessionalTitle, profile.cvDesiredPosition || profile.careerDesiredWork || '')
  const phone = profile.cvPhone ?? beneficiary.phone ?? ''
  const email = profile.cvEmail ?? beneficiary.email ?? ''
  const address = profile.cvAddress ?? beneficiary.currentAddress ?? beneficiary.address ?? beneficiary.city ?? ''

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const [regularBytes, boldBytes] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf').then(response => response.arrayBuffer()),
    fetch('/fonts/DejaVuSans-Bold.ttf').then(response => response.arrayBuffer()),
  ])
  const fonts: CvFonts = {
    regular: await doc.embedFont(regularBytes, { subset: true }),
    bold: await doc.embedFont(boldBytes, { subset: true }),
  }
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 175, width: PAGE_WIDTH, height: 175, color: HEADER })
  page.drawLine({ start: { x: 0, y: PAGE_HEIGHT - 175 }, end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - 175 }, thickness: 0.7, color: RULE })
  page.drawLine({ start: { x: 228, y: 0 }, end: { x: 228, y: PAGE_HEIGHT - 175 }, thickness: 0.6, color: RULE })

  const photo = await circularPhoto(beneficiary.photoUrl)
  if (photo) {
    const image = await doc.embedPng(photo)
    page.drawImage(image, { x: 52, y: PAGE_HEIGHT - 150, width: 110, height: 110 })
  } else {
    page.drawCircle({ x: 107, y: PAGE_HEIGHT - 95, size: 55, color: rgb(0.86, 0.86, 0.86) })
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('bg-BG')
    const initialsWidth = fonts.bold.widthOfTextAtSize(initials, 23)
    page.drawText(initials, { x: 107 - initialsWidth / 2, y: PAGE_HEIGHT - 103, size: 23, font: fonts.bold, color: INK })
  }

  const nameLines = splitLines(fonts.bold, name, 27, 335)
  let headerY = PAGE_HEIGHT - 78
  for (const line of nameLines.slice(0, 2)) {
    page.drawText(line, { x: 228, y: headerY, size: 27, font: fonts.bold, color: INK })
    headerY -= 31
  }
  if (professionalTitle) {
    for (const line of splitLines(fonts.regular, professionalTitle, 13.5, 325).slice(0, 2)) {
      page.drawText(line, { x: 230, y: headerY - 2, size: 13.5, font: fonts.regular, color: MUTED })
      headerY -= 17
    }
  }

  let leftY = PAGE_HEIGHT - 215
  leftY = sectionHeading(page, 'Контакти:', fonts, 36, leftY)
  const contacts = [phone, email, address].filter(Boolean)
  for (const contact of contacts) {
    const lines = splitLines(fonts.regular, contact, 8.8, 160)
    leftY = drawLines(page, lines, fonts.regular, 8.8, 46, leftY, 12, MUTED)
    leftY -= 3
  }
  leftY -= 16
  const skills = listItems(profile.cvSkills || profile.skills || profile.skillsAndInterests)
  leftY = drawCompactSection(page, 'Умения:', skills, fonts, 36, 175, leftY)

  const education = cvEducation(profile, beneficiary)
  if (education.length) {
    leftY = sectionHeading(page, 'Образование:', fonts, 36, leftY)
    for (const entry of education) {
      const title = entry.institution || entry.qualification || ''
      const qualification = entry.institution ? entry.qualification || '' : ''
      if (title) leftY = drawLines(page, splitLines(fonts.bold, title, 8.4, 175), fonts.bold, 8.4, 36, leftY, 11, INK)
      const dates = dateRange(entry.startDate, entry.endDate)
      if (dates) leftY = drawLines(page, [dates], fonts.bold, 8.2, 36, leftY, 11, INK)
      if (qualification) leftY = drawLines(page, splitLines(fonts.regular, qualification, 8.3, 175), fonts.regular, 8.3, 36, leftY, 11, MUTED)
      leftY -= 12
    }
    leftY -= 8
  }
  const languages = listItems(profile.cvLanguages || profile.otherLanguages || profile.careerOtherLanguages)
  if (languages.length && leftY > 70) drawCompactSection(page, 'Езици:', languages, fonts, 36, 175, leftY)

  const flow: CvFlow = { doc, page, fonts, x: 260, width: 300, y: PAGE_HEIGHT - 215, name }
  if (profile.cvSummary?.trim()) {
    flowHeading(flow, 'За мен:')
    flowText(flow, profile.cvSummary, { size: 9.4, gap: 16 })
  }

  const experiences = cvExperiences(profile, beneficiary)
  if (experiences.length) {
    flowHeading(flow, 'Опит:')
    for (const entry of experiences) {
      const heading = [entry.position, dateRange(entry.startDate, entry.endDate)].filter(Boolean).join(' | ')
      if (heading) flowText(flow, heading, { size: 9.2, bold: true, color: INK, gap: 2 })
      if (entry.company) flowText(flow, entry.company, { size: 9, bold: true, gap: 4 })
      if (entry.description) flowBullets(flow, entry.description)
      flow.y -= 5
    }
  }

  if (profile.cvCourses?.trim()) {
    flowHeading(flow, 'Курсове и обучения:')
    flowBullets(flow, profile.cvCourses)
  }
  if (profile.cvAdditionalInfo?.trim()) {
    flowHeading(flow, 'Допълнителна информация:')
    flowText(flow, profile.cvAdditionalInfo)
  }

  const references = (profile.cvReferences || []).filter(entry => hasValues(entry))
  if (references.length) {
    flowHeading(flow, 'Връзки:')
    for (const entry of references) {
      if (entry.name) flowText(flow, entry.name, { size: 9.2, bold: true, color: INK, gap: 1 })
      if (entry.organization) flowText(flow, entry.organization, { size: 8.7, bold: true, gap: 2 })
      if (entry.phone) flowText(flow, `Телефон: ${entry.phone}`, { size: 8.4, gap: 1 })
      if (entry.email) flowText(flow, `Имейл: ${entry.email}`, { size: 8.4, gap: 8 })
    }
  }

  doc.setTitle(`CV - ${name}`)
  doc.setAuthor('Caritas Admin')
  doc.setCreator('Caritas Admin')
  const bytes = await doc.save()
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buffer], { type: 'application/pdf' })
}

export async function downloadBeneficiaryDocument(kind: BeneficiaryDocumentKind, beneficiary: Beneficiary) {
  const labels: Record<BeneficiaryDocumentKind, string> = {
    'career-card': 'Карта-участие-кариерна-оценка',
    'humanitarian-card': 'Карта-участие-хуманитарна-оценка',
    'individual-plan': 'Индивидуален-план',
    cv: 'Автобиография',
  }
  const blob = kind === 'cv' ? await createCv(beneficiary) : await renderTemplate(kind, beneficiary)
  const extension = kind === 'cv' ? 'pdf' : 'docx'
  downloadBlob(blob, `${labels[kind]}-${safeFilePart(fullName(beneficiary))}.${extension}`)
}
