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
        .select('id, fecha, tipo, monto, concepto, clasificacion, recurrente, cuenta_id, categoria_id, proyecto_id')
        .eq('tenant_id', tid).order('fecha', { ascending: false }).limit(300),
    ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimientos</h1>
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
        movimientos={movimientos ?? []}
      />
    </div>
  )
}
