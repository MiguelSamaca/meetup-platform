import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import Link from 'next/link'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ProgressBar({ recibidos, pedidos, total }: { recibidos: number; pedidos: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">Sin ítems</span>
  const pctR = (recibidos / total) * 100
  const pctP = (pedidos   / total) * 100
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden flex">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pctR}%` }} />
        <div className="h-full bg-amber-300 transition-all"  style={{ width: `${pctP}%` }} />
      </div>
      <span className="text-xs text-gray-500">{recibidos}/{total}</span>
    </div>
  )
}

function PayBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {ok ? '✓' : '·'} {label}
    </span>
  )
}

export default async function OrdenesPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const { data: ordenes } = await supabase
    .from('ordenes_ejecucion')
    .select(`
      id, consecutivo, estado, total_cotizacion,
      anticipo_porcentaje, anticipo_monto, anticipo_recibido,
      saldo_recibido, created_at, completed_at,
      contacto_id,
      oe_items(id, estado)
    `)
    .eq('tenant_id', profile?.tenant_id!)
    .order('created_at', { ascending: false })

  // Cargar contactos por separado para evitar problemas con FK en PostgREST
  const contactoIds = [...new Set((ordenes ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await supabase
        .from('contactos')
        .select('id, nombre, empresas(nombre)')
        .in('id', contactoIds)
    : { data: [] }

  const contactoMap = new Map(
    (contactos ?? []).map(c => [
      c.id,
      {
        nombre:       c.nombre,
        empresaNombre: (c.empresas as unknown as { nombre: string } | null)?.nombre ?? null,
      },
    ])
  )

  const rows = (ordenes ?? []).map(oe => {
    const items     = (oe.oe_items ?? []) as Array<{ id: string; estado: string }>
    const total     = items.length
    const recibidos = items.filter(i => i.estado === 'recibido').length
    const pedidos   = items.filter(i => i.estado === 'pedido').length
    const contacto  = contactoMap.get(oe.contacto_id ?? '')
    const saldo     = (oe.total_cotizacion ?? 0) - (oe.anticipo_monto ?? 0)

    return {
      ...oe,
      contactoNombre: contacto?.nombre ?? '—',
      empresaNombre:  contacto?.empresaNombre ?? null,
      total, recibidos, pedidos, saldo,
    }
  })

  const activas     = rows.filter(r => r.estado === 'activa')
  const completadas = rows.filter(r => r.estado === 'completada')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Ejecución</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seguimiento de equipos, pagos y entrega por cotización aprobada.
        </p>
      </div>

      {rows.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p className="text-lg mb-1">Sin órdenes todavía</p>
          <p className="text-sm">
            Aprueba una cotización y usa el botón <strong>▶ Abrir proyecto</strong>
          </p>
        </div>
      )}

      {/* Activas */}
      {activas.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Activas — {activas.length}
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">OE #</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Contacto</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Anticipo</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Saldo</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Equipos</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activas.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700">
                      <Link href={`/admin/ordenes/${r.id}`} className="hover:underline">
                        {r.consecutivo}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{r.contactoNombre}</p>
                      {r.empresaNombre && <p className="text-xs text-gray-400">{r.empresaNombre}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      ${fmt(r.total_cotizacion ?? 0)}
                    </td>
                    <td className="px-5 py-3">
                      <PayBadge
                        ok={r.anticipo_recibido}
                        label={`${r.anticipo_porcentaje}% · $${fmt(r.anticipo_monto ?? 0)}`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <PayBadge ok={r.saldo_recibido} label={`$${fmt(r.saldo)}`} />
                    </td>
                    <td className="px-5 py-3">
                      <ProgressBar recibidos={r.recibidos} pedidos={r.pedidos} total={r.total} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/ordenes/${r.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Completadas */}
      {completadas.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
            Completadas — {completadas.length}
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-75">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">OE #</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Contacto</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Entregado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completadas.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-emerald-700">
                      <Link href={`/admin/ordenes/${r.id}`} className="hover:underline">
                        {r.consecutivo}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-700">{r.contactoNombre}</p>
                      {r.empresaNombre && <p className="text-xs text-gray-400">{r.empresaNombre}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-700">
                      ${fmt(r.total_cotizacion ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {r.completed_at
                        ? new Date(r.completed_at).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/ordenes/${r.id}`}
                        className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
