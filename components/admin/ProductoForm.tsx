'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import FotoUploader from '@/components/admin/FotoUploader'

interface DefaultValues {
  descripcion: string
  unidad:      string
  referencia:  string
  proveedor:   string
  foto_url:    string
  activo?:     boolean
}

interface Props {
  /** Server Action que recibe FormData */
  action:        (formData: FormData) => Promise<void>
  defaultValues?: Partial<DefaultValues>
  /** 'nuevo' | 'editar' */
  mode?:         'nuevo' | 'editar'
}

const UNIDADES = ['und', 'm', 'm2', 'kg', 'gl', 'hr', 'kit']

export default function ProductoForm({ action, defaultValues = {}, mode = 'nuevo' }: Props) {
  const [fotoUrl, setFotoUrl] = useState(defaultValues.foto_url ?? '')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Inyectar foto_url (el FotoUploader no está dentro del <form> DOM, lo pasamos a mano)
    fd.set('foto_url', fotoUrl)
    startTransition(() => action(fd))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Foto del producto</label>
        <FotoUploader
          size="lg"
          value={fotoUrl}
          onChange={setFotoUrl}
        />
        <p className="mt-1.5 text-xs text-gray-400">
          Click para subir · arrastra la imagen · o copia y pega con <kbd className="bg-gray-100 border border-gray-200 rounded px-1 py-0.5 font-mono">Ctrl+V</kbd>
        </p>
      </div>

      {/* Descripción + Unidad */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
          <textarea
            name="descripcion"
            required
            rows={3}
            defaultValue={defaultValues.descripcion ?? ''}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="Nombre del producto"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
          <select
            name="unidad"
            defaultValue={defaultValues.unidad ?? 'und'}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Referencia + Proveedor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / SKU</label>
          <input
            name="referencia"
            defaultValue={defaultValues.referencia ?? ''}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="SKU-001 (opcional)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor / Marca</label>
          <input
            name="proveedor"
            defaultValue={defaultValues.proveedor ?? ''}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="McIntosh, Samsung… (opcional)"
          />
        </div>
      </div>

      {/* Estado — solo en modo editar */}
      {mode === 'editar' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            name="activo"
            defaultValue={defaultValues.activo !== false ? 'true' : 'false'}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      )}

      <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
        El costo y precio se ingresan en cada cotización para reflejar valores actualizados.
      </p>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {pending ? 'Guardando…' : mode === 'editar' ? 'Guardar cambios' : 'Guardar producto'}
        </button>
        <Link
          href="/admin/productos"
          className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
