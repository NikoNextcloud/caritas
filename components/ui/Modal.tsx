'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm:  'max-w-sm',
  md:  'max-w-lg',
  lg:  'max-w-2xl',
  xl:  'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className={`relative bg-white rounded shadow-xl w-full ${sizes[size]} flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0"
          style={{ background: '#3c8dbc' }}>
          <h3 className="text-white font-semibold text-base">{title}</h3>
          <button onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
