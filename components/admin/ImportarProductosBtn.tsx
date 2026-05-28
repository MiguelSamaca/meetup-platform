'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ImportarProductosModal = dynamic(
  () => import('@/components/admin/ImportarProductosModal'),
  { ssr: false }
)

export default function ImportarProductosBtn() {
  const [open, setOpen] = useState(false)
  const router          = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <span>📊</span> Importar Excel
      </button>

      {open && (
        <ImportarProductosModal
          onClose={() => setOpen(false)}
          onImportado={n => {
            if (n > 0) router.refresh()
          }}
        />
      )}
    </>
  )
}
