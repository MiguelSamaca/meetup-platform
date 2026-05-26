'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { crearCotizacion, editarCotizacion, type ItemInput } from '@/app/actions/cotizaciones'
import FotoUploader from '@/components/admin/FotoUploader'

export interface ProductoCatalogo {
  id:          string
  referencia:  string | null
  proveedor:   string | null
  descripcion: string
  unidad:      string
  foto_url:    string | null
}

export interface InitialItem {
  referencia:      string | null
  proveedor:       string | null
  descripcion:     string
  cantidad:        number
  precio_unitario: number
  descuento:       number
  moneda_costo:    'COP' | 'USD'
  costo_unitario:  number
  trm:             number | null
  foto_url:        string | null
  orden:           number
}

interface Props {
  contactoId:             string
  contactoNombre:         string
  catalogo:               ProductoCatalogo[]
  cotizacionId?:          string
  initialEstado?:         string
  initialNotas?:          string
  initialFecha?:          string
  initialValidez?:        number
  initialItems?:          InitialItem[]
  initialMostrarDesc?:    boolean
}

interface ItemRow {
  key:             number
  referencia:      string
  proveedor:       string
  descripcion:     string
  cantidad:        string
  precio_unitario: string
  descuento:       string
  moneda_costo:    'COP' | 'USD'
  costo_unitario:  string
  trm:             string
  foto_url:        string
  buscando:        boolean
  query:           string
}

const emptyRow = (key: number): ItemRow => ({
  key, referencia: '', proveedor: '', descripcion: '', cantidad: '1',
  precio_unitario: '', descuento: '0', moneda_costo: 'COP', costo_unitario: '', trm: '',
  foto_url: '', buscando: false, query: '',
})

function itemToRow(it: InitialItem, key: number): ItemRow {
  return {
    key,
    referencia:      it.referencia ?? '',
    proveedor:       it.proveedor  ?? '',
    descripcion:     it.descripcion,
    cantidad:        String(it.cantidad),
    precio_unitario: it.precio_unitario > 0 ? String(it.precio_unitario) : '',
    descuento:       String(it.descuento ?? 0),
    moneda_costo:    it.moneda_costo,
    costo_unitario:  it.costo_unitario > 0 ? String(it.costo_unitario) : '',
    trm:             it.trm ? String(it.trm) : '',
    foto_url:        it.foto_url ?? '',
    buscando:        false,
    query:           '',
  }
}

const VALIDEZ_OPCIONES = [
  { value: 8,  label: '8 días' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
  { value: 60, label: '60 días' },
]

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function calcRow(row: ItemRow) {
  const qty   = parseFloat(row.cantidad)        || 0
  const price = parseFloat(row.precio_unitario) || 0
  const cost  = parseFloat(row.costo_unitario)  || 0
  const trm   = parseFloat(row.trm)             || 0
  const desc  = Math.min(Math.max(parseFloat(row.descuento) || 0, 0), 100)
  const precioBase  = qty * price
  const descMonto   = precioBase * desc / 100
  const precioTotal = precioBase - descMonto          // neto tras descuento
  const costoCOP    = row.moneda_costo === 'USD' ? cost * trm : cost
  const costoTotal  = qty * costoCOP
  const margen      = precioTotal > 0 ? ((precioTotal - costoTotal) / precioTotal) * 100 : 0
  return { precioBase, descMonto, precioTotal, costoTotal, margen }
}


export default function CotizacionForm({
  contactoId,
  contactoNombre,
  catalogo,
  cotizacionId,
  initialEstado    = 'borrador',
  initialNotas     = '',
  initialFecha,
  initialValidez   = 30,
  initialItems,
  initialMostrarDesc = true,
}: Props) {
  const today   = new Date().toISOString().split('T')[0]
  const isEdit  = Boolean(cotizacionId)

  const initRows: ItemRow[] = initialItems && initialItems.length > 0
    ? initialItems.map((it, i) => itemToRow(it, i + 1))
    : [emptyRow(1)]

  const [rows,         setRows]        = useState<ItemRow[]>(initRows)
  const [estado,       setEstado]      = useState(initialEstado)
  const [notas,        setNotas]       = useState(initialNotas)
  const [fecha,        setFecha]       = useState(initialFecha ?? today)
  const [validez,      setValidez]     = useState(initialValidez)
  const [mostrarDesc,  setMostrarDesc] = useState(initialMostrarDesc)
  const [counter,      setCounter]     = useState(initRows.length + 1)
  const [pending, startTransition] = useTransition()

  function addRow() {
    setRows(r => [...r, emptyRow(counter)])
    setCounter(c => c + 1)
  }
  function removeRow(key: number) { setRows(r => r.filter(row => row.key !== key)) }
  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows(r => r.map(row => row.key === key ? { ...row, ...patch } : row))
  }
  function seleccionarProducto(key: number, p: ProductoCatalogo) {
    updateRow(key, {
      referencia:     p.referencia ?? '',
      proveedor:      p.proveedor  ?? '',
      descripcion:    p.descripcion,
      foto_url:       p.foto_url   ?? '',
      costo_unitario: '',
      buscando:       false,
      query:          '',
    })
  }

  /**
   * Cálculo bidireccional de margen:
   *
   * A) Precio conocido, costo desconocido → calcula costo:
   *    costo_COP = precio * (1 - margen/100)
   *    Si moneda USD: costo_USD = costo_COP / TRM
   *
   * B) Costo conocido, precio desconocido → calcula precio (comportamiento original):
   *    precio = costo_COP / (1 - margen/100)
   */
  function applyMargen(key: number, margenTarget: number) {
    if (margenTarget <= 0 || margenTarget >= 100) return
    setRows(current => current.map(row => {
      if (row.key !== key) return row

      const price   = parseFloat(row.precio_unitario) || 0
      const cost    = parseFloat(row.costo_unitario)  || 0
      const trm     = parseFloat(row.trm)             || 0
      const costCOP = row.moneda_costo === 'USD' ? cost * trm : cost

      // A) Precio conocido pero sin costo → calculamos costo
      if (price > 0 && costCOP <= 0) {
        const nuevoCostoCOP = price * (1 - margenTarget / 100)
        const nuevoCosto    = row.moneda_costo === 'USD' && trm > 0
          ? nuevoCostoCOP / trm          // convertir COP → USD
          : nuevoCostoCOP
        return { ...row, costo_unitario: Math.round(nuevoCosto).toString() }
      }

      // B) Costo conocido → calculamos precio
      if (costCOP > 0) {
        const newPrecio = costCOP / (1 - margenTarget / 100)
        return { ...row, precio_unitario: Math.round(newPrecio).toString() }
      }

      return row   // sin precio ni costo, nada que calcular
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const items: ItemInput[] = rows
      .filter(r => r.descripcion.trim())
      .map((r, i) => ({
        referencia:      r.referencia.trim(),
        proveedor:       r.proveedor.trim(),
        descripcion:     r.descripcion.trim(),
        cantidad:        parseFloat(r.cantidad)        || 1,
        precio_unitario: parseFloat(r.precio_unitario) || 0,
        descuento:       parseFloat(r.descuento)       || 0,
        moneda_costo:    r.moneda_costo,
        costo_unitario:  parseFloat(r.costo_unitario)  || 0,
        trm:             r.moneda_costo === 'USD' ? (parseFloat(r.trm) || null) : null,
        orden:           i,
        foto_url:        r.foto_url || null,
      }))

    startTransition(() => {
      if (isEdit && cotizacionId) {
        editarCotizacion(cotizacionId, contactoId, estado, notas, items, fecha, validez, mostrarDesc)
      } else {
        crearCotizacion(contactoId, estado, notas, items, fecha, validez, mostrarDesc)
      }
    })
  }

  const totales = rows.reduce((acc, row) => {
    const { precioBase, descMonto, precioTotal, costoTotal } = calcRow(row)
    acc.precioBase += precioBase
    acc.descTotal  += descMonto
    acc.precio     += precioTotal
    acc.costo      += costoTotal
    return acc
  }, { precioBase: 0, descTotal: 0, precio: 0, costo: 0 })
  const hayDescuento = totales.descTotal > 0
  const margenGlobal = totales.precio > 0 ? ((totales.precio - totales.costo) / totales.precio) * 100 : 0
  const mgColor = (m: number) =>
    m >= 30 ? 'text-emerald-600' :
    m >= 15 ? 'text-amber-500'  :
    m >= 10 ? 'text-orange-500' :
              'text-red-600'

  const fechaVence = fecha ? (() => {
    const d = new Date(fecha + 'T00:00:00')
    d.setDate(d.getDate() + validez)
    return d.toLocaleDateString('es-CO')
  })() : ''

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
      className="space-y-6"
    >

      {/* Encabezado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Validez</label>
          <select
            value={validez}
            onChange={e => setValidez(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {VALIDEZ_OPCIONES.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {fechaVence && <p className="text-xs text-gray-400 mt-1">Vence: {fechaVence}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            value={estado}
            onChange={e => setEstado(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Tabla de items */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 w-7">#</th>
              <th className="text-center px-2 py-2.5 font-semibold text-gray-600 w-20">Foto</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 w-36">Ref.</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 w-36">Proveedor/Marca</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Descripción *</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-40">Cant.</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-44">Precio unit. (COP)</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-20">Desc. %</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-36">Total venta</th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-600 w-22">Moneda</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-44 min-w-[140px]">Costo unit.</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-40">TRM (COP/USD)</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-32">Costo total</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-28">Margen / Obj.</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const { precioBase, descMonto, precioTotal, costoTotal, margen } = calcRow(row)
              const q = row.query.toLowerCase()
              const sugerencias = q.length >= 1
                ? catalogo.filter(p =>
                    p.descripcion.toLowerCase().includes(q) ||
                    (p.referencia ?? '').toLowerCase().includes(q) ||
                    (p.proveedor  ?? '').toLowerCase().includes(q)
                  ).slice(0, 8)
                : catalogo.slice(0, 10)

              return (
                <tr key={row.key} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 text-gray-400 text-xs pt-3">{idx + 1}</td>

                  {/* Foto */}
                  <td className="px-2 py-2 text-center">
                    <FotoUploader
                      size="sm"
                      value={row.foto_url}
                      onChange={url => updateRow(row.key, { foto_url: url })}
                    />
                  </td>

                  {/* Referencia */}
                  <td className="px-3 py-2">
                    <input
                      value={row.referencia}
                      onChange={e => updateRow(row.key, { referencia: e.target.value })}
                      placeholder="SKU / Referencia"
                      className="w-full min-w-[110px] px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>

                  {/* Proveedor */}
                  <td className="px-3 py-2">
                    <input
                      value={row.proveedor}
                      onChange={e => updateRow(row.key, { proveedor: e.target.value })}
                      placeholder="McIntosh, Samsung…"
                      className="w-full min-w-[110px] px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>

                  {/* Descripción + buscador */}
                  <td className="px-3 py-2 relative">
                    <div className="flex gap-1">
                      <input
                        value={row.descripcion}
                        onChange={e => updateRow(row.key, { descripcion: e.target.value })}
                        placeholder="Descripción del producto"
                        required
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      {catalogo.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => updateRow(row.key, { buscando: !row.buscando, query: '' })}
                            title="Buscar en catálogo"
                            className={`px-2 py-1.5 rounded border text-xs font-medium transition-colors ${
                              row.buscando
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : 'border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-400'
                            }`}
                          >📦</button>
                          {row.buscando && (
                            <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                              <div className="p-2 border-b border-gray-100">
                                <input
                                  autoFocus
                                  value={row.query}
                                  onChange={e => updateRow(row.key, { query: e.target.value })}
                                  placeholder="Descripción, Ref. o Marca…"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                              </div>
                              <div className="max-h-52 overflow-y-auto">
                                {sugerencias.length > 0 ? sugerencias.map(p => (
                                  <button key={p.id} type="button"
                                    onClick={() => seleccionarProducto(row.key, p)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0">
                                    <p className="text-sm font-medium text-gray-800">{p.descripcion}</p>
                                    <p className="text-xs text-gray-400">
                                      {[p.referencia, p.proveedor, p.unidad].filter(Boolean).join(' · ')}
                                    </p>
                                  </button>
                                )) : (
                                  <p className="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados</p>
                                )}
                              </div>
                              <div className="p-2 border-t border-gray-100">
                                <button type="button"
                                  onClick={() => updateRow(row.key, { buscando: false, query: '' })}
                                  className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                                  Cerrar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Cantidad */}
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="any" value={row.cantidad}
                      onChange={e => updateRow(row.key, { cantidad: e.target.value })}
                      className="w-full min-w-[110px] px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>

                  {/* Precio unit — texto con separador de miles (puntos COP) */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        row.precio_unitario
                          ? Number(row.precio_unitario).toLocaleString('es-CO')
                          : ''
                      }
                      onChange={e => {
                        // Solo dígitos; strip puntos de miles antes de guardar
                        const raw = e.target.value.replace(/[^\d]/g, '')
                        updateRow(row.key, { precio_unitario: raw })
                      }}
                      placeholder="0"
                      className="w-full min-w-[140px] px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>

                  {/* Descuento % */}
                  <td className="px-2 py-2">
                    <div className="relative flex items-center">
                      <input type="number" min="0" max="100" step="any" value={row.descuento}
                        onChange={e => updateRow(row.key, { descuento: e.target.value })}
                        placeholder="0"
                        className="w-20 px-2 py-1.5 pr-5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <span className="absolute right-1.5 text-xs text-gray-400 pointer-events-none">%</span>
                    </div>
                  </td>

                  {/* Total venta (neto tras descuento) */}
                  <td className="px-3 py-2 text-right pt-3">
                    {descMonto > 0 ? (
                      <div>
                        <p className="text-xs text-gray-400 line-through">${fmt(precioBase)}</p>
                        <p className="font-semibold text-emerald-700">${fmt(precioTotal)}</p>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-800">${fmt(precioTotal)}</span>
                    )}
                  </td>

                  {/* Moneda */}
                  <td className="px-3 py-2">
                    <select value={row.moneda_costo}
                      onChange={e => updateRow(row.key, { moneda_costo: e.target.value as 'COP'|'USD' })}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                      <option value="COP">COP $</option>
                      <option value="USD">USD $</option>
                    </select>
                  </td>

                  {/* Costo unit */}
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="any" value={row.costo_unitario}
                      onChange={e => updateRow(row.key, { costo_unitario: e.target.value })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>

                  {/* TRM */}
                  <td className="px-3 py-2">
                    {row.moneda_costo === 'USD' ? (
                      <input type="number" min="0" step="any" value={row.trm}
                        onChange={e => updateRow(row.key, { trm: e.target.value })}
                        placeholder="4.200"
                        className="w-full min-w-[130px] px-2 py-1.5 border border-amber-300 bg-amber-50 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    ) : <span className="text-gray-300 text-xs flex justify-center pt-2">—</span>}
                  </td>

                  {/* Costo total */}
                  <td className="px-3 py-2 text-right text-gray-600 pt-3">${fmt(costoTotal)}</td>

                  {/* Margen — calculado + objetivo + alertas */}
                  <td className="px-3 py-2 text-right">

                    {/* Alerta: margen demasiado bajo */}
                    {margen > 0 && margen < 10 && (
                      <div className="mb-1 flex items-center justify-end gap-1">
                        <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                          ⚠ MUY BAJO
                        </span>
                      </div>
                    )}

                    {/* Alerta: margen inusualmente alto */}
                    {margen >= 50 && (
                      <div className="mb-1 flex items-center justify-end gap-1">
                        <span className="text-[10px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded">
                          ⚠ MUY ALTO
                        </span>
                      </div>
                    )}

                    {/* Margen calculado en tiempo real */}
                    <span className={`font-semibold text-sm ${mgColor(margen)}`}>
                      {margen.toFixed(1)}%
                    </span>

                    {/* Cajita objetivo — step="any" evita error de validación del browser */}
                    <div className="mt-1.5 flex items-center justify-end gap-1">
                      <input
                        key={`mg-${row.key}-${margen.toFixed(2)}`}
                        type="number"
                        min="1" max="99" step="any"
                        defaultValue={margen > 0 && isFinite(margen) ? margen.toFixed(1) : ''}
                        placeholder="Obj."
                        title="Con precio y sin costo: calcula el costo. Con costo y sin precio: calcula el precio."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const v = parseFloat((e.target as HTMLInputElement).value)
                            applyMargen(row.key, v)
                          }
                        }}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (!isNaN(v)) applyMargen(row.key, v)
                        }}
                        className="w-16 px-1.5 py-0.5 border border-dashed border-gray-300 rounded text-xs text-right text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-solid focus:border-emerald-400"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </td>

                  {/* Eliminar fila */}
                  <td className="px-3 py-2 text-center pt-2">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.key)}
                        className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            {/* Fila interna: totales de costo y margen (columna Desc. % añade 1 col → colSpan 7) */}
            <tr className="bg-gray-50">
              <td colSpan={7} className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right uppercase tracking-wide">Subtotal productos</td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900">${fmt(totales.precio)}</td>
              <td colSpan={3} />
              <td className="px-3 py-2.5 text-right font-bold text-gray-700">${fmt(totales.costo)}</td>
              <td className="px-3 py-2.5 text-right">
                <span className={`text-base font-bold ${mgColor(margenGlobal)}`}>{margenGlobal.toFixed(1)}%</span>
              </td>
              <td />
            </tr>
            {/* Subtotal bruto (solo si hay algún descuento) */}
            {hayDescuento && (
              <tr className="bg-emerald-50 border-t border-emerald-100">
                <td colSpan={6} />
                <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal bruto</td>
                <td className="px-3 py-1.5 text-right text-gray-500 line-through text-sm">${fmt(totales.precioBase)}</td>
                <td colSpan={6} />
              </tr>
            )}
            {hayDescuento && (
              <tr className="bg-emerald-50">
                <td colSpan={6} />
                <td className="px-3 py-1 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Descuento</td>
                <td className="px-3 py-1 text-right text-red-500 font-medium text-sm">- ${fmt(totales.descTotal)}</td>
                <td colSpan={6} />
              </tr>
            )}
            {/* SUBTOTAL neto */}
            <tr className="bg-emerald-50 border-t border-emerald-100">
              <td colSpan={6} />
              <td className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">SUBTOTAL</td>
              <td className="px-3 py-2 text-right font-semibold text-gray-800">${fmt(totales.precio)}</td>
              <td colSpan={6} />
            </tr>
            <tr className="bg-emerald-50">
              <td colSpan={6} />
              <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">IVA 19%</td>
              <td className="px-3 py-1.5 text-right text-gray-600">${fmt(totales.precio * 0.19)}</td>
              <td colSpan={6} />
            </tr>
            <tr className="bg-emerald-50 border-t-2 border-emerald-200">
              <td colSpan={6} />
              <td className="px-3 py-3 text-right text-sm font-bold text-gray-800 uppercase tracking-wide">TOTAL</td>
              <td className="px-3 py-3 text-right text-lg font-bold text-emerald-700">${fmt(totales.precio * 1.19)}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-4 text-xs text-gray-400">
        <span className="text-emerald-600 font-medium">■</span> ≥ 30% &nbsp;
        <span className="text-amber-500 font-medium">■</span> 15–29% &nbsp;
        <span className="text-red-500 font-medium">■</span> &lt; 15%
      </div>

      {/* Toggle visibilidad de descuentos en el PDF */}
      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={mostrarDesc}
          onChange={e => setMostrarDesc(e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        <span className="text-sm text-gray-600">Mostrar descuentos en la cotización exportada</span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={addRow}
          className="px-4 py-2 border border-dashed border-emerald-400 text-emerald-600 text-sm rounded-lg hover:bg-emerald-50 transition-colors">
          + Agregar producto
        </button>
        <div className="flex-1" />
        <Link
          href={isEdit
            ? `/admin/contactos/${contactoId}/cotizaciones/${cotizacionId}`
            : `/admin/contactos/${contactoId}`}
          className="px-5 py-2.5 border border-gray-300 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </Link>
        <button type="submit"
          disabled={pending || rows.every(r => !r.descripcion.trim())}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar cotización'}
        </button>
      </div>
    </form>
  )
}
