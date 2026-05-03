'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function aprobarEtapa(etapaId: string, proyectoId: string) {
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const admin = createAdminClient()

  const { data: proyecto } = await admin
    .from('proyectos')
    .select('cliente_id')
    .eq('id', proyectoId)
    .single()

  if (proyecto?.cliente_id !== user.id) throw new Error('No autorizado')

  const { data: etapa } = await admin
    .from('etapas')
    .select('estado, requiere_aprobacion_cliente, proyecto_id')
    .eq('id', etapaId)
    .single()

  if (etapa?.proyecto_id !== proyectoId) throw new Error('No autorizado')
  if (!etapa.requiere_aprobacion_cliente) throw new Error('Esta etapa no requiere aprobación del cliente')
  if (etapa.estado !== 'completado') throw new Error('La etapa aún no está lista para aprobar')

  const { error } = await admin
    .from('etapas')
    .update({ estado: 'aprobado', updated_at: new Date().toISOString() })
    .eq('id', etapaId)

  if (error) throw new Error(error.message)

  revalidatePath(`/portal/proyectos/${proyectoId}`)
}
