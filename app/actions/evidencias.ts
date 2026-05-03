'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function subirEvidencia(etapaId: string, proyectoId: string, formData: FormData) {
  const file = formData.get('archivo') as File
  if (!file || file.size === 0) throw new Error('No se seleccionó archivo')

  const admin = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${etapaId}/${Date.now()}_${safeName}`

  const { error: uploadError } = await admin.storage
    .from('evidencias')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('evidencias').getPublicUrl(storagePath)

  const { error } = await admin.from('evidencias').insert({
    etapa_id: etapaId,
    nombre: file.name,
    url: publicUrl,
    storage_path: storagePath,
    tipo: file.type || null,
  })

  if (error) {
    await admin.storage.from('evidencias').remove([storagePath])
    throw new Error(error.message)
  }

  revalidatePath(`/admin/proyectos/${proyectoId}`)
}

export async function eliminarEvidencia(evidenciaId: string, storagePath: string, proyectoId: string) {
  const admin = createAdminClient()

  if (storagePath) {
    await admin.storage.from('evidencias').remove([storagePath])
  }

  const { error } = await admin.from('evidencias').delete().eq('id', evidenciaId)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/proyectos/${proyectoId}`)
}
