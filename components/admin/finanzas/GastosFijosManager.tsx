'use client'

import { useState, useTransition } from 'react'
import { crearGastoFijo, toggleGastoFijo, eliminarGastoFijo } from '@/app/actions/gastos-fijos'

type GastoFijo = {
  id:        string
  nombre:    string
  monto:     number
  categoria: string
  activo:    boolean
}

const CATEGORIAS = [
  { value: 'personal',  label: '👤 Personal'         },
  { value: 'operativo', label: '⚙️ Operativo'        },
  { value: 'admin',     label: '📋 Administrativo'   },
  { value: 'marketing', label: '📢 Marketing'        },
]

const CAT_COLORS: Record<string, string> = {
  personal:  'bg-purple-100 text-purple-700',
  operativo: 'bg-blue-100 text-blue-700',
  admin:     'bg-gray-100 text-gray-700',
  marketing: 'bg-amber-100 text-amber-700',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function GastosFijosManager({ gastos }: { gastos: GastoFijo[] }) {
  const [pending, startTransition] = useTransition()
  const [nombre,    setNombre]    = useState('')
  const [monto,     setMonto]     = useState('')
  const [categoria, setCategoria] = useState('operativo')
  const [error,     setError]     = useState('')

  function handleAdd() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    const num = Number(monto)
    if (!monto || isNaN(num) || num <= 0) { setError('Ingresa un monto válido'); return }
    setError('')
    const fd = new FormData()
    fd.set('nombre', nombre.trim())
    fd.set('monto', String(num))
    fd.set('categoria', categoria)
    startTransition(async () => {
      await crearGastoFijo(fd)
      setNombre('')
      setMonto('')
    })
  }

  const activos        = gastos.filter(g => g.activo)
  const totalMensual   = activos.reduce((s, g) => s + g.monto, 0)
  const totalAnual     = totalMensual * 12

  return (
    <div className="space-y-6">

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Gasto mensual total</p>
          <p className="text-2xl font-bold text-amber-800">${fmt(totalMensual)}</p>
          <p className="text-xs text-amber-600 mt-1">{activos.length} gasto{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Proyección anual</p>
          <p className="text-2xl font-bold text-orange-800">${fmt(totalAnual)}</p>
          <p className="text-xs text-orange-600 mt-1">12 meses de gastos fijos</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gastos configurados</p>
          <p className="text-2xl font-bold text-gray-800">{gastos.length}</p>
          <p className="text-xs text-gray-400 mt-1">{gastos.filter(g => !g.activo).length} inactivo{gastos.filter(g => !g.activo).length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Por categoría */}
      {activos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Distribución por categoría</h3>
          <div className="space-y-2">
            {CATEGORIAS.map(cat => {
              const gastosCat = activos.filter(g => g.categoria === cat.value)
              if (gastosCat.length === 0) return null
              const total = gastosCat.reduce((s, g) => s + g.monto, 0)
              const pct   = totalMensual > 0 ? Math.round(total / totalMensual * 100) : 0
              return (
                <div key={cat.value} className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-28 text-center ${CAT_COLORS[cat.value]}`}>
                    {cat.label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-32 text-right">${fmt(total)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulario agregar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Agregar gasto fijo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre (ej: Sueldo, Celular…)"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="Monto mensual (COP)"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={pending}
          className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {pending ? 'Guardando…' : '+ Agregar gasto fijo'}
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Gastos configurados</h3>
        </div>

        {gastos.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">
            Sin gastos fijos configurados.<br/>
            <span className="text-xs">Agrega tus gastos operativos mensuales para proyectar el flujo de caja real.</span>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Monto/mes</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gastos.map(g => (
                <tr key={g.id} className={`hover:bg-gray-50 transition-colors ${!g.activo ? 'opacity-40' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{g.nombre}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[g.categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORIAS.find(c => c.value === g.categoria)?.label ?? g.categoria}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">${fmt(g.monto)}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => startTransition(() => toggleGastoFijo(g.id, !g.activo))}
                      className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                        g.activo
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {g.activo ? '● Activo' : '○ Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        if (!confirm(`¿Eliminar "${g.nombre}"?`)) return
                        startTransition(() => eliminarGastoFijo(g.id))
                      }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">
                  Total mensual activo
                </td>
                <td className="px-5 py-3 text-right font-bold text-amber-700">${fmt(totalMensual)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
