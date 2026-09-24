'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import { getBeneficiary, updateBeneficiary } from '@/lib/db'
import { downloadBeneficiaryDocument, type BeneficiaryDocumentKind } from '@/lib/beneficiary-documents'
import type { Beneficiary, BeneficiaryDocumentProfile, FamilyMember } from '@/types'
import { ArrowLeft, Download, FileText, Save, UserRound } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

type ProfileKey = keyof BeneficiaryDocumentProfile
type TabKey = 'registration' | 'career' | 'humanitarian' | 'plan'

const TAB_LABELS: Record<TabKey, string> = {
  registration: 'Регистрация и семейство',
  career: 'Кариерна оценка',
  humanitarian: 'Хуманитарна оценка',
  plan: 'Индивидуален план и CV',
}

const CAREER_FIELDS: Array<[ProfileKey, string]> = [
  ['careerLivingSituation', 'Жилищна ситуация и условия'],
  ['careerDependants', 'Отговорности към други хора и деца'],
  ['careerPhysicalLimitations', 'Ограничения за физически труд'],
  ['careerDrivingLicence', 'Шофьорска книжка и категории'],
  ['careerTravelReadiness', 'Готовност за пътуване до работа'],
  ['careerCityOrientation', 'Ориентация в града и работа с карти'],
  ['careerLabourLawKnowledge', 'Познания за трудов договор и работна среда'],
  ['careerEmployerMeeting', 'Самостоятелност при среща с работодател'],
  ['careerComputerSkills', 'Компютърни умения'],
  ['careerBulgarianLevel', 'Ниво по български език'],
  ['careerWantsBulgarian', 'Желание за изучаване на български'],
  ['careerOtherLanguages', 'Други езици и ниво'],
  ['careerHobbies', 'Хобита и приложими професионални интереси'],
  ['careerEducation', 'Образование и професионална квалификация'],
  ['careerQualificationNeeds', 'Нужда от допълнителна квалификация'],
  ['careerDesiredWork', 'Желана работа и сфера'],
  ['careerDesiredSalary', 'Желано възнаграждение'],
  ['careerJobPriorities', 'Водещи критерии при избор на работа'],
  ['careerAvailability', 'Работно време, дни, график и смени'],
  ['careerDecisionTime', 'Необходимо време за решение'],
  ['careerExperienceAbroad', 'Трудов опит извън България'],
  ['careerExperienceBulgaria', 'Трудов опит в България'],
  ['careerAdditionalInfo', 'Допълнителна информация по случая'],
]

const HUMANITARIAN_FIELDS: Array<[ProfileKey, string]> = [
  ['humanitarianFamilySituation', 'Семейно положение и съжителство'],
  ['humanitarianSocialGroup', 'Социална група'],
  ['humanitarianHealthStatus', 'Здравословно състояние'],
  ['humanitarianIncomeSources', 'Източници на доход'],
  ['humanitarianDiseaseDescription', 'Описание на заболяване'],
  ['humanitarianLivingConditions', 'Условия за живеене'],
  ['humanitarianCaseInfo', 'Информация по случая и жизнена ситуация'],
]

const PLAN_FIELDS: Array<[ProfileKey, string]> = [
  ['caseWorker', 'Водещ на случая / социален работник'],
  ['planDate', 'Дата на плана'],
  ['translationLanguage', 'Език на осигурения превод'],
  ['translator', 'Преводач'],
  ['bulgarianLevel', 'Български език'],
  ['otherLanguages', 'Други езици'],
  ['careerOrientation', 'Кариерна ориентация'],
  ['skillsAndInterests', 'Умения, интереси и занаят'],
  ['computerSkills', 'Компютърни умения'],
  ['healthStatus', 'Здравен статус'],
  ['environmentOrientation', 'Ориентация в средата'],
  ['socialContacts', 'Социални контакти'],
  ['emotionalHealth', 'Емоционално здраве'],
  ['longTermGoal', 'Дългосрочна цел'],
  ['strengths', 'Силни страни'],
  ['skills', 'Умения'],
  ['barriers', 'Бариери и предизвикателства'],
  ['previousExperience', 'Предишен професионален опит'],
  ['serviceProvider', 'Предоставящ услугата'],
  ['planDeadline', 'Срок за изпълнение'],
  ['cvProfessionalTitle', 'CV — професионално заглавие'],
  ['cvSummary', 'CV — професионален профил'],
  ['cvDesiredPosition', 'CV — желана позиция'],
  ['cvSkills', 'CV — ключови умения'],
  ['cvLanguages', 'CV — езици'],
  ['cvEducation', 'CV — образование и квалификация'],
  ['cvWorkExperience', 'CV — трудов опит'],
  ['cvCourses', 'CV — курсове и обучения'],
  ['cvAdditionalInfo', 'CV — допълнителна информация'],
]

function fullName(beneficiary: Beneficiary) {
  return [beneficiary.firstName, beneficiary.middleName, beneficiary.lastName].filter(Boolean).join(' ')
}

export default function BeneficiaryDocumentsPage() {
  const params = useParams<{ id: string }>()
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [profile, setProfile] = useState<BeneficiaryDocumentProfile>({})
  const [tab, setTab] = useState<TabKey>('registration')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<BeneficiaryDocumentKind | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const result = await getBeneficiary(decodeURIComponent(params.id))
        if (!result) throw new Error('Бенефициентът не е намерен')
        setBeneficiary(result)
        setProfile({
          registrationDate: result.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          interviewer: result.assignedToName || result.mentor || '',
          registrationPlace: 'Хуманитарно-консултативен център Пловдив',
          requestedSupport: result.requestedHelp || '',
          socialStatuses: result.vulnerability || '',
          residenceStatus: result.status || '',
          careerEducation: result.education || '',
          humanitarianFamilySituation: result.familyStatus || '',
          humanitarianCaseInfo: result.caseDescription || result.notes || '',
          caseWorker: result.assignedToName || result.mentor || '',
          planDate: new Date().toISOString().slice(0, 10),
          longTermGoal: 'Осигуряване на трудова заетост',
          serviceProvider: 'Каритас Витания',
          cvEducation: result.education || '',
          cvWorkExperience: result.workExperience || result.experience || '',
          ...result.documentProfile,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Грешка при зареждане')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id])

  const mergedBeneficiary = useMemo(() => beneficiary ? { ...beneficiary, documentProfile: profile } : null, [beneficiary, profile])

  function setField(key: ProfileKey, value: string) {
    setProfile(current => ({ ...current, [key]: value }))
  }

  function familyMembers() {
    return Array.from({ length: 5 }, (_, index) => profile.familyMembers?.[index] || {})
  }

  function setFamilyMember(index: number, key: keyof FamilyMember, value: string) {
    const members = familyMembers()
    members[index] = { ...members[index], [key]: value }
    setProfile(current => ({ ...current, familyMembers: members }))
  }

  async function save() {
    if (!beneficiary) return
    setSaving(true)
    try {
      await updateBeneficiary(beneficiary.id, { documentProfile: profile })
      setBeneficiary(current => current ? { ...current, documentProfile: profile } : current)
      toast.success('Данните за документите са записани')
    } catch {
      toast.error('Данните не могат да бъдат записани')
    } finally {
      setSaving(false)
    }
  }

  async function generate(kind: BeneficiaryDocumentKind) {
    if (!mergedBeneficiary) return
    setGenerating(kind)
    try {
      await updateBeneficiary(mergedBeneficiary.id, { documentProfile: profile })
      await downloadBeneficiaryDocument(kind, mergedBeneficiary)
      toast.success('Документът е генериран с актуалните данни')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Документът не може да бъде генериран')
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <AdminLayout><div className="flex justify-center py-20"><div className="primary-spinner animate-spin w-9 h-9 border-4 rounded-full" /></div></AdminLayout>
  if (!beneficiary) return <AdminLayout><div className="box p-8">Бенефициентът не е намерен.</div></AdminLayout>

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/beneficiaries" className="hover:text-gray-800">Бенефициенти</Link><span>/</span>
        <span className="text-gray-800 font-medium">Документи и оценка</span>
      </div>

      <div className="box mb-4">
        <div className="box-header flex-wrap gap-3">
          <div>
            <span className="box-title flex items-center gap-2"><UserRound size={18} /> {fullName(beneficiary)}</span>
            <p className="text-xs text-gray-500 mt-1">ID {beneficiary.externalId || beneficiary.id} · Общите данни се попълват автоматично във всички документи.</p>
          </div>
          <Link href="/admin/beneficiaries" className="btn-default"><ArrowLeft size={16} /> Назад</Link>
        </div>
        <div className="box-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <DocumentButton label="Кариерна карта" active={generating === 'career-card'} onClick={() => generate('career-card')} />
            <DocumentButton label="Хуманитарна карта" active={generating === 'humanitarian-card'} onClick={() => generate('humanitarian-card')} />
            <DocumentButton label="Индивидуален план" active={generating === 'individual-plan'} onClick={() => generate('individual-plan')} />
            <DocumentButton label="Автобиография" active={generating === 'cv'} onClick={() => generate('cv')} />
          </div>
          <p className="text-xs text-gray-500 mt-3">Системата използва само записаните данни. Непопълнените специфични полета остават празни — не се добавя информация по предположение.</p>
        </div>
      </div>

      <div className="box">
        <div className="border-b border-gray-200 px-4 pt-3 flex flex-wrap gap-1">
          {(Object.keys(TAB_LABELS) as TabKey[]).map(key => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t border-b-2 ${tab === key ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-red-50/40' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="box-body">
          {tab === 'registration' && <RegistrationForm beneficiary={beneficiary} profile={profile} setField={setField} setFamilyMember={setFamilyMember} members={familyMembers()} />}
          {tab === 'career' && <FieldGrid fields={CAREER_FIELDS} profile={profile} setField={setField} />}
          {tab === 'humanitarian' && <FieldGrid fields={HUMANITARIAN_FIELDS} profile={profile} setField={setField} />}
          {tab === 'plan' && <FieldGrid fields={PLAN_FIELDS} profile={profile} setField={setField} />}
          <div className="flex justify-end border-t border-gray-200 mt-5 pt-4">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Запис...' : 'Запази данните'}</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function DocumentButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return <button type="button" className="btn-default justify-center py-3" disabled={active} onClick={onClick}>
    {active ? <FileText size={17} className="animate-pulse" /> : <Download size={17} />} {active ? 'Генериране...' : label}
  </button>
}

function FieldGrid({ fields, profile, setField }: { fields: Array<[ProfileKey, string]>, profile: BeneficiaryDocumentProfile, setField: (key: ProfileKey, value: string) => void }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {fields.map(([key, label]) => <div key={key} className="form-group">
      <label className="form-label">{label}</label>
      <textarea className="form-control resize-y min-h-20" rows={3} value={String(profile[key] || '')} onChange={event => setField(key, event.target.value)} />
    </div>)}
  </div>
}

function RegistrationForm({ beneficiary, profile, setField, setFamilyMember, members }: {
  beneficiary: Beneficiary
  profile: BeneficiaryDocumentProfile
  setField: (key: ProfileKey, value: string) => void
  setFamilyMember: (index: number, key: keyof FamilyMember, value: string) => void
  members: FamilyMember[]
}) {
  return <div className="space-y-6">
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Автоматично попълвани основни данни</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
        <Info label="Име" value={fullName(beneficiary)} />
        <Info label="ЕГН / ЛНЧ" value={beneficiary.egn} />
        <Info label="Дата на раждане" value={beneficiary.birthDate} />
        <Info label="Държава" value={beneficiary.country} />
        <Info label="Статут" value={beneficiary.status} />
        <Info label="Телефон" value={beneficiary.phone} />
        <Info label="Имейл" value={beneficiary.email} />
        <Info label="Образование" value={beneficiary.education} />
      </div>
      <p className="text-xs text-gray-500 mt-3">Тези стойности се редактират от основния профил на бенефициента.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Дата на регистрация" type="date" value={profile.registrationDate} onChange={value => setField('registrationDate', value)} />
      <Field label="Интервюиращ / регистриращ" value={profile.interviewer} onChange={value => setField('interviewer', value)} />
      <Field label="Място на регистрация" value={profile.registrationPlace} onChange={value => setField('registrationPlace', value)} />
      <Field label="Обобщение за домакинството" value={profile.householdSummary} onChange={value => setField('householdSummary', value)} />
      <div className="form-group md:col-span-2"><label className="form-label">Търсена подкрепа и приоритети</label><textarea rows={3} className="form-control" value={profile.requestedSupport || ''} onChange={event => setField('requestedSupport', event.target.value)} /></div>
      <div className="form-group"><label className="form-label">Социални статуси</label><textarea rows={2} className="form-control" placeholder="Напр. безработен, самотен родител" value={profile.socialStatuses || ''} onChange={event => setField('socialStatuses', event.target.value)} /></div>
      <div className="form-group"><label className="form-label">Гражданство / статут на пребиваване</label><textarea rows={2} className="form-control" value={profile.residenceStatus || ''} onChange={event => setField('residenceStatus', event.target.value)} /></div>
      <div className="form-group"><label className="form-label">Профилиране по социална услуга</label><textarea rows={2} className="form-control" value={profile.socialServices || ''} onChange={event => setField('socialServices', event.target.value)} /></div>
      <div className="form-group"><label className="form-label">Профилиране по социална дейност</label><textarea rows={2} className="form-control" value={profile.socialActivities || ''} onChange={event => setField('socialActivities', event.target.value)} /></div>
    </div>

    <div>
      <h3 className="font-semibold text-gray-900 mb-3">Членове на домакинството</h3>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-100 text-gray-800"><tr><th className="p-2 text-left w-10">№</th><th className="p-2 text-left">Имена</th><th className="p-2 text-left">Пол</th><th className="p-2 text-left">Дата на раждане / ЕГН / ЛНЧ</th><th className="p-2 text-left">Връзка</th></tr></thead>
          <tbody>{members.map((member, index) => <tr key={index} className="border-t border-gray-200 bg-white">
            <td className="p-2 font-medium">{index + 1}</td>
            <td className="p-2"><input className="form-control" value={member.name || ''} onChange={event => setFamilyMember(index, 'name', event.target.value)} /></td>
            <td className="p-2"><input className="form-control" value={member.gender || ''} onChange={event => setFamilyMember(index, 'gender', event.target.value)} /></td>
            <td className="p-2"><input className="form-control" value={member.birthDateOrId || ''} onChange={event => setFamilyMember(index, 'birthDateOrId', event.target.value)} /></td>
            <td className="p-2"><input className="form-control" value={member.relation || ''} onChange={event => setFamilyMember(index, 'relation', event.target.value)} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string, value?: string, onChange: (value: string) => void, type?: string }) {
  return <div className="form-group"><label className="form-label">{label}</label><input type={type} className="form-control" value={value || ''} onChange={event => onChange(event.target.value)} /></div>
}

function Info({ label, value }: { label: string, value?: string }) {
  return <div><span className="block text-xs text-gray-500">{label}</span><span className="font-medium text-gray-900">{value || '—'}</span></div>
}
