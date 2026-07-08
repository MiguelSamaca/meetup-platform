# CollabOS — Etapa 1: Flujo de trabajo y plan de desarrollo

> Integración local con dispositivos Logitech vía **Local Network Access (LNA)**.
> Proveedor: MeetUp Colombia / AV CORE · Julio 2026 · v1.0
> Complementa la integración nube-a-nube (Sync Cloud API) ya existente.

---

## 1. Qué es y por qué

La **Sync Cloud API** (ya construida) da inventario y estado general desde la nube de Logitech.
La **API local de CollabOS (LNA)** da datos **en tiempo real, directo del dispositivo** en la red del cliente: estado detallado, salud, red, y —en etapas posteriores— control local.

Como la LNA exige que **quien consulta esté en la misma subred que el dispositivo**, se requiere un **agente local**: un pequeño programa que corre en un equipo dentro de la red del cliente, lee el estado de cada dispositivo y lo envía de forma **saliente** a AV CORE en la nube.

---

## 2. Alcance de la Etapa 1

| ✅ En alcance (Etapa 1) | ⛔ Fuera de alcance (Etapa 2+) |
|---|---|
| Monitoreo de **solo lectura** vía LNA `/status` | Control remoto (reiniciar, silenciar, actualizar firmware) |
| Piloto en **1–2 salas** del cliente | Despliegue masivo a todas las salas |
| Agente local + envío seguro a la nube | Alta disponibilidad / redundancia del agente |
| Reutilización del dashboard de Salas existente | Automatizaciones y alertas avanzadas |

> Elegimos **solo lectura** en la Etapa 1 a propósito: entrega valor (visibilidad en tiempo real) con la **mínima superficie de riesgo**, lo que facilita la aprobación del equipo de ciberseguridad.

---

## 3. Arquitectura y flujo de datos

```
   RED DEL CLIENTE (misma subred que las salas)          NUBE
   ┌────────────────────────────────────────┐     ┌──────────────────────┐
   │  Agente local AV CORE (Node.js)         │     │   AV CORE (Vercel)   │
   │  corre en un host del cliente           │ ──▶ │  Endpoint de ingesta │
   │                                         │HTTPS│  (autenticado)       │
   │   │ HTTPS local + token (LNA)           │ sal.└──────────┬───────────┘
   │   ▼                                     │                │
   │  GET https://<ip-dispositivo>/status   │                ▼
   │   ├─ Rally Bar                          │     ┌──────────────────────┐
   │   ├─ Tap IP                             │     │  Supabase (Postgres) │
   │   └─ ...                                │     │  mismas tablas salas │
   └────────────────────────────────────────┘     └──────────────────────┘
```

**Sentido de las conexiones:**
- Agente → dispositivos: **HTTPS local**, dentro de la subred, autenticado por token LNA.
- Agente → AV CORE nube: **HTTPS saliente**, autenticado (API key / mTLS).
- **Entrante a la red del cliente desde internet: NINGUNA.** El agente solo hace conexiones salientes.

---

## 4. Componentes a desarrollar

| # | Componente | Descripción | ¿Nuevo? |
|---|---|---|---|
| C1 | **Agente local** | Servicio Node.js que corre en la red del cliente; lee `/status` de cada dispositivo y envía a la nube. | Nuevo |
| C2 | **Endpoint de ingesta** | Ruta en AV CORE que recibe los datos del agente, autenticada, y los guarda. | Nuevo |
| C3 | **Autenticación agente↔nube** | API key por cliente/agente (o mTLS), rotable. | Nuevo |
| C4 | **Almacenamiento** | Reutiliza tablas `logitech_devices` / `logitech_device_snapshots` (ya existen; marcamos origen = `collabos`). | Existente |
| C5 | **Visualización** | Reutiliza el dashboard de Salas (`/admin/rooms`). Los datos del agente aparecen ahí. | Existente |
| C6 | **Config LNA** | Campos `lna_user` / `lna_pass` por dispositivo (ya existen en el esquema). | Existente |

> Ventaja clave: **el dashboard y la base de datos ya están listos**. La Etapa 1 es sobre todo el **agente** y el **canal seguro de ingesta**.

---

## 5. Flujo de trabajo de desarrollo (fases y tareas)

### F0 · Prerrequisitos (cliente + coordinación)
- [ ] Cliente **habilita LNA en cada dispositivo** piloto (se hace por dispositivo).
- [ ] Cliente **cambia la contraseña por defecto** de LNA (obligatorio en <48h o se auto-deshabilita).
- [ ] Cliente designa un **host** en la subred de las salas para el agente (o VM).
- [ ] Acuerdo de **credenciales LNA** y su custodia.

### F1 · Agente MVP (lectura de 1 dispositivo)
- [ ] Autenticación LNA: usuario/contraseña → token de sesión.
- [ ] `GET /status` de un dispositivo; parsear la respuesta.
- [ ] Imprimir el estado en consola (validación local).

### F2 · Canal de ingesta a la nube
- [ ] Endpoint de ingesta en AV CORE (autenticado con API key por cliente).
- [ ] El agente envía el estado (HTTPS saliente) cada N minutos.
- [ ] Guardar en `logitech_device_snapshots` marcando origen `collabos`.

### F3 · Multi-dispositivo + resiliencia
- [ ] Recorrer varios dispositivos de una o dos salas.
- [ ] Reintentos, manejo de dispositivo offline, y colas si no hay internet.
- [ ] Configuración por archivo (lista de dispositivos + credenciales).

### F4 · Seguridad y empaquetado
- [ ] Almacenamiento seguro de credenciales (no texto plano) + rotación.
- [ ] Registro (logs) de cada ciclo: éxito/fallo, conteos, errores.
- [ ] Empaquetar como **servicio** (arranque automático) para el host del cliente.

### F5 · Piloto en sitio + validación
- [ ] Instalar en el host del cliente; validar contra 1–2 salas reales.
- [ ] Verificar datos en el dashboard de Salas.
- [ ] Documentar y firmar el checklist de validación de seguridad.

---

## 6. Seguridad (para la revisión de ciberseguridad)

| Control | Cómo se cumple en Etapa 1 |
|---|---|
| **Sin conectividad entrante** | El agente solo hace conexiones **salientes** (a los dispositivos en LAN y a la nube). No abre puertos hacia internet. |
| **Solo lectura** | Únicamente `GET /status`. Sin comandos de control. |
| **Autenticación a dispositivos** | Token LNA por sesión; credenciales cambiadas de las de fábrica. |
| **Autenticación a la nube** | API key por cliente/agente (o mTLS), rotable y revocable. |
| **Cifrado en tránsito** | HTTPS en ambos tramos (agente↔dispositivo y agente↔nube). |
| **Mínimo privilegio del host** | Host dedicado, sin otros servicios; idealmente en la **VLAN de AV/salas**. |
| **Custodia de credenciales** | Almacenamiento cifrado en el agente y en la nube; rotación periódica. |
| **Trazabilidad** | Registro de cada ciclo y alertas de fallo (visibilidad para el cliente). |
| **Segmentación de red** | Recomendado: subred/VLAN dedicada de salas; 802.1x; certificado de servidor LNA. |

---

## 7. Requisitos y responsabilidades del cliente

1. Habilitar LNA en los dispositivos piloto y cambiar contraseñas por defecto.
2. Proveer un **host** (PC/VM) en la subred de las salas para el agente.
3. Permitir **egreso HTTPS** desde ese host hacia AV CORE.
4. Definir la **VLAN/segmento** donde vivirán agente y dispositivos.
5. Acordar custodia y rotación de credenciales LNA.

---

## 8. Qué presentar en la reunión

1. **El objetivo:** visibilidad en tiempo real de las salas, empezando por 1–2 como piloto.
2. **El flujo (sección 3):** agente local de solo lectura, todo saliente, sin puertos entrantes.
3. **Los controles (sección 6):** para que su equipo valide autenticación, exposición y trazabilidad.
4. **Lo que necesitamos de ellos (sección 7).**
5. **El plan por fases (sección 5)** con el piloto como primer hito medible.

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Credenciales LNA comprometidas | Rotación, custodia cifrada, cambio del default, solo lectura |
| Host del agente comprometido | Host dedicado, hardening, segmentación, egreso restringido |
| LNA se auto-deshabilita (regla 48h / 10 intentos) | Documentar el procedimiento; el agente alerta si pierde acceso |
| Datos sensibles (IP/MAC, uso de salas) | Mínimo dato necesario; cifrado; política de retención acordada |
| Dependencia de red del cliente | Reintentos + cola local; el agente tolera cortes de internet |

---

## 10. Próximos pasos inmediatos

1. Validar con el cliente el **alcance Etapa 1** (solo lectura, 1–2 salas piloto).
2. Confirmar prerrequisitos (sección 7) en la reunión de seguridad.
3. Arrancar **F1 (agente MVP)** una vez aprobada la conectividad.
