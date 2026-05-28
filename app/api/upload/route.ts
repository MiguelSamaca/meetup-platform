import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile || !profile.tenant_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const tipo     = formData.get('tipo') as string // 'logo' | 'banner' | 'producto'

  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!tiposPermitidos.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }

  const isPdf  = file.type === 'application/pdf'
  const ext    = isPdf ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
  const buffer = Buffer.from(await file.arrayBuffer())

  // Ruta en el bucket
  const path = tipo === 'logo' || tipo === 'banner'
    ? `${profile.tenant_id}/${tipo}.${ext}`
    : tipo === 'gasto'
    ? `${profile.tenant_id}/gastos/${Date.now()}.${ext}`
    : `${profile.tenant_id}/productos/${Date.now()}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('avcore-assets')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from('avcore-assets')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
