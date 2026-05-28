'use client'

import { useState, useTransition, useRef } from 'react'
import { agregarGasto, eliminarGasto } from '@/app/actions/gastos'

interface Gasto {
  id:          string
  descripcion: string
  categoria:   string
  monto:       number
  factura:     string | null
  soporte_url: string | null
  fecha:       string | null
}

interface Props {
  proyectoId:     string
  initialGastos:  Gasto[]
}

const CATEGORIAS = [
  { value: 'flete',        label: 'Flete / Envío' },
  { value: 'transporte',   label: 'Transporte' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'alojamiento',  label: 'Alojamiento' },
  { value: 'materiales',   label: 'Materiales' },
  { value: 'herramientas', label: 'Herramientas' },
  { value: 'otros',        label: 'Otros' },
]

const CAT_COLOR: Record<string, string> = {
  flete:        'bg-blue-100 text-blue-700',
  transporte:   'bg-cyan-100 text-cyan-700',
  alimentacion: 'bg-orange-100 text-orange-700',
  alojamiento:  'bg-purple-100 text-purple-700',
  materiales:   'bg-amber-100 text-amber-700',
  herramientas: 'bg-yellow-100 text-yellow-700',
  otros:        'bg-gray-100 text-gray-600',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const hoy = new Date().toISOString().split('T')[0]

const emptyForm = () => ({
  descripcion: '',
  categoria:   'otros',
  monto:       '',
  factura:     '',
  fecha:       hoy,
})

export default function GastosPanel({ proyectoId, initialGastos }: Props) {
  const [, startTransition] = useTransition()
  const [gastos,     setGastos]     = useState<Gasto[]>(initialGastos)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form,        setForm]       = useState(emptyForm)
  const [subiendo,    setSubiendo]   = useState(false)
  const [soporteUrl,  setSoporteUrl] = useState('')
  const [soporteNombre, setSoporteNombre] = useState('')
  const [guardando,   setGuardando]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  /* ── Upload soporte ── */
  async function handleSoporte(file: File) {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo', 'gasto')
      const res  = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSoporteUrl(json.url)
      setSoporteNombre(file.name)
    } catch (e) {
      alert('Error subiendo archivo')
    } finally {
      setSubiendo(false)
    }
  }

  /* ── Guardar gasto ── */
  async function handleGuardar() {
    if (!form.descripcion.trim() || !form.monto) return
    setGuardando(true)
    const nuevo: Gasto = {
      id:          crypto.randomUUID(),
      descripcion: form.descripcion,
      categoria:   form.categoria,
      monto:       parseFloat(form.monto) || 0,
      factura:     form.factura || null,
      soporte_url: soporteUrl || null,
      fecha:       form.fecha || null,
    }
    setGastos(prev => [...prev, nuevo])
    setMostrarForm(false)
    setForm(emptyForm())
    setSoporteUrl('')
    setSoporteNombre('')
    setGuardando(false)
    startTransition(() =>
      agregarGasto(proyectoId, {
        descripcion: nuevo.descripcion,
        categoria:   nuevo.categoria,
        monto:       nuevo.monto,
        factura:     nuevo.factura ?? '',
        soporte_url: nuevo.soporte_url ?? '',
        fecha:       nuevo.fecha ?? '',
      })
    )
  }

  /* ── Eliminar gasto ── */
  function handleEliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    setGastos(prev => prev.filter(g => g.id !== id))
    startTransition(() => eliminarGasto(id, proyectoId))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-800">Gastos adicionales</h2>
          {gastos.length > 0 && (
            <span className="text-sm font-bold text-gray-700">
              Total: <span className="text-red-600">${fmt(totalGastos)}</span>
            </span>
          )}
        </div>
        {!mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 border border-dashed border-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            + Agregar gasto
          </button>
        )}
      </div>

      {/* Formulario inline */}
      {mostrarForm && (
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {/* Descripción */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Descripción *</label>
              <input
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Flete Medellín - Bogotá"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoría *</label>
              <select
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monto *</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400 text-xs">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.monto ? Number(form.monto).toLocaleString('es-CO') : ''}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value.replace(/[^\d]/g, '') }))}
                  placeholder="0"
                  className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* N° Factura */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">N° Factura</label>
              <input
                value={form.factura}
                onChange={e => setForm(f => ({ ...f, factura: e.target.value }))}
                placeholder="Ej: FE-001234"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Soporte */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Soporte (PDF / imagen)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSoporte(f) }}
              />
              {soporteUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={soporteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline truncate max-w-[140px]"
                    title={soporteNombre}
                  >
                    📎 {soporteNombre || 'Ver archivo'}
                  </a>
                  <button
                    type="button"
                    onClick={() => { setSoporteUrl(''); setSoporteNombre('') }}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >×</button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={subiendo}
                  onClick={() => fileRef.current?.click()}
                  className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  {subiendo ? 'Subiendo…' : '📎 Subir archivo'}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setMostrarForm(false); setForm(emptyForm()); setSoporteUrl(''); setSoporteNombre('') }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!form.descripcion.trim() || !form.monto || guardando}
              onClick={handleGuardar}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Guardar gasto
            </button>
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      {gastos.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Factura</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Soporte</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {gastos.map(g => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {g.fecha ? new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                </td>
                <td className="px-5 py-3 text-gray-800 font-medium">{g.descripcion}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CAT_COLOR[g.categoria] ?? CAT_COLOR.otros}`}>
                    {CATEGORIAS.find(c => c.value === g.categoria)?.label ?? g.categoria}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs font-mono">
                  {g.factura ?? '—'}
                </td>
                <td className="px-5 py-3">
                  {g.soporte_url ? (
                    <a
                      href={g.soporte_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-medium"
                    >
                      📎 Ver
                    </a>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-bold text-red-600">
                  ${fmt(g.monto)}
                </td>
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleEliminar(g.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                    title="Eliminar gasto"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr className="bg-red-50">
              <td colSpan={5} className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total gastos adicionales
              </td>
              <td className="px-5 py-3 text-right text-base font-bold text-red-600">
                ${fmt(totalGastos)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      ) : (
        !mostrarForm && (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            Sin gastos registrados.
          </p>
        )
      )}
    </div>
  )
}
