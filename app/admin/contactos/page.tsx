import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { eliminarContacto } from '@/app/actions/contactos'
import Link from 'next/link'
import DeleteButton from '@/components/admin/DeleteButton'

interface SearchParams { q?: string; empresa?: string }

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, empresa } = await searchParams
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [contactosQuery, empresasQuery] = await Promise.all([
    supabase
      .from('contactos')
      .select('id, nombre, email, telefono, cargo, activo, created_at, empresas(nombre)')
      .eq('tenant_id', profile?.tenant_id!)
      .order('nombre'),
    supabase
      .from('empresas')
      .select('id, nombre')
      .eq('tenant_id', profile?.tenant_id!)
      .eq('activo', true)
      .order('nombre'),
  ])

  let contactos = contactosQuery.data ?? []

  if (q)       contactos = contactos.filter(c => c.nombre.toLowerCase().includes(q.toLowerCase()) || c.email?.toLowerCase().includes(q.toLowerCase()))
  if (empresa) contactos = contactos.filter(c => (c.empresas as unknown as { nombre: string } | null)?.nombre === empresa)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-sm text-gray-500 mt-1">Clientes de venta/suministro sin acceso al portal.</p>
        </div>
        <Link
          href="/admin/contactos/nuevo"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo contacto
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o correo..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          name="empresa"
          defaultValue={empresa ?? ''}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas las empresas</option>
          {empresasQuery.data?.map(e => (
            <option key={e.id} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          Filtrar
        </button>
        {(q || empresa) && (
          <Link href="/admin/contactos" className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Limpiar
          </Link>
        )}
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Empresa</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Cargo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Correo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contactos.map(c => {
              const empresaNombre = (c.empresas as unknown as { nombre: string } | null)?.nombre
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <Link href={`/admin/contactos/${c.id}`} className="hover:text-emerald-600 transition-colors">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{empresaNombre ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{c.cargo ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{c.telefono ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-4 justify-end">
                      <Link href={`/admin/contactos/${c.id}/cotizaciones/nueva`} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        + Cotizar
                      </Link>
                      <Link href={`/admin/contactos/${c.id}`} className="text-emerald-600 hover:underline text-xs font-medium">
                        Ver
                      </Link>
                      <Link href={`/admin/contactos/${c.id}/editar`} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
                        Editar
                      </Link>
                      <DeleteButton
                        action={eliminarContacto.bind(null, c.id)}
                        confirm={`¿Eliminar el contacto "${c.nombre}"?`}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            {!contactos.length && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                  No hay contactos registrados.{' '}
                  <Link href="/admin/contactos/nuevo" className="text-emerald-600 hover:underline">
                    Crear el primero
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
