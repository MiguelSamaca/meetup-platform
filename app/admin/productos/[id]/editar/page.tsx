import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { editarProducto } from '@/app/actions/productos'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ProductoForm from '@/components/admin/ProductoForm'

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = await params
  const profile  = await getCurrentProfile()
  const supabase = createAdminClient()

  const { data: producto } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile?.tenant_id!)
    .single()

  if (!producto) notFound()

  const action = editarProducto.bind(null, id)

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/productos" className="text-gray-400 hover:text-gray-600 text-sm">← Productos</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar producto</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ProductoForm
          action={action}
          mode="editar"
          defaultValues={{
            descripcion: producto.descripcion,
            unidad:      producto.unidad ?? 'und',
            referencia:  producto.referencia ?? '',
            proveedor:   producto.proveedor ?? '',
            foto_url:    (producto as any).foto_url ?? '',
            activo:      producto.activo,
          }}
        />
      </div>
    </div>
  )
}
