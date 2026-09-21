'use client'
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getExportData } from '@/lib/db'
import { exportToEPAY } from '@/lib/export'
import { CreditCard, Download } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function ExportEpayPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [minEmail, setMinEmail] = useState('')
  const [minCode, setMinCode]   = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const data = await getExportData(dateFrom || undefined, dateTo || undefined)
      if (data.length === 0) { toast.error('Няма данни за експорт'); setLoading(false); return }
      exportToEPAY(data, `epay_${new Date().toISOString().split('T')[0]}`)
      toast.success(`EPAY файлът е генериран — ${data.length} записа`)
    } catch { toast.error('Грешка при генериране') }
    setLoading(false)
  }

  return (
    <AdminLayout userName="Никол Траянова">
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Export EPAY</span>
      </div>

      <div className="max-w-xl">
        <div className="box">
          <div className="box-header">
            <span className="box-title flex items-center gap-2">
              <CreditCard size={18} /> Export EPAY
            </span>
          </div>
          <div className="box-body space-y-4">
            <p className="text-sm text-gray-600">
              Генерира файл в EPAY формат за масово плащане.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">MIN (код на търговец)</label>
                <input type="text" className="form-control" placeholder="0000000000"
                  value={minCode} onChange={e => setMinCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Имейл на търговец</label>
                <input type="email" className="form-control" placeholder="epay@example.com"
                  value={minEmail} onChange={e => setMinEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">От дата</label>
                <input type="date" className="form-control"
                  value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">До дата</label>
                <input type="date" className="form-control"
                  value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              <strong>Формат:</strong> Стандартен EPAY.bg файл за масово плащане.<br/>
              Полетата INVOICE, AMOUNT, EXP_TIME и DESCR се попълват автоматично.
            </div>

            <button onClick={handleExport} disabled={loading} className="btn-warning w-full justify-center py-3">
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Генериране...</span>
                : <><Download size={16} /> Генерирай EPAY файл</>
              }
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
