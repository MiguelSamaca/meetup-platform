import { createAdminClient }    from '@/lib/supabase/admin'
import { getCurrentProfile }    from '@/lib/auth'
import Link                     from 'next/link'
import GastosFijosManager       from '@/components/admin/finanzas/GastosFijosManager'

export default async function GastosFijosPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const tid      = profile?.tenant_id!

  const { data: gastos } = await supabase
    .from('gastos_fijos')
    .select('id, nombre, monto, categoria, activo, created_at')
    .eq('tenant_id', tid)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/finanzas" className="text-gray-400 hover:text-gray-600 text-sm">← Finanzas</Link>
            <span className="text-gray-300">/</span>
            <Link href="/admin/finanzas/flujo" className="text-gray-400 hover:text-gray-600 text-sm">Flujo de caja</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos fijos mensuales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura tus gastos recurrentes — se descuentan automáticamente en la proyección del flujo de caja
          </p>
        </div>
      </div>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <strong>¿Qué son los gastos fijos?</strong> Son tus costos operativos mensuales recurrentes que siempre
        debes cubrir: sueldo, celular, transporte, contabilidad, marketing, arriendo de oficina, etc.
        Al agregarlos aquí, el flujo de caja los descuenta automáticamente mes a mes para que veas
        tu caja real proyectada.
      </div>

      <GastosFijosManager gastos={gastos ?? []} />
    </div>
  )
}
