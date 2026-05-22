import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/admin/PrintButton'
import type { Metadata } from 'next'

function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/* ── Título dinámico para PDF: "Edgardo Gutierrez · 2026-05-21 · COT-202605-001" ── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; cotId: string }>
}): Promise<Metadata> {
  const { cotId } = await params
  const profile   = await getCurrentProfile()
  const supabase  = createAdminClient()

  const { data } = await supabase
    .from('cotizaciones')
    .select('consecutivo, fecha, contactos(nombre)')
    .eq('id', cotId)
    .eq('tenant_id', profile?.tenant_id!)
    .single()

  const nombre      = (data?.contactos as unknown as { nombre: string } | null)?.nombre ?? ''
  const fecha       = data?.fecha ?? ''
  const consecutivo = data?.consecutivo ?? ''

  return { title: `${nombre} · ${fecha} · ${consecutivo}` }
}

export default async function ImprimirCotizacionPage({
  params,
}: {
  params: Promise<{ id: string; cotId: string }>
}) {
  const { id, cotId } = await params
  const profile       = await getCurrentProfile()
  const supabase      = createAdminClient()

  const [{ data: contacto }, { data: cot }, { data: config }] = await Promise.all([
    supabase
      .from('contactos')
      .select('*, empresas(nombre, nit)')
      .eq('id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('cotizaciones')
      .select(`
        id, consecutivo, estado, notas, fecha, validez_dias, created_at, mostrar_descuento,
        cotizacion_items(id, referencia, proveedor, descripcion, cantidad, precio_unitario,
          descuento, moneda_costo, costo_unitario, trm, orden, foto_url)
      `)
      .eq('id', cotId)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('tenant_config')
      .select('*')
      .eq('tenant_id', profile?.tenant_id!)
      .maybeSingle(),
  ])

  if (!contacto || !cot) notFound()

  const mostrarDescuento = (cot as any).mostrar_descuento ?? true

  const items = ((cot.cotizacion_items ?? []) as Array<{
    id: string; referencia: string | null; descripcion: string
    cantidad: number; precio_unitario: number; descuento: number
    foto_url: string | null; proveedor: string | null
    moneda_costo: string; costo_unitario: number; trm: number | null; orden: number
  }>).sort((a, b) => a.orden - b.orden)

  let totalBase = 0, totalDescuento = 0, totalPrecio = 0
  const rows = items.map(it => {
    const desc       = it.descuento ?? 0
    const precioBase = it.cantidad * it.precio_unitario
    const descMonto  = precioBase * desc / 100
    const precioTotal = precioBase - descMonto
    totalBase      += precioBase
    totalDescuento += descMonto
    totalPrecio    += precioTotal
    return { ...it, precioBase, descMonto, precioTotal, desc }
  })
  const hayDescuento = totalDescuento > 0
  const iva   = totalPrecio * 0.19
  const total = totalPrecio + iva

  const fechaEmision = cot.fecha
    ? new Date(cot.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date(cot.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  const fechaVence = (() => {
    const base = cot.fecha ? new Date(cot.fecha + 'T00:00:00') : new Date(cot.created_at)
    base.setDate(base.getDate() + (cot.validez_dias ?? 30))
    return base.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  })()

  const empresaCliente = (contacto.empresas as unknown as { nombre: string; nit: string } | null)

  // Color primario del integrador (fallback: verde esmeralda)
  const colorPrimario = (config as any)?.color_primario ?? '#059669'

  return (
    <>
      {/* Botones — solo en pantalla, ocultos al imprimir */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href={`/admin/contactos/${id}/cotizaciones/${cotId}`}
          className="bg-white border border-gray-300 text-gray-600 font-semibold px-5 py-2.5 rounded-lg text-sm shadow-lg hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </a>
      </div>

      {/* Hoja de cotización */}
      <div className="max-w-4xl mx-auto bg-white print:max-w-none print:mx-0" id="cotizacion">
        <style>{`
          /* Quitar headers/footers del navegador (fecha, URL, título) */
          @page {
            size: A4;
            margin: 0;
          }
          /* Padding interno en lugar del margin de @page */
          @media print {
            body  { margin: 0; padding: 0; background: white; }
            .print\\:hidden { display: none !important; }
            #cotizacion { padding: 10mm 8mm; }
          }
        `}</style>

        {/* Banner */}
        {config?.banner_url && (
          <div className="w-full h-36 overflow-hidden">
            <img src={config.banner_url} alt="banner" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Encabezado empresa + datos de cotización */}
        <div className="flex items-start justify-between px-5 pt-6 pb-4 border-b-2 border-gray-200">
          <div className="flex items-center gap-4">
            {config?.logo_url && (
              <img src={config.logo_url} alt="logo" className="h-16 object-contain" />
            )}
            <div>
              <p className="text-lg font-bold text-gray-900">{config?.razon_social ?? profile?.tenant_nombre ?? ''}</p>
              {config?.nit       && <p className="text-xs text-gray-500">NIT: {config.nit}</p>}
              {config?.direccion && <p className="text-xs text-gray-500">{config.direccion}</p>}
              {config?.telefono  && <p className="text-xs text-gray-500">Tel: {config.telefono}</p>}
              {config?.email_comercial && <p className="text-xs text-gray-500">{config.email_comercial}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: colorPrimario }}>COTIZACIÓN</p>
            <p className="text-sm font-mono font-semibold text-gray-700 mt-1">{cot.consecutivo}</p>
            <p className="text-xs text-gray-500 mt-1">Emisión: {fechaEmision}</p>
            <p className="text-xs text-gray-500">Válida hasta: {fechaVence}</p>
            <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
              cot.estado === 'aprobada'  ? 'bg-emerald-100 text-emerald-700' :
              cot.estado === 'enviada'   ? 'bg-blue-100 text-blue-700' :
              cot.estado === 'rechazada' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-600'
            }`}>{cot.estado}</span>
          </div>
        </div>

        {/* Datos del cliente — sin cargo/rol */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cliente</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-gray-800">{contacto.nombre}</p>
              {empresaCliente?.nombre && <p className="text-sm text-gray-600">{empresaCliente.nombre}</p>}
              {empresaCliente?.nit    && <p className="text-xs text-gray-500">NIT: {empresaCliente.nit}</p>}
            </div>
            <div>
              {contacto.email    && <p className="text-sm text-gray-600">{contacto.email}</p>}
              {contacto.telefono && <p className="text-sm text-gray-600">{contacto.telefono}</p>}
            </div>
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="px-5 py-4">
          {/* table-layout:fixed + colgroup garantiza anchos consistentes en pantalla Y en PDF */}
          <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: mostrarDescuento && hayDescuento ? '5%'  : '6%'  }} />
              <col style={{ width: mostrarDescuento && hayDescuento ? '11%' : '12%' }} />
              <col style={{ width: mostrarDescuento && hayDescuento ? '15%' : '17%' }} />
              <col style={{ width: mostrarDescuento && hayDescuento ? '31%' : '35%' }} />
              <col style={{ width: mostrarDescuento && hayDescuento ? '13%' : '15%' }} />
              {mostrarDescuento && hayDescuento && <col style={{ width: '10%' }} />}
              <col style={{ width: mostrarDescuento && hayDescuento ? '15%' : '15%' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-center py-2 pr-2 font-bold text-gray-800">Cant.</th>
                <th className="text-center py-2 px-2 font-bold text-gray-800">Foto</th>
                <th className="text-left py-2 px-3 font-bold text-gray-800">Ref. / Marca</th>
                <th className="text-left py-2 px-3 font-bold text-gray-800">Descripción</th>
                <th className="text-right py-2 px-3 font-bold text-gray-800">Precio unit.</th>
                {mostrarDescuento && hayDescuento && (
                  <th className="text-right py-2 px-2 font-bold text-gray-800">Desc.</th>
                )}
                <th className="text-right py-2 font-bold text-gray-800">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 align-middle">
                  {/* Cantidad */}
                  <td className="py-3 pr-2 text-center font-semibold text-gray-700">{r.cantidad}</td>

                  {/* Foto */}
                  <td className="py-2 px-2 text-center">
                    {r.foto_url ? (
                      <img src={r.foto_url} alt={r.descripcion}
                        className="w-16 h-16 object-contain rounded border border-gray-200 mx-auto" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-50 rounded border border-dashed border-gray-200 mx-auto" />
                    )}
                  </td>

                  {/* Ref. + Marca apilados */}
                  <td className="py-3 px-3 align-middle" style={{ wordBreak: 'break-word' }}>
                    {r.referencia && (
                      <p className="font-mono text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {r.referencia}
                      </p>
                    )}
                    {r.proveedor && (
                      <p className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: colorPrimario }}>
                        {r.proveedor}
                      </p>
                    )}
                  </td>

                  {/* Descripción */}
                  <td className="py-3 px-3 text-xs leading-relaxed text-center" style={{ wordBreak: 'break-word', color: '#374151' }}>
                    {r.descripcion}
                  </td>

                  {/* Precio unit. */}
                  <td className="py-3 px-3 text-right text-gray-700 text-xs whitespace-nowrap">${fmt(r.precio_unitario)}</td>

                  {/* Descuento (solo si mostrarDescuento y hay algún descuento en la cot.) */}
                  {mostrarDescuento && hayDescuento && (
                    <td className="py-3 px-2 text-right text-xs whitespace-nowrap">
                      {r.desc > 0
                        ? <span className="text-red-500 font-semibold">{r.desc}%</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  )}

                  {/* Total neto */}
                  <td className="py-3 text-right font-semibold text-gray-900 text-xs whitespace-nowrap">
                    {mostrarDescuento && r.descMonto > 0 ? (
                      <span style={{ color: colorPrimario }}>${fmt(r.precioTotal)}</span>
                    ) : (
                      <span>${fmt(r.precioTotal)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Subtotal bruto (solo si hay descuentos visibles) */}
              {mostrarDescuento && hayDescuento && (
                <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                  <td colSpan={mostrarDescuento && hayDescuento ? 5 : 4} />
                  <td className="py-1.5 px-3 text-right text-gray-500 text-xs">Subtotal bruto</td>
                  <td className="py-1.5 text-right text-gray-400 text-xs line-through">${fmt(totalBase)}</td>
                </tr>
              )}
              {mostrarDescuento && hayDescuento && (
                <tr>
                  <td colSpan={mostrarDescuento && hayDescuento ? 5 : 4} />
                  <td className="py-1 px-3 text-right text-red-500 text-xs font-semibold">Descuento</td>
                  <td className="py-1 text-right text-red-500 text-xs font-semibold">- ${fmt(totalDescuento)}</td>
                </tr>
              )}
              {/* SUBTOTAL neto — resaltado con color primario */}
              <tr style={{ borderTop: `2px solid ${colorPrimario}` }}>
                <td colSpan={mostrarDescuento && hayDescuento ? 5 : 4} />
                <td className="py-3 px-3 text-right font-bold text-base" style={{ color: colorPrimario }}>SUBTOTAL</td>
                <td className="py-3 text-right font-bold text-xl" style={{ color: colorPrimario }}>${fmt(totalPrecio)}</td>
              </tr>
              <tr>
                <td colSpan={mostrarDescuento && hayDescuento ? 5 : 4} />
                <td className="py-1 px-3 text-right text-gray-500 text-sm">IVA 19%</td>
                <td className="py-1 text-right text-gray-600">${fmt(iva)}</td>
              </tr>
              {/* TOTAL — simple */}
              <tr className="border-t border-gray-300">
                <td colSpan={mostrarDescuento && hayDescuento ? 5 : 4} />
                <td className="py-2 px-3 text-right font-semibold text-gray-700 text-sm">TOTAL</td>
                <td className="py-2 text-right font-semibold text-gray-800">${fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notas + términos */}
        {(cot.notas || config?.terminos) && (
          <div className="px-5 pb-6 grid grid-cols-2 gap-6">
            {cot.notas && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{cot.notas}</p>
              </div>
            )}
            {config?.terminos && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Términos y condiciones</p>
                <p className="text-xs text-gray-500 whitespace-pre-line">{config.terminos}</p>
              </div>
            )}
          </div>
        )}

        {/* Pie de página */}
        <div className="px-5 py-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            {[config?.razon_social, config?.email_comercial, config?.telefono]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </>
  )
}
