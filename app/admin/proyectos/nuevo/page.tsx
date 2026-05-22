import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { crearProyecto } from '@/app/actions/proyectos'
import Link from 'next/link'

export default async function NuevoProyectoPage() {
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: empresas }, { data: clientes }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, nombre')
      .eq('tenant_id', profile?.tenant_id!)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('profiles')
      .select('id, nombre, empresa_id')
      .eq('tenant_id', profile?.tenant_id!)
      .eq('rol', 'cliente')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/proyectos" className="text-gray-400 hover:text-gray-600 text-sm">← Proyectos</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo proyecto</h1>
      </div>

      {!empresas?.length && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Atención:</strong> No hay empresas registradas.{' '}
          <Link href="/admin/empresas/nueva" className="underline font-medium">
            Crea una empresa primero
          </Link>{' '}
          antes de crear proyectos.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-6">
          Se crearán automáticamente las <strong>10 etapas estándar AV</strong> al guardar.
        </p>

        <form action={crearProyecto} className="space-y-5">
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
            <p className="text-xs text-gray-400 mt-1">
              El proyecto quedará restringido a los usuarios de esta empresa.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
            <input
              name="nombre"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Sala de Juntas Torre Empresarial"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Descripción del alcance del proyecto..."
            />
          </div>

          {/* Contacto principal (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto principal</label>
            <select
              name="cliente_id"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin asignar</option>
              {clientes?.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Opcional. Todos los usuarios de la empresa podrán ver el proyecto.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              name="estado"
              defaultValue="activo"
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada de entrega</label>
              <input
                name="fecha_estimada_fin"
                type="date"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!empresas?.length}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Crear proyecto
            </button>
            <Link
              href="/admin/proyectos"
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
