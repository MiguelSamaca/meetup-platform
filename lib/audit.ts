/**
 * lib/audit.ts
 * Utilidad para registrar eventos de auditoría.
 * Siempre usa el admin client (service role) para saltar RLS.
 * Fire-and-forget: nunca bloquea la acción principal si falla.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAccion =
  | 'login'
  | 'login_fallido'
  | 'logout'
  | 'crear_cotizacion'
  | 'editar_cotizacion'
  | 'eliminar_cotizacion'
  | 'crear_producto'
  | 'editar_producto'
  | 'crear_contacto'
  | 'editar_contacto'
  | 'crear_empresa'
  | 'editar_empresa'
  | 'crear_proyecto'
  | 'editar_proyecto'
  | 'crear_ticket'
  | 'responder_ticket'
  | 'cambiar_estado_ticket'
  | 'subir_imagen'
  | 'crear_cliente'
  | 'editar_cliente'
  | 'crear_admin'
  | 'suspender_tenant'
  | 'activar_tenant'
  | 'crear_orden_ejecucion'
  | 'completar_orden_ejecucion'

interface AuditParams {
  tenantId?:   string | null
  userId?:     string | null
  userEmail?:  string | null
  userNombre?: string | null
  accion:      AuditAccion
  entidad?:    string
  entidadId?:  string
  detalles?:   Record<string, unknown>
  resultado?:  'exito' | 'error'
  errorMsg?:   string
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      tenant_id:   params.tenantId   ?? null,
      user_id:     params.userId     ?? null,
      user_email:  params.userEmail  ?? null,
      user_nombre: params.userNombre ?? null,
      accion:      params.accion,
      entidad:     params.entidad    ?? null,
      entidad_id:  params.entidadId  ?? null,
      detalles:    params.detalles   ?? null,
      resultado:   params.resultado  ?? 'exito',
      error_msg:   params.errorMsg   ?? null,
    })
  } catch {
    // Silencioso: el log nunca debe romper la acción principal
    console.error('[audit] Error escribiendo log:', params.accion)
  }
}
