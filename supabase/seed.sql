-- ============================================================
-- SEED DE PRUEBA — Ejecutar DESPUÉS de schema.sql
-- Crea usuarios directamente en public.profiles (sin auth.users).
-- Para pruebas de UI con datos ficticios.
-- ============================================================

-- IDs fijos para facilitar referencias cruzadas
-- Admin
insert into public.profiles (id, nombre, email, rol, empresa, activo)
values (
  '00000000-0000-0000-0000-000000000001',
  'Admin MeetUp',
  'admin@meetupco.com',
  'admin',
  'MeetUp Colombia',
  true
) on conflict (id) do nothing;

-- Cliente 1
insert into public.profiles (id, nombre, email, rol, empresa, telefono, activo)
values (
  '00000000-0000-0000-0000-000000000002',
  'Carlos Pérez',
  'carlos@empresaejemplo.com',
  'cliente',
  'Empresa Ejemplo S.A.S.',
  '+57 310 000 0001',
  true
) on conflict (id) do nothing;

-- Cliente 2
insert into public.profiles (id, nombre, email, rol, empresa, telefono, activo)
values (
  '00000000-0000-0000-0000-000000000003',
  'Laura Gómez',
  'laura@techcorp.co',
  'cliente',
  'TechCorp Colombia',
  '+57 320 000 0002',
  true
) on conflict (id) do nothing;

-- ============================================================
-- PROYECTO DE PRUEBA (cliente: Carlos Pérez)
-- ============================================================
insert into public.proyectos (id, nombre, descripcion, cliente_id, estado, fecha_inicio, fecha_estimada_fin)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Sala de Juntas Torre Empresarial',
  'Instalación de sistema AV completo: pantalla LED, videoconferencia Cisco, control AMX.',
  '00000000-0000-0000-0000-000000000002',
  'activo',
  '2026-04-01',
  '2026-06-30'
) on conflict (id) do nothing;

-- Etapas del proyecto (10 etapas estándar AV)
insert into public.etapas (proyecto_id, nombre, orden, estado, requiere_aprobacion_cliente, fecha_inicio, fecha_fin)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Levantamiento y diagnóstico',       1, 'aprobado',    true,  '2026-04-01', '2026-04-05'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Diseño y propuesta técnica',        2, 'aprobado',    true,  '2026-04-06', '2026-04-12'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Aprobación de planos',              3, 'aprobado',    true,  '2026-04-13', '2026-04-15'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Compra y logística de equipos',     4, 'completado',  false, '2026-04-16', '2026-04-25'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Obra civil / cableado estructurado',5, 'en_progreso', false, '2026-04-26', '2026-05-10'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Instalación de equipos AV',         6, 'pendiente',   false, null,         null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Configuración y programación',      7, 'pendiente',   false, null,         null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Pruebas y ajustes',                 8, 'pendiente',   true,  null,         null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Capacitación al cliente',           9, 'pendiente',   false, null,         null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Entrega y firma de acta',          10, 'pendiente',   true,  null,         null)
on conflict do nothing;

-- Ticket de prueba (del cliente Carlos)
-- El consecutivo lo genera el trigger automáticamente
insert into public.tickets (proyecto_id, cliente_id, titulo, descripcion, prioridad, estado)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Pantalla no enciende en sala de pruebas',
  'Durante las pruebas del día de hoy, la pantalla Samsung 85" no responde al control AMX. Se reinició el sistema y persiste el problema.',
  'alta',
  'abierto'
) on conflict do nothing;
