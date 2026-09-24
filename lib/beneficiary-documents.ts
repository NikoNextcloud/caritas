'use client'

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { Beneficiary, BeneficiaryDocumentProfile, FamilyMember } from '@/types'

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

function sectionTitle(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, bold: true, color: '000000', size: 24 })],
  })
}

function contentParagraph(text: string) {
  return new Paragraph({
    spacing: { after: 100, line: 280 },
    children: [new TextRun({ text, size: 22, color: '222222' })],
  })
}

function labeledParagraph(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, color: '222222' }),
      new TextRun({ text: value, size: 22, color: '222222' }),
    ],
  })
}

async function createCv(beneficiary: Beneficiary) {
  const profile = beneficiary.documentProfile || {}
  const name = fullName(beneficiary)
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: name, bold: true, size: 34, color: '000000' })],
    }),
  ]
  if (profile.cvProfessionalTitle || profile.cvDesiredPosition) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({ text: profile.cvProfessionalTitle || profile.cvDesiredPosition || '', size: 24, color: '666666' })],
    }))
  }

  const contactRows = [
    ['Телефон', beneficiary.phone || ''], ['Имейл', beneficiary.email || ''],
    ['Град', beneficiary.city || ''], ['Адрес', beneficiary.currentAddress || beneficiary.address || ''],
  ].filter(([, value]) => value)
  if (contactRows.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: contactRows.map(([label, value]) => new TableRow({ children: [
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: cvBorders(), children: [labeledParagraph(label, '')] }),
        new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: cvBorders(), children: [contentParagraph(value)] }),
      ] })),
    }))
  }

  const sections: Array<[string, string]> = [
    ['Професионален профил', profile.cvSummary || ''],
    ['Желана позиция', profile.cvDesiredPosition || profile.careerDesiredWork || ''],
    ['Трудов опит', profile.cvWorkExperience || beneficiary.workExperience || beneficiary.experience || ''],
    ['Образование и квалификация', profile.cvEducation || beneficiary.education || ''],
    ['Умения', profile.cvSkills || profile.skills || profile.skillsAndInterests || ''],
    ['Езици', profile.cvLanguages || profile.otherLanguages || profile.careerOtherLanguages || ''],
    ['Курсове и обучения', profile.cvCourses || ''],
    ['Допълнителна информация', profile.cvAdditionalInfo || ''],
  ]
  for (const [title, value] of sections) {
    if (!value.trim()) continue
    children.push(sectionTitle(title), contentParagraph(value))
  }

  const cv = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 280 } } } },
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children,
    }],
  })
  return Packer.toBlob(cv)
}

function cvBorders() {
  const edge = { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' }
  return { top: edge, bottom: edge, left: edge, right: edge }
}

export async function downloadBeneficiaryDocument(kind: BeneficiaryDocumentKind, beneficiary: Beneficiary) {
  const labels: Record<BeneficiaryDocumentKind, string> = {
    'career-card': 'Карта-участие-кариерна-оценка',
    'humanitarian-card': 'Карта-участие-хуманитарна-оценка',
    'individual-plan': 'Индивидуален-план',
    cv: 'Автобиография',
  }
  const blob = kind === 'cv' ? await createCv(beneficiary) : await renderTemplate(kind, beneficiary)
  downloadBlob(blob, `${labels[kind]}-${safeFilePart(fullName(beneficiary))}.docx`)
}
