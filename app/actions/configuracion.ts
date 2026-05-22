'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

export async function guardarConfiguracion(formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin' || !profile.tenant_id) {
    throw new Error('No autorizado')
  }

  const admin = createAdminClient()

  const data = {
    tenant_id:       profile.tenant_id,
    razon_social:    (formData.get('razon_social') as string)?.trim() || null,
    nit:             (formData.get('nit') as string)?.trim() || null,
    direccion:       (formData.get('direccion') as string)?.trim() || null,
    telefono:        (formData.get('telefono') as string)?.trim() || null,
    email_comercial: (formData.get('email_comercial') as string)?.trim() || null,
    terminos:        (formData.get('terminos') as string)?.trim() || null,
    logo_url:        (formData.get('logo_url') as string)?.trim() || null,
    banner_url:      (formData.get('banner_url') as string)?.trim() || null,
    color_primario:  (formData.get('color_primario') as string)?.trim() || '#059669',
    updated_at:      new Date().toISOString(),
  }

  const { error } = await admin
    .from('tenant_config')
    .upsert(data, { onConflict: 'tenant_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/configuracion')
}
