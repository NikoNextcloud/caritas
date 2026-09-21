import type { BeneficiaryRequest } from '@/types'

// ---- CSV Export ----
export function exportToCSV(data: BeneficiaryRequest[], filename = 'export') {
  const headers = [
    'ID', 'Дейност', 'Съобщение', 'Case 1', 'Case 2', 'Case 3',
    'Case 4', 'Case 5', 'Case 6', 'Статус', 'Бенефициент', 'Дата'
  ]

  const rows = data.map(r => [
    r.id,
    r.activity,
    r.message,
    formatCase(r.case1),
    formatCase(r.case2),
    formatCase(r.case3),
    formatCase(r.case4),
    formatCase(r.case5),
    formatCase(r.case6),
    r.status,
    r.beneficiaryName,
    r.createdAt.split('T')[0],
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  downloadFile(`${filename}.csv`, csvContent, 'text/csv;charset=utf-8;')
}

// ---- EPAY Export (специфичен формат) ----
export function exportToEPAY(data: BeneficiaryRequest[], filename = 'epay_export') {
  const lines = [
    'MIN=0000000000',
    'EMAIL=caritas@example.com',
    '',
    ...data.map((r, i) =>
      `INVOICE=${String(i + 1).padStart(10, '0')}\nAMOUNT=0.00\nEXP_TIME=20301231\nDESCR=${r.beneficiaryName} - ${r.activity}`
    )
  ]
  downloadFile(`${filename}.txt`, lines.join('\n'), 'text/plain;charset=utf-8;')
}

// ---- Helpers ----
function formatCase(c: { date?: string; operator?: string; description?: string } | undefined): string {
  if (!c) return ''
  return [c.date, c.operator, c.description].filter(Boolean).join(' - ')
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }) // BOM за кирилица
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
