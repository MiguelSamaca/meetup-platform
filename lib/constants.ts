export const ETAPAS_AV_CATALOGO = [
  { orden: 1,  nombre: 'Levantamiento y diagnóstico',        requiere_aprobacion_cliente: true  },
  { orden: 2,  nombre: 'Diseño y propuesta técnica',         requiere_aprobacion_cliente: true  },
  { orden: 3,  nombre: 'Aprobación de planos',               requiere_aprobacion_cliente: true  },
  { orden: 4,  nombre: 'Compra y logística de equipos',      requiere_aprobacion_cliente: false },
  { orden: 5,  nombre: 'Obra civil / cableado estructurado', requiere_aprobacion_cliente: false },
  { orden: 6,  nombre: 'Instalación de equipos AV',          requiere_aprobacion_cliente: false },
  { orden: 7,  nombre: 'Configuración y programación',       requiere_aprobacion_cliente: false },
  { orden: 8,  nombre: 'Pruebas y ajustes',                  requiere_aprobacion_cliente: true  },
  { orden: 9,  nombre: 'Capacitación al cliente',            requiere_aprobacion_cliente: false },
  { orden: 10, nombre: 'Entrega y firma de acta',            requiere_aprobacion_cliente: true  },
] as const

export const ESTADO_PROYECTO_LABEL: Record<string, string> = {
  activo:     'Activo',
  pausado:    'Pausado',
  completado: 'Completado',
  cancelado:  'Cancelado',
}

export const ESTADO_ETAPA_LABEL: Record<string, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completado:   'Completado',
  aprobado:     'Aprobado',
}

export const PRIORIDAD_TICKET_LABEL: Record<string, string> = {
  baja:    'Baja',
  media:   'Media',
  alta:    'Alta',
  critica: 'Crítica',
}

export const ESTADO_TICKET_LABEL: Record<string, string> = {
  abierto:     'Abierto',
  en_revision: 'En revisión',
  en_campo:    'En campo',
  resuelto:    'Resuelto',
  cerrado:     'Cerrado',
}
