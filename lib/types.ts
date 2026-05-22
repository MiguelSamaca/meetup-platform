export type Rol = 'superadmin' | 'admin' | 'cliente'

export interface Tenant {
  id: string
  nombre: string
  slug: string | null
  plan: 'basico' | 'profesional' | 'enterprise'
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Empresa {
  id: string
  nombre: string
  nit: string | null
  telefono: string | null
  direccion: string | null
  tenant_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  nombre: string
  email: string
  rol: Rol
  empresa: string | null      // campo texto legado
  empresa_id: string | null   // FK a empresas (clientes)
  tenant_id: string | null    // FK a tenants (admins y clientes, null = superadmin)
  telefono: string | null
  activo: boolean
  created_at: string
}

export interface Proyecto {
  id: string
  nombre: string
  descripcion: string | null
  cliente_id: string | null
  empresa_id: string
  tenant_id: string
  estado: 'activo' | 'pausado' | 'completado' | 'cancelado'
  fecha_inicio: string | null
  fecha_estimada_fin: string | null
  created_at: string
  updated_at: string
}

export interface Etapa {
  id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  orden: number
  estado: 'pendiente' | 'en_progreso' | 'completado' | 'aprobado'
  requiere_aprobacion_cliente: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Evidencia {
  id: string
  etapa_id: string
  nombre: string
  url: string
  storage_path: string | null
  tipo: string | null
  subido_por: string | null
  created_at: string
}

export interface Ticket {
  id: string
  consecutivo: string
  proyecto_id: string | null
  cliente_id: string | null
  tenant_id: string
  titulo: string
  descripcion: string
  ubicacion: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  estado: 'abierto' | 'en_revision' | 'en_campo' | 'resuelto' | 'cerrado'
  created_at: string
  updated_at: string
}

export interface TicketMensaje {
  id: string
  ticket_id: string
  autor_id: string | null
  mensaje: string
  leido: boolean
  created_at: string
}
