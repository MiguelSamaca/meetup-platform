import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile }  from '@/lib/auth'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import MovimientosManager     from '@/components/admin/finanzas/MovimientosManager'

export const metadata = { title: 'Movimientos | Finanzas' }

export default async function MovimientosPage() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) redirect('/login')
  if (profile.rol !== 'admin') redirect('/admin')

  const admin = createAdminClient()
  const tid   = profile.tenant_id

  const [{ data: cuentas }, { data: categorias }, { data: proyectos }, { data: movimientos }] =
    await Promise.all([
      admin.from('cuentas')
        .select('id, nombre, tipo, saldo_inicial')
        .eq('tenant_id', tid).eq('activo', true).order('created_at'),
      admin.from('movimiento_categorias')
        .select('id, nombre, clase')
        .eq('tenant_id', tid).eq('activo', true).order('nombre'),
      admin.from('proyectos')
        .select('id, nombre')
        .eq('tenant_id', tid).order('created_at', { ascending: false }),
      admin.from('movimientos')
        .select('id, fecha, tipo, monto, concepto, clasificacion, recurrente, cuenta_id, categoria_id, proyecto_id, orden_ejecucion_id')
        .eq('tenant_id', tid).order('fecha', { ascending: false }).limit(300),
    ])

  /* Ventas directas (órdenes sin etapa de proyecto) con su cliente */
  const { data: oesDirectas } = await admin
    .from('ordenes_ejecucion')
    .select('id, consecutivo, contacto_id')
    .eq('tenant_id', tid).eq('tipo_venta', 'directa')
    .order('created_at', { ascending: false })

  const contactoIds = [...new Set((oesDirectas ?? []).map(o => o.contacto_id).filter(Boolean))]
  const { data: contactos } = contactoIds.length > 0
    ? await admin.from('contactos').select('id, nombre').in('id', contactoIds)
    : { data: [] }
  const nombrePorContacto = new Map((contactos ?? []).map(c => [c.id, c.nombre]))
  const ventas = (oesDirectas ?? []).map(o => ({
    id:     o.id,
    label:  `${nombrePorContacto.get(o.contacto_id ?? '') ?? 'Cliente'} — ${o.consecutivo}`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Movimientos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registra entradas y salidas de tus cuentas, clasifícalas y asígnalas a proyectos.
          </p>
        </div>
        <Link href="/admin/finanzas" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Finanzas
        </Link>
      </div>

      <MovimientosManager
        cuentas={cuentas ?? []}
        categorias={categorias ?? []}
        proyectos={proyectos ?? []}
        ventas={ventas}
        movimientos={movimientos ?? []}
      />
    </div>
  )
}
