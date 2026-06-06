import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { Suspense } from 'react'
import Link from 'next/link'
import FiltrosCobrar from '@/components/admin/finanzas/FiltrosCobrar'
import CobrarAcciones from '@/components/admin/finanzas/CobrarAcciones'

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type EstadoCobro = 'pendiente' | 'anticipo' | 'saldo_pendiente' | 'pagado' | 'vencido'

function calcEstado(
  anticipoRecibido: boolean,
  saldoRecibido: boolean,
  anticipoFecha: string | null,
  saldoFecha: string | null,
): EstadoCobro {
  const hoy = new Date()
  if (saldoRecibido) return 'pagado'
  if (anticipoRecibido) {
    if (saldoFecha && new Date(saldoFecha) < hoy) return 'vencido'
    return 'saldo_pendiente'
  }
  if (anticipoFecha && new Date(anticipoFecha) < hoy) return 'vencido'
  return 'pendiente'
}

function EstadoBadge({ estado }: { estado: EstadoCobro }) {
  const map: Record<EstadoCobro, { label: string; cls: string }> = {
    pendiente:      { label: 'Pendiente',       cls: 'bg-gray-100 text-gray-500'      },
    anticipo:       { label: 'Anticipo ✓',      cls: 'bg-amber-100 text-amber-700'    },
    saldo_pendiente:{ label: 'Saldo pendiente', cls: 'bg-blue-100 text-blue-700'      },
    pagado:         { label: '✓ Pagado',        cls: 'bg-emerald-100 text-emerald-700'},
    vencido:        { label: '⚠ Vencido',      cls: 'bg-red-100 text-red-700'        },
  }
  const { label, cls } = map[estado]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  )
}

/* ── Page ── */
export default async function CobrarPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const { estado: filtroEstado } = await searchParams
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!

  /* ── Datos ── */
  const { data: oes } = await supabase
    .from('ordenes_ejecucion')
    .select(`
      id, consecutivo, total_cotizacion, total_con_iva,
      anticipo_porcentaje, anticipo_monto, anticipo_fecha, anticipo_recibido,
      saldo_fecha, saldo_recibido,
      contacto_id, created_at
    `)
    .eq('tenant_id', tid)
    .order('created_at', { ascending: false })

  /* ── Contactos ── */
  const contactoIds = [...new Set((oes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const contactoMap = new Map((contactos ?? []).map(c => [c.id, c.nombre]))

  /* ── Enriquecer filas ── */
  const rows = (oes ?? []).map(oe => {
    // Usar total_con_iva (valor real que paga el cliente)
    const totalIva   = oe.total_con_iva ?? Math.round((oe.total_cotizacion ?? 0) * 1.19)
    const anticIva   = Math.round(totalIva * (oe.anticipo_porcentaje ?? 50) / 100)
    const saldoMonto = Math.max(0, totalIva - anticIva)
    const recaudado  = (oe.anticipo_recibido ? anticIva : 0)
                     + (oe.saldo_recibido    ? saldoMonto : 0)
    const pendiente  = Math.max(0, totalIva - recaudado)
    const estado     = calcEstado(
      oe.anticipo_recibido,
      oe.saldo_recibido,
      oe.anticipo_fecha,
      oe.saldo_fecha,
    )
    return {
      ...oe,
      saldoMonto,
      recaudado,
      pendiente,
      estado,
      contactoNombre: contactoMap.get(oe.contacto_id ?? '') ?? '—',
    }
  })

  /* ── Aplicar filtro ── */
  const filtradas = filtroEstado
    ? rows.filter(r => {
        if (filtroEstado === 'anticipo') return r.estado === 'anticipo' || r.estado === 'saldo_pendiente'
        return r.estado === filtroEstado
      })
    : rows

  /* ── Totales ── */
  const totFacturado  = filtradas.reduce((s, r) => s + (r.total_cotizacion ?? 0), 0)
  const totRecaudado  = filtradas.reduce((s, r) => s + r.recaudado, 0)
  const totPendiente  = filtradas.reduce((s, r) => s + r.pendiente, 0)

  /* ── Conteos por estado (todos) ── */
  const conteos = {
    pendiente: rows.filter(r => r.estado === 'pendiente').length,
    anticipo:  rows.filter(r => r.estado === 'anticipo' || r.estado === 'saldo_pendiente').length,
    pagado:    rows.filter(r => r.estado === 'pagado').length,
    vencido:   rows.filter(r => r.estado === 'vencido').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar</h1>
          <p className="text-sm text-gray-500 mt-1">Seguimiento de pagos de clientes por orden de ejecución</p>
        </div>
        <Suspense>
          <FiltrosCobrar />
        </Suspense>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pendientes',     count: conteos.pendiente, color: 'bg-gray-50 border-gray-200',   text: 'text-gray-700'    },
          { label: 'Con anticipo',   count: conteos.anticipo,  color: 'bg-amber-50 border-amber-200', text: 'text-amber-700'   },
          { label: 'Pagados',        count: conteos.pagado,    color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: '⚠ Vencidos',   count: conteos.vencido,   color: 'bg-red-50 border-red-200',     text: 'text-red-700'     },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <p className={`text-2xl font-bold ${c.text}`}>{c.count}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {filtradas.length} orden{filtradas.length !== 1 ? 'es' : ''}
            {filtroEstado && <span className="text-gray-400 font-normal ml-1">— filtrado</span>}
          </h2>
        </div>

        {filtradas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Sin órdenes con ese filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">OE #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Anticipo</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Recaudado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === 'vencido' ? 'bg-red-50/40' : ''}`}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/ordenes/${r.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                      {r.consecutivo}
                    </Link>
                    {r.estado === 'vencido' && (
                      <span className="block text-[10px] text-red-500 font-semibold mt-0.5">⚠ Vencida</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.contactoNombre}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">
                    ${fmt(r.total_con_iva ?? Math.round((r.total_cotizacion ?? 0) * 1.19))}
                    <div className="text-[10px] text-gray-400 font-normal">c/IVA</div>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    <div>${fmt(Math.round((r.total_con_iva ?? Math.round((r.total_cotizacion ?? 0) * 1.19)) * (r.anticipo_porcentaje ?? 50) / 100))}</div>
                    {r.anticipo_fecha && (
                      <div className={`text-[10px] mt-0.5 ${
                        !r.anticipo_recibido && new Date(r.anticipo_fecha) < new Date()
                          ? 'text-red-500 font-semibold'
                          : 'text-gray-400'
                      }`}>
                        {new Date(r.anticipo_fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    <div>${fmt(r.saldoMonto)}</div>
                    {r.saldo_fecha && (
                      <div className={`text-[10px] mt-0.5 ${
                        !r.saldo_recibido && new Date(r.saldo_fecha) < new Date()
                          ? 'text-red-500 font-semibold'
                          : 'text-gray-400'
                      }`}>
                        {new Date(r.saldo_fecha + 'T12:00:00').toLocaleDateString('es-CO')}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                    {r.recaudado > 0 ? `$${fmt(r.recaudado)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-amber-600">
                    {r.pendiente > 0 ? `$${fmt(r.pendiente)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <CobrarAcciones
                      oeId={r.id}
                      anticipoRecibido={r.anticipo_recibido}
                      saldoRecibido={r.saldo_recibido}
                      anticipoMonto={r.anticipo_monto ?? 0}
                      saldoMonto={r.saldoMonto}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totales */}
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">
                  Total ({filtradas.length} OE{filtradas.length !== 1 ? 's' : ''})
                </td>
                <td className="px-5 py-3 text-right font-bold text-gray-900">${fmt(totFacturado)}</td>
                <td colSpan={2} />
                <td className="px-5 py-3 text-right font-bold text-emerald-600">${fmt(totRecaudado)}</td>
                <td className="px-5 py-3 text-right font-bold text-amber-600">
                  {totPendiente > 0 ? `$${fmt(totPendiente)}` : '—'}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
