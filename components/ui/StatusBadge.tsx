import type { RequestStatus } from '@/types'

const config: Record<RequestStatus, { label: string; cls: string }> = {
  'Потвърдено': { label: 'Потвърдено', cls: 'label-success' },
  'Отхвърлено': { label: 'Отхвърлено', cls: 'label-danger' },
  'Чакащ':      { label: 'Чакащ',      cls: 'label-warning' },
  'Приключен':  { label: 'Приключен',  cls: 'label-info' },
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, cls } = config[status] ?? { label: status, cls: 'label-default' }
  return <span className={cls}>{label}</span>
}
