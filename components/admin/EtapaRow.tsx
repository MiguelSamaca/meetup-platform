'use client'

import { useState } from 'react'
import { actualizarEtapa } from '@/app/actions/proyectos'
import { subirEvidencia, eliminarEvidencia } from '@/app/actions/evidencias'
import type { Etapa, Evidencia } from '@/lib/types'
import { ESTADO_ETAPA_LABEL } from '@/lib/constants'

const estadoColor: Record<string, string> = {
  pendiente:   'bg-gray-100 text-gray-600',
  en_progreso: 'bg-blue-100 text-blue-700',
  completado:  'bg-emerald-100 text-emerald-700',
  aprobado:    'bg-purple-100 text-purple-700',
}

function fileIcon(tipo: string | null): string {
  if (!tipo) return '📎'
  if (tipo.startsWith('image/')) return '🖼️'
  if (tipo === 'application/pdf') return '📄'
  if (tipo.startsWith('video/')) return '🎥'
  return '📎'
}

export default function EtapaRow({
  etapa,
  proyectoId,
  evidencias = [],
}: {
  etapa: Etapa
  proyectoId: string
  evidencias?: Evidencia[]
}) {
  const [open, setOpen]           = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [uploadKey, setUploadKey] = useState(0)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    await actualizarEtapa(etapa.id, proyectoId, formData)
    setSaving(false)
    setOpen(false)
  }

  async function handleUpload(formData: FormData) {
    setUploading(true)
    try {
      await subirEvidencia(etapa.id, proyectoId, formData)
      setUploadKey(k => k + 1)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(evidenciaId: string, storagePath: string | null) {
    if (!window.confirm('¿Eliminar esta evidencia?')) return
    setDeleting(evidenciaId)
    try {
      await eliminarEvidencia(evidenciaId, storagePath ?? '', proyectoId)
    } finally {
      setDeleting(null)
    }
  }

  const pendienteAprobacion = etapa.requiere_aprobacion_cliente && etapa.estado === 'completado'

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
        {evidencias.length > 0 && (
          <span className="text-xs text-gray-400">
            {evidencias.length} archivo{evidencias.length !== 1 ? 's' : ''}
          </span>
        )}
        {pendienteAprobacion ? (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            ⏳ Esperando aprobación
          </span>
        ) : etapa.requiere_aprobacion_cliente ? (
          <span className="text-xs text-amber-600 font-medium">★ Aprobación cliente</span>
        ) : null}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[etapa.estado]}`}>
          {ESTADO_ETAPA_LABEL[etapa.estado]}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-3 bg-gray-50 border-t border-gray-100">
          {/* Etapa update form */}
          <form action={handleSubmit} className="space-y-4">
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

          {/* Evidencias section */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Evidencias</p>

            {evidencias.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {evidencias.map(ev => (
                  <li key={ev.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-base leading-none">{fileIcon(ev.tipo)}</span>
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-gray-700 hover:text-emerald-600 hover:underline truncate"
                    >
                      {ev.nombre}
                    </a>
                    <button
                      type="button"
                      disabled={deleting === ev.id}
                      onClick={() => handleDelete(ev.id, ev.storage_path)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none disabled:opacity-40 shrink-0"
                      title="Eliminar evidencia"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 mb-3">Sin evidencias subidas.</p>
            )}

            <form key={uploadKey} action={handleUpload} className="flex gap-2 items-center">
              <input
                name="archivo"
                type="file"
                required
                className="flex-1 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
              />
              <button
                type="submit"
                disabled={uploading}
                className="bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {uploading ? 'Subiendo…' : 'Subir archivo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </li>
  )
}
