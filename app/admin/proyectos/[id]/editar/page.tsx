import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { actualizarProyecto } from '@/app/actions/proyectos'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function EditarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = await params
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: proyecto }, { data: empresas }, { data: clientes }] = await Promise.all([
    supabase.from('proyectos').select('*').eq('id', id).eq('tenant_id', profile?.tenant_id!).single(),
    supabase.from('empresas').select('id, nombre').eq('tenant_id', profile?.tenant_id!).eq('activo', true).order('nombre'),
    supabase.from('profiles').select('id, nombre, empresa_id').eq('tenant_id', profile?.tenant_id!).eq('rol', 'cliente').eq('activo', true).order('nombre'),
  ])

  if (!proyecto) notFound()

  const action = actualizarProyecto.bind(null, id)

  // Filtrar clientes de la empresa seleccionada
  const clientesDeEmpresa = clientes?.filter(c => c.empresa_id === proyecto.empresa_id) ?? []

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/proyectos/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Proyecto</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar proyecto</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={action} className="space-y-5">
          {/* Empresa — obligatorio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
            <select
              name="empresa_id"
              required
              defaultValue={proyecto.empresa_id ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecciona una empresa</option>
              {empresas?.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
            <input
              name="nombre"
              required
              defaultValue={proyecto.nombre}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              rows={3}
              defaultValue={proyecto.descripcion ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Contacto principal (opcional, filtrado por empresa) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto principal</label>
            <select
              name="cliente_id"
              defaultValue={proyecto.cliente_id ?? ''}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin asignar</option>
              {clientesDeEmpresa.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              {/* Si hay un cliente asignado de otra empresa, mostrarlo para no perder datos */}
              {proyecto.cliente_id &&
                !clientesDeEmpresa.find(c => c.id === proyecto.cliente_id) &&
                clientes?.find(c => c.id === proyecto.cliente_id) && (
                  <option value={proyecto.cliente_id}>
                    {clientes?.find(c => c.id === proyecto.cliente_id)?.nombre} (otra empresa)
                  </option>
                )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              name="estado"
              defaultValue={proyecto.estado}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
              <input
                name="fecha_inicio"
                type="date"
                defaultValue={proyecto.fecha_inicio ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada de entrega</label>
              <input
                name="fecha_estimada_fin"
                type="date"
                defaultValue={proyecto.fecha_estimada_fin ?? ''}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Guardar cambios
            </button>
            <Link
              href={`/admin/proyectos/${id}`}
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
