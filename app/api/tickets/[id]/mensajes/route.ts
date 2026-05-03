import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('ticket_mensajes')
    .select('*, profiles(nombre, rol)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}
