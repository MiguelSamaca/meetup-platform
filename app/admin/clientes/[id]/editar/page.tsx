import { createAdminClient } from '@/lib/supabase/admin'
import { editarCliente } from '@/app/actions/clientes'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: cliente } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const action = editarCliente.bind(null, id)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/clientes" className="text-gray-400 hover:text-gray-600 text-sm">← Clientes</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar cliente</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={action} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                name="nombre"
                required
                defaultValue={cliente.nombre}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <input
                name="empresa"
                defaultValue={cliente.empresa ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                value={cliente.email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">El correo no se puede cambiar.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                name="telefono"
                defaultValue={cliente.telefono ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              name="activo"
              defaultValue={cliente.activo ? 'true' : 'false'}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Guardar cambios
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
