import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CotizacionForm from '@/components/admin/CotizacionForm'

export default async function NuevaCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const [{ data: contacto }, { data: catalogo }] = await Promise.all([
    supabase
      .from('contactos')
      .select('id, nombre, email, empresas(nombre)')
      .eq('id', id)
      .eq('tenant_id', profile?.tenant_id!)
      .single(),
    supabase
      .from('productos')
      .select('id, referencia, proveedor, descripcion, unidad, foto_url')
      .eq('tenant_id', profile?.tenant_id!)
      .eq('activo', true)
      .order('descripcion'),
  ])

  if (!contacto) notFound()

  const empresaNombre = (contacto.empresas as unknown as { nombre: string } | null)?.nombre

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/contactos/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {contacto.nombre}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nueva cotización</h1>
      </div>

      {/* Info del contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Contacto</p>
          <p className="font-semibold text-gray-800">{contacto.nombre}</p>
        </div>
        {empresaNombre && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Empresa</p>
            <p className="text-gray-700">{empresaNombre}</p>
          </div>
        )}
        {contacto.email && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Correo</p>
            <p className="text-gray-700">{contacto.email}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CotizacionForm
          contactoId={id}
          contactoNombre={contacto.nombre}
          catalogo={catalogo ?? []}
        />
      </div>
    </div>
  )
}
