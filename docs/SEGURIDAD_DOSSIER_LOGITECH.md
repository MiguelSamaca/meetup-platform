# Dossier de Seguridad — Dashboard de Monitoreo de Salas Logitech

> Documento para revisión del equipo de Ciberseguridad del cliente.
> Proveedor: MeetUp Colombia · Fecha: Julio 2026 · Versión 1.0
> Objetivo: describir arquitectura, flujos, controles y trazabilidad de la
> integración, y acordar las validaciones para aprobar la conectividad.

---

## 0. Resumen ejecutivo (para decisores)

- La integración principal es **nube-a-nube**: la plataforma consumirá la **Logitech Sync Cloud API** mediante peticiones **HTTPS salientes con autenticación mutua (mTLS)**.
- **No requiere abrir ningún puerto entrante hacia la red del cliente.** No hay agentes ni escaneo dentro de la LAN del cliente en este modelo.
- La autenticación se basa en un **certificado que el cliente genera y controla** desde su propio portal Logitech Sync, y que **puede revocar en cualquier momento**.
- Las operaciones son de **solo lectura** (inventario y estado de salas). la plataforma **no controla ni reconfigura** dispositivos por este canal.
- Se suma en **Etapa 1** un segundo componente: un **agente local CollabOS (LNA)** que corre **dentro de la red del cliente** para leer el estado de los dispositivos en tiempo real. Es de **solo lectura**, hace **únicamente conexiones salientes** (no abre puertos entrantes) y se despliega como **piloto en 1–2 salas**. Su diseño detallado está en `COLLABOS_ETAPA1.md` y **sí se somete a esta revisión**.

---

## 1. Alcance

| En alcance (esta revisión) | Fuera de alcance (Etapa 2+) |
|---|---|
| **Sync Cloud API** (nube-a-nube, mTLS, solo lectura) | Control local de dispositivos (reiniciar, silenciar, firmware) |
| **Agente CollabOS / LNA** (local, solo lectura, piloto 1–2 salas) — ver `COLLABOS_ETAPA1.md` | Despliegue masivo a todas las salas |
| Lectura de inventario y estado de salas/dispositivos | Alta disponibilidad / redundancia del agente |
| Almacenamiento de metadatos y telemetría de estado | — |

---

## 2. Arquitectura y flujos de comunicación

### 2.1 Modelo VIGENTE — Sync Cloud API (nube-a-nube)

```
   ┌──────────────────────┐        HTTPS 443 / mTLS        ┌────────────────────────┐
   │   la plataforma (nube)      │  ───────────────────────────▶ │  Logitech Sync Cloud   │
   │   Vercel serverless   │      GET /places, /devices     │  (api.sync.logitech)   │
   │                       │  ◀─────────────────────────── │                        │
   └──────────┬───────────┘        JSON (solo lectura)      └───────────┬────────────┘
              │                                                          │
              │ HTTPS 443                                                │  (los equipos Logitech
              ▼                                                          ▼   ya reportan a la nube
   ┌──────────────────────┐                                  ┌────────────────────────┐
   │  Supabase (Postgres) │                                  │  Salas del cliente      │
   │  metadatos + estado  │                                  │  Rally Bar, Tap, etc.   │
   └──────────────────────┘                                  └────────────────────────┘
```

**Puntos clave del flujo:**
1. Los dispositivos Logitech del cliente **ya reportan su estado a la nube de Logitech** (es el funcionamiento normal de Sync). la plataforma **no** habla con los dispositivos.
2. la plataforma inicia conexiones **salientes** hacia la nube de Logitech (nunca al revés).
3. La sincronización se dispara por un **cron programado** (1 vez/día en el plan actual) y opcionalmente de forma **manual** por un administrador autenticado.
4. Los datos se guardan en Supabase (PostgreSQL gestionado).

**Sentido de las conexiones (importante para su firewall):**
- **Entrante a la red del cliente:** NINGUNA.
- **Saliente desde los equipos del cliente:** solo la que Logitech Sync ya requiere hoy (dispositivos → nube Logitech). No cambia con esta integración.
- **la plataforma → Logitech:** saliente, 443, mTLS.

### 2.2 Modelo ETAPA 1 — Agente CollabOS / LNA en la red del cliente

```
   ┌────────────────────────┐   HTTPS saliente       ┌──────────────────┐
   │  Agente local la plataforma   │ ─────────────────────▶ │  la plataforma (nube)  │
   │  (host en subred salas) │   (API key / mTLS)     └──────────────────┘
   │                         │
   │   │ HTTPS local + token (LNA)
   │   ▼                     │
   │  GET https://<ip>/status  (solo lectura)
   │   Dispositivos Logitech en la MISMA subred
   └─────────────────────────┘
```

- Un host dedicado en la subred de las salas ejecuta el agente, con comunicación **local** a los dispositivos (HTTPS + token LNA) y **egreso HTTPS** hacia la plataforma.
- **Este modelo sí toca la red interna**, por eso se rige por controles adicionales (segmentación/VLAN, hardening del host, mínimo privilegio, custodia de credenciales) descritos en `COLLABOS_ETAPA1.md`, sección 6.
- **Solo lectura** (`/status`), **sin conectividad entrante** desde internet, y desplegado como **piloto en 1–2 salas**. Su aprobación **sí forma parte de esta sesión**.

---

## 3. Autenticación y control de acceso

| Capa | Mecanismo |
|---|---|
| la plataforma ↔ Logitech | **mTLS** (TLS mutuo). Certificado cliente `certificate.pem` + llave `privateKey.pem` **generados por el cliente en su portal Sync** y revocables por él. |
| Endpoint de sincronización programada | Protegido por **secreto Bearer** (`CRON_SECRET`); rechaza toda llamada sin el token (HTTP 401). |
| Usuarios de la plataforma | Autenticación gestionada con **control de acceso por roles** (mínimo privilegio). |
| Acceso a configuración de certificados | Solo `admin`/`superadmin`. Los certificados se **escriben pero nunca se muestran** de vuelta en la interfaz. |
| Aislamiento multi-cliente | Toda consulta está segmentada por `tenant_id`; RLS habilitado en las tablas. |

**Fortalezas de este diseño para el cliente:**
- El cliente **es dueño de la llave de acceso**: revoca el certificado en su portal y corta el acceso al instante, sin depender de nosotros.
- Operaciones **solo de lectura** por Cloud API: no hay superficie para reconfigurar o apagar dispositivos.
- El certificado puede limitarse a **mínimo privilegio** (scope de solo lectura) según lo permita el portal Sync.

---

## 4. Datos: qué se lee, qué se almacena y dónde

### 4.1 Datos tratados
| Categoría | Ejemplos | Sensibilidad |
|---|---|---|
| Inventario | nombre de sala, modelo, serial, versión de firmware | Media |
| Identificadores de red | dirección IP, dirección MAC del dispositivo | **Alta** (reconocimiento) |
| Estado/telemetría | online/offline, temperatura, humedad, estado de llamada | Media (privacidad de uso) |
| Garantía | estado y fecha de vencimiento | Baja |

### 4.2 Dónde residirán
- **Base de datos:** PostgreSQL gestionado (Supabase). La **región se definirá con el cliente** según sus requisitos de residencia de datos.
- **Cómputo:** infraestructura serverless gestionada (Vercel). Región a acordar con el cliente.
- **Cifrado en tránsito:** TLS 1.2+ en todos los tramos; mTLS hacia Logitech.
- **Retención:** el histórico de estados conforma la traza temporal; la política de retención se acordará con el cliente.

---

## 5. Monitoreo, registros y trazabilidad (objetivo 3 del cliente)

La solución incorporará, como parte de su construcción:

- **Registro dedicado de cada sincronización**: fecha/hora, endpoint consultado, resultado, conteos, duración y errores.
- **Histórico de estados** por dispositivo (traza temporal para análisis).
- **Bitácora de auditoría** de las acciones administrativas.
- **Alertas** ante: fallo de sincronización, error de certificado/autenticación y dispositivos fuera de línea.
- **Monitoreo de errores** de aplicación (ej. Sentry) con niveles de severidad.
- **Vista de auditoría** consultable para el cliente (trazabilidad de accesos y sincronizaciones).

Estos puntos se alinean 1:1 con "visibilidad y trazabilidad de las comunicaciones" y quedan como **entregables comprometidos de la construcción**.

---

## 6. Controles de seguridad que implementaremos

La construcción incorporará los siguientes controles como parte del diseño, no como añadidos posteriores:

| # | Control | Cómo se implementará |
|---|---|---|
| 1 | **Cifrado en reposo** de certificados y credenciales sensibles (`certificate.pem`, `privateKey.pem`, credenciales locales) | Almacenamiento cifrado (Vault / pgcrypto o gestor de secretos dedicado) + **rotación de certificados**. |
| 2 | **Trazabilidad dedicada** de la integración | Registro específico de cada sincronización + alertas (sección 5). |
| 3 | **Mínimo privilegio** del certificado Logitech | Certificado de **solo lectura**; *allowlist* de IP de origen si el portal Sync lo permite. |
| 4 | **Protección de los endpoints** internos | Autenticación por token, *rate limiting* y rotación de secretos. |
| 5 | **Residencia de datos** | Región de datos acordada con el cliente según sus requisitos. |

> Estamos abiertos a ajustar y priorizar estos controles según los estándares que defina su equipo de ciberseguridad.

---

## 7. Cumplimiento y buenas prácticas

- **Habeas Data (Ley 1581 de 2012, Colombia):** los datos tratados son de infraestructura/dispositivos; de haber datos personales asociados (p. ej. usuarios de salas), se aplicará el tratamiento y autorización correspondientes.
- **Cifrado en tránsito** en todos los tramos.
- **Segregación multi-cliente** por diseño.
- Alineación con principios de **mínimo privilegio** y **defensa en profundidad**.

---

## 8. Checklist de validación propuesto para la aprobación (objetivo 4)

Proponemos este checklist como criterio de aceptación conjunto:

- [ ] Confirmar los **dos componentes en alcance**: Sync Cloud API (nube) + agente CollabOS/LNA (piloto local de solo lectura).
- [ ] Verificar que **no se requiere conectividad entrante** a la red del cliente en ninguno de los dos.
- [ ] Validar la generación y **custodia del certificado** Sync en el portal del cliente (y procedimiento de revocación).
- [ ] Acordar **prerrequisitos del agente CollabOS** (habilitar LNA por dispositivo, host dedicado, VLAN/segmento, egreso HTTPS) — ver `COLLABOS_ETAPA1.md` sección 7.
- [ ] Acordar **custodia y rotación de credenciales LNA** y de la API key del agente.
- [ ] Acordar el **alcance de datos** almacenados y la **política de retención**.
- [ ] Confirmar los **controles de monitoreo/alertas** (sección 5.2) como entregables previos a producción.
- [ ] Acordar el **cronograma de endurecimiento** (sección 6, especialmente el cifrado en reposo).
- [ ] Declarar y aceptar la **región de datos** (residencia).
- [ ] Definir un **canal de reporte de incidentes** y punto de contacto de seguridad.

---

## 9. Contacto

- **Proveedor:** MeetUp Colombia — Miguel Samaca
- **Rol:** [definir] · **Correo/tel:** [completar]
- Disponibles para atender el análisis de vulnerabilidades y ajustar la solución según los hallazgos.
