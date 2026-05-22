import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { crearCliente } from '@/app/actions/clientes'
import Link from 'next/link'

export default async function NuevoClientePage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tenant_id', profile?.tenant_id!)
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/clientes" className="text-gray-400 hover:text-gray-600 text-sm">← Clientes</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo cliente</h1>
      </div>

      {!empresas?.length && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Atención:</strong> No hay empresas registradas.{' '}
          <Link href="/admin/empresas/nueva" className="underline font-medium">
            Crea una empresa primero
          </Link>{' '}
          antes de añadir clientes.
        </div>
      )}

      <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>Cliente con acceso al portal</strong> — Podrá iniciar sesión, ver sus proyectos y crear tickets.
        Si solo necesitas registrar datos sin acceso al sistema,{' '}
        <Link href="/admin/contactos/nuevo" className="underline font-medium">
          crea un contacto de venta
        </Link>.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={crearCliente} className="space-y-5">
          {/* Empresa — obligatorio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
            <select
              name="empresa_id"
              required
              disabled={!empresas?.length}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Selecciona una empresa</option>
              {empresas?.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                name="nombre"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                name="telefono"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+57 310 000 0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="juan@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial *</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-3">El cliente podrá cambiar su contraseña después.</p>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!empresas?.length}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Crear cliente
            </button>
            <Link
              href="/admin/clientes"
              className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
