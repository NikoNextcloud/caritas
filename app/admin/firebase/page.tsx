'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import { ExternalLink, Database, HardDrive, CreditCard, ShieldCheck, Info } from 'lucide-react'

const PROJECT_ID = 'urspuhgjjdhczxuapswz'
const DASHBOARD_URL = `https://supabase.com/dashboard/project/${PROJECT_ID}`

function InfoCard({ icon: Icon, title, value, description }: { icon: React.ElementType; title: string; value: string; description: string }) {
  return (
    <div className="box p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'var(--brand-primary)' }}>
          <Icon size={20} className="text-white" />
        </div>
        <h2 className="font-semibold text-gray-700">{title}</h2>
      </div>
      <p className="text-xl font-bold text-gray-800 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

export default function DatabasePage() {
  return (
    <AdminLayout>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span><span className="text-gray-800 font-medium">Supabase</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-700">Supabase – база данни и план</h1>
          <p className="text-sm text-gray-500 mt-1">Проект: {PROJECT_ID}</p>
        </div>
        <a className="btn-primary inline-flex items-center gap-2" href={DASHBOARD_URL} target="_blank" rel="noreferrer">
          Отвори статистиката <ExternalLink size={15} />
        </a>
      </div>

      <div className="box p-4 mb-6 border-l-4" style={{ borderColor: 'var(--brand-primary)' }}>
        <div className="flex gap-3 items-start">
          <Info size={20} className="mt-0.5" style={{ color: 'var(--brand-primary)' }} />
          <div className="text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-1">Важно за точните стойности</p>
            <p>Оперативните данни вече се съхраняват в Supabase PostgreSQL. Firebase се използва само за вход със съществуващите потребителски акаунти. Точните стойности за използването и лимитите се виждат в официалното Supabase табло.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <InfoCard icon={CreditCard} title="Текущ план" value="Free" description="Провери текущото използване в Supabase" />
        <InfoCard icon={Database} title="PostgreSQL" value="26 131 записа" description="Мигрирани от Firestore и защитени с RLS" />
        <InfoCard icon={HardDrive} title="Storage" value="beneficiary-photos" description="Частно хранилище за снимки" />
        <InfoCard icon={ShieldCheck} title="Authentication" value="Firebase Auth" description="Съществуващите акаунти и пароли се запазват" />
      </div>

      <div className="box">
        <div className="box-header"><span className="box-title">Бързи връзки към Supabase</span></div>
        <div className="box-body flex flex-wrap gap-3">
          <a className="btn-default inline-flex items-center gap-2" href={DASHBOARD_URL} target="_blank" rel="noreferrer">Проект <ExternalLink size={14} /></a>
          <a className="btn-default inline-flex items-center gap-2" href={`${DASHBOARD_URL}/editor`} target="_blank" rel="noreferrer">База данни <ExternalLink size={14} /></a>
          <a className="btn-default inline-flex items-center gap-2" href={`${DASHBOARD_URL}/storage/files`} target="_blank" rel="noreferrer">Storage <ExternalLink size={14} /></a>
          <a className="btn-default inline-flex items-center gap-2" href={`${DASHBOARD_URL}/auth/users`} target="_blank" rel="noreferrer">Authentication <ExternalLink size={14} /></a>
        </div>
      </div>
    </AdminLayout>
  )
}
