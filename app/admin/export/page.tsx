'use client'
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getExportData } from '@/lib/db'
import { exportToCSV } from '@/lib/export'
import { Download, FileText } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function ExportPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const data = await getExportData(dateFrom || undefined, dateTo || undefined)
      if (data.length === 0) { toast.error('Няма данни за експорт'); setLoading(false); return }
      exportToCSV(data, `caritas_export_${new Date().toISOString().split('T')[0]}`)
      toast.success(`Експортирани ${data.length} записа`)
    } catch { toast.error('Грешка при експорт') }
    setLoading(false)
  }

  return (
    <AdminLayout>
      <Toaster position="top-right" />
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>Начало</span><span>/</span>
        <span className="text-gray-800 font-medium">Export</span>
      </div>

      <div className="max-w-xl">
        <div className="box">
          <div className="box-header">
            <span className="box-title flex items-center gap-2">
              <FileText size={18} /> Export на данни
            </span>
          </div>
          <div className="box-body space-y-4">
            <p className="text-sm text-gray-600">
              Изтеглете данните от заявките за дейности като CSV файл.
              Файлът поддържа кирилица (UTF-8 BOM).
            </p>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600">
              <p className="font-medium mb-1">Файлът ще съдържа колони:</p>
              <p className="text-xs text-gray-500">
                ID · Дейност · Съобщение · Case 1–6 · Статус · Бенефициент · Дата
              </p>
            </div>

            <button onClick={handleExport} disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Генериране...</span>
                : <><Download size={16} /> Изтегли CSV</>
              }
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
