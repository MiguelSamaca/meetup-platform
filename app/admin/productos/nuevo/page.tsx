import { crearProducto } from '@/app/actions/productos'
import Link from 'next/link'
import ProductoForm from '@/components/admin/ProductoForm'

export default function NuevoProductoPage() {
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/productos" className="text-gray-400 hover:text-gray-600 text-sm">← Productos</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ProductoForm action={crearProducto} mode="nuevo" />
      </div>
    </div>
  )
}
