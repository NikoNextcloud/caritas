'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  width?: string
}

interface Props<T extends { id: string }> {
  columns: Column<T>[]
  data: T[]
  perPage?: number
  onEdit?: (row: T) => void
  onDelete?: (ids: string[]) => void
  selectable?: boolean
  loading?: boolean
}

export default function DataTable<T extends { id: string }>({
  columns, data, perPage = 20, onEdit, onDelete, selectable = true, loading = false
}: Props<T>) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalPages = Math.ceil(data.length / perPage)
  const start = (page - 1) * perPage
  const pageData = data.slice(start, start + perPage)

  function toggleAll() {
    if (selected.size === pageData.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pageData.map(r => r.id)))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function handleDeleteSelected() {
    if (selected.size === 0) return
    if (confirm(`Изтриване на ${selected.size} записа?`)) {
      onDelete?.(Array.from(selected))
      setSelected(new Set())
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-[#3c8dbc] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Bulk actions */}
      {selectable && selected.size > 0 && onDelete && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <span className="text-sm text-blue-700 font-medium">
            Избрани: {selected.size}
          </span>
          <button onClick={handleDeleteSelected} className="btn-danger btn-sm">
            Изтрий избраните
          </button>
          <button onClick={() => setSelected(new Set())}
            className="btn-default btn-sm text-xs">
            Откажи
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: '#f4f4f4' }} className="border-b border-gray-200">
              {selectable && (
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox"
                    checked={pageData.length > 0 && selected.size === pageData.length}
                    onChange={toggleAll}
                    className="cursor-pointer" />
                </th>
              )}
              {onEdit && <th className="px-2 py-3 w-8"></th>}
              {columns.map(col => (
                <th key={col.key}
                  className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                  style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (onEdit ? 1 : 0)}
                  className="text-center py-10 text-gray-400">
                  Няма записи
                </td>
              </tr>
            ) : pageData.map((row, idx) => (
              <tr key={row.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors
                  ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}
                  ${selected.has(row.id) ? '!bg-blue-50' : ''}`}>
                {selectable && (
                  <td className="px-3 py-2">
                    <input type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="cursor-pointer" />
                  </td>
                )}
                {onEdit && (
                  <td className="px-2 py-2">
                    <button onClick={() => onEdit(row)}
                      className="text-[#3c8dbc] hover:text-[#367fa9] transition-colors p-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2 text-gray-700">
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">
            Показване {start + 1}–{Math.min(start + perPage, data.length)} от {data.length} записа
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronsLeft size={16} />
            </button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors
                    ${page === pageNum
                      ? 'bg-[#3c8dbc] text-white'
                      : 'hover:bg-gray-100 text-gray-600'}`}>
                  {pageNum}
                </button>
              )
            })}

            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
