import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearTicket } from '@/app/actions/tickets'
import Link from 'next/link'

export default async function NuevoTicketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre')
    .eq('cliente_id', user!.id)
    .eq('estado', 'activo')
    .order('nombre')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal/tickets" className="text-gray-400 hover:text-gray-600 text-sm">← Tickets</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo ticket</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <form action={crearTicket} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proyecto relacionado <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              name="proyecto_id"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin proyecto específico</option>
              {proyectos?.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto *</label>
            <input
              name="titulo"
              required
              placeholder="Describe brevemente el problema..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea
              name="descripcion"
              required
              rows={5}
              placeholder="Detalla el problema o consulta. Incluye pasos para reproducirlo si aplica..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                name="ubicacion"
                placeholder="Ej: Sala de juntas 2do piso"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad *</label>
              <select
                name="prioridad"
                defaultValue="media"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              Enviar ticket
            </button>
            <Link
              href="/portal/tickets"
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
