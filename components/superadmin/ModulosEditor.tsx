'use client'

import { useState, useTransition } from 'react'
import { actualizarModulosTenant } from '@/app/actions/superadmin'

const MODULOS_CATALOGO = [
  {
    grupo: 'Clientes',
    items: [
      { key: 'empresas',   label: 'Empresas',        desc: 'Gestión de empresas clientes' },
      { key: 'contactos',  label: 'Contactos',        desc: 'Gestión de contactos y personas' },
      { key: 'clientes',   label: 'Portal de clientes', desc: 'Usuarios con acceso al portal cliente' },
    ],
  },
  {
    grupo: 'Venta',
    items: [
      { key: 'cotizaciones', label: 'Cotizaciones',       desc: 'Creación y gestión de cotizaciones' },
      { key: 'ordenes',      label: 'Órdenes de ejecución', desc: 'Órdenes de compra a proveedores' },
      { key: 'proyectos',    label: 'Proyectos',           desc: 'Gestión de proyectos de instalación' },
      { key: 'productos',    label: 'Catálogo de productos', desc: 'Catálogo reutilizable de equipos' },
    ],
  },
  {
    grupo: 'Post-venta',
    items: [
      { key: 'tickets', label: 'Tickets de soporte', desc: 'Sistema de soporte y seguimiento' },
    ],
  },
  {
    grupo: 'Finanzas',
    items: [
      { key: 'finanzas', label: 'Módulo financiero', desc: 'Dashboard, cobrar, pagar, rentabilidad y flujo de caja' },
    ],
  },
]

interface Props {
  tenantId:        string
  modulosActivos:  string[]
}

export default function ModulosEditor({ tenantId, modulosActivos }: Props) {
  const [activos,  setActivos]  = useState<Set<string>>(new Set(modulosActivos))
  const [guardado, setGuardado] = useState(false)
  const [pending,  start]       = useTransition()

  function toggle(key: string) {
    setGuardado(false)
    setActivos(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function guardar() {
    start(async () => {
      await actualizarModulosTenant(tenantId, Array.from(activos))
      setGuardado(true)
    })
  }

  const cambios = JSON.stringify(Array.from(activos).sort()) !== JSON.stringify([...modulosActivos].sort())

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Módulos habilitados</h2>
          <p className="text-xs text-gray-400 mt-0.5">Activa o desactiva secciones del panel admin para este tenant</p>
        </div>
        <div className="flex items-center gap-2">
          {guardado && !cambios && (
            <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>
          )}
          <button
            type="button"
            disabled={!cambios || pending}
            onClick={guardar}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {MODULOS_CATALOGO.map(grupo => (
          <div key={grupo.grupo}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{grupo.grupo}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {grupo.items.map(mod => {
                const enabled = activos.has(mod.key)
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggle(mod.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      enabled
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    {/* Toggle pill */}
                    <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${enabled ? 'bg-violet-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${enabled ? 'text-violet-800' : 'text-gray-500'}`}>{mod.label}</p>
                      <p className="text-xs text-gray-400 truncate">{mod.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
