'use client'

interface FilaExport {
  proyecto:   string
  estado:     string
  ingreso:    number
  costoEquipos: number
  gastos:     number
  margenBruto: number
  pctMargen:  number | null
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ExportarRentabilidad({ filas }: { filas: FilaExport[] }) {
  function descargar() {
    const headers = ['Proyecto','Estado','Ingreso venta','Costo equipos','Gastos adicionales','Margen bruto','% Margen']
    const rows = filas.map(f => [
      `"${f.proyecto.replace(/"/g, '""')}"`,
      f.estado,
      f.ingreso,
      f.costoEquipos,
      f.gastos,
      f.margenBruto,
      f.pctMargen !== null ? `${f.pctMargen.toFixed(1)}%` : 'N/A',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `rentabilidad_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={descargar}
      className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      ⬇ Exportar CSV
    </button>
  )
}
