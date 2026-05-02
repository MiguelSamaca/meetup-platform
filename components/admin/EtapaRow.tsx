'use client'

import { useState } from 'react'
import { actualizarEtapa } from '@/app/actions/proyectos'
import type { Etapa } from '@/lib/types'
import { ESTADO_ETAPA_LABEL } from '@/lib/constants'

const estadoColor: Record<string, string> = {
  pendiente:   'bg-gray-100 text-gray-600',
  en_progreso: 'bg-blue-100 text-blue-700',
  completado:  'bg-emerald-100 text-emerald-700',
  aprobado:    'bg-purple-100 text-purple-700',
}

export default function EtapaRow({ etapa, proyectoId }: { etapa: Etapa; proyectoId: string }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    await actualizarEtapa(etapa.id, proyectoId, formData)
    setSaving(false)
    setOpen(false)
  }

  return (
    <li className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
          {etapa.orden}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-800">{etapa.nombre}</span>
        {etapa.requiere_aprobacion_cliente && (
          <span className="text-xs text-amber-600 font-medium">★ Aprobación cliente</span>
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[etapa.estado]}`}>
          {ESTADO_ETAPA_LABEL[etapa.estado]}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form action={handleSubmit} className="px-5 pb-5 pt-1 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select
                name="estado"
                defaultValue={etapa.estado}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completado">Completado</option>
                <option value="aprobado">Aprobado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
              <input
                name="fecha_inicio"
                type="date"
                defaultValue={etapa.fecha_inicio ?? ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
              <input
                name="fecha_fin"
                type="date"
                defaultValue={etapa.fecha_fin ?? ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
            <textarea
              name="notas"
              defaultValue={etapa.notas ?? ''}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Observaciones, materiales, pendientes..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  )
}
