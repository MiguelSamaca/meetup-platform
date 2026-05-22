'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-lg transition-colors"
    >
      🖨️ Imprimir / PDF
    </button>
  )
}
