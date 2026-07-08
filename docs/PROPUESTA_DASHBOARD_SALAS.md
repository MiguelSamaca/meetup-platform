# Propuesta — Dashboard Centralizado de Monitoreo de Salas

> Solución de visibilidad en tiempo real para sus salas de videoconferencia Logitech.
> Presentado por: MeetUp Colombia · Julio 2026

---

## 1. Resumen

Proponemos construir un **dashboard centralizado** que muestre, en una sola pantalla, el **estado en tiempo real de todas sus salas** de videoconferencia Logitech, así como el **historial de fallas** agrupado por piso, tipo de sala o grupo de salas.

La solución integrará **dos fuentes de información oficiales de Logitech**:
- La **Sync Cloud API** (información desde la nube de Logitech).
- La **API local de CollabOS (LNA)** (información directa de cada dispositivo).

El resultado es una vista consolidada que hoy la plataforma de Logitech no ofrece.

---

## 2. El problema hoy

Con las herramientas actuales de Logitech:

- **No existe una vista general consolidada** del estado de todas las salas.
- Para revisar las **fallas de una reunión**, hay que **entrar reunión por reunión**, una por una — no hay un tablero que las resuma.
- **No hay forma de ver, agrupadas por piso, por tipo de sala o por grupo de salas**, cuántas fallas ocurrieron en un período determinado (un día, una semana, un mes).
- Por lo mismo, es **difícil correlacionar una falla con un cambio**: cuando se modifica algo en una sala, en un equipo o en la red, no se puede ver con claridad **en qué momento empezaron a presentarse las fallas**.

---

## 3. La solución: así se vería el dashboard

*Vista ilustrativa (datos de ejemplo):*

<svg viewBox="0 0 1000 512" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;border-radius:12px;">
  <rect x="6" y="6" width="988" height="500" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- barra de título -->
  <path d="M6 20 A14 14 0 0 1 20 6 L980 6 A14 14 0 0 1 994 20 L994 50 L6 50 Z" fill="#f8fafc"/>
  <line x1="6" y1="50" x2="994" y2="50" stroke="#e2e8f0" stroke-width="1.5"/>
  <circle cx="28" cy="28" r="5" fill="#ef4444"/>
  <circle cx="46" cy="28" r="5" fill="#f59e0b"/>
  <circle cx="64" cy="28" r="5" fill="#22c55e"/>
  <text x="110" y="33" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#334155">Dashboard de Salas · Monitoreo en tiempo real</text>
  <rect x="838" y="16" width="140" height="26" rx="13" fill="#eef2ff" stroke="#c7d2fe"/>
  <text x="908" y="33" font-family="Segoe UI, Arial" font-size="11" font-weight="600" fill="#4f46e5" text-anchor="middle">Últimos 7 días ▾</text>

  <!-- KPIs -->
  <g font-family="Segoe UI, Arial">
    <rect x="24" y="66" width="223" height="76" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="40" y="94" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="1">SALAS</text>
    <text x="40" y="128" font-size="30" font-weight="700" fill="#0f172a">24</text>
    <rect x="263" y="66" width="223" height="76" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text x="279" y="94" font-size="10" font-weight="700" fill="#4ade80" letter-spacing="1">OPERATIVAS</text>
    <text x="279" y="128" font-size="30" font-weight="700" fill="#16a34a">21</text>
    <rect x="502" y="66" width="223" height="76" rx="10" fill="#fef2f2" stroke="#fecaca"/>
    <text x="518" y="94" font-size="10" font-weight="700" fill="#f87171" letter-spacing="1">CON FALLAS</text>
    <text x="518" y="128" font-size="30" font-weight="700" fill="#dc2626">3</text>
    <rect x="741" y="66" width="223" height="76" rx="10" fill="#fffbeb" stroke="#fde68a"/>
    <text x="757" y="94" font-size="10" font-weight="700" fill="#fbbf24" letter-spacing="1">FALLAS · 7 DÍAS</text>
    <text x="757" y="128" font-size="30" font-weight="700" fill="#d97706">12</text>
  </g>

  <!-- columna izquierda: estado por sala -->
  <g font-family="Segoe UI, Arial">
    <text x="24" y="182" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">ESTADO POR SALA</text>
    <text x="24" y="206" font-size="11" font-weight="700" fill="#94a3b8">PISO 3</text>
    <!-- fila 1 -->
    <g>
      <rect x="24" y="214" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="42" cy="238" r="6" fill="#22c55e"/><text x="56" y="236" font-size="12" font-weight="600" fill="#1e293b">Directorio</text>
      <text x="40" y="258" font-size="10" fill="#16a34a">Operativa</text>
      <rect x="181" y="214" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="199" cy="238" r="6" fill="#f59e0b"/><text x="213" y="236" font-size="12" font-weight="600" fill="#1e293b">Juntas A</text>
      <text x="197" y="258" font-size="10" fill="#d97706">1 falla hoy</text>
      <rect x="338" y="214" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="356" cy="238" r="6" fill="#22c55e"/><text x="370" y="236" font-size="12" font-weight="600" fill="#1e293b">Board Room</text>
      <text x="354" y="258" font-size="10" fill="#16a34a">Operativa</text>
    </g>
    <text x="24" y="298" font-size="11" font-weight="700" fill="#94a3b8">PISO 2</text>
    <!-- fila 2 -->
    <g>
      <rect x="24" y="306" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="42" cy="330" r="6" fill="#ef4444"/><text x="56" y="328" font-size="12" font-weight="600" fill="#1e293b">Juntas B</text>
      <text x="40" y="350" font-size="10" fill="#dc2626">Sin conexión</text>
      <rect x="181" y="306" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="199" cy="330" r="6" fill="#22c55e"/><text x="213" y="328" font-size="12" font-weight="600" fill="#1e293b">Videoconf 1</text>
      <text x="197" y="350" font-size="10" fill="#16a34a">Operativa</text>
      <rect x="338" y="306" width="145" height="60" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
      <circle cx="356" cy="330" r="6" fill="#f59e0b"/><text x="370" y="328" font-size="12" font-weight="600" fill="#1e293b">Training</text>
      <text x="354" y="350" font-size="10" fill="#d97706">2 fallas</text>
    </g>
  </g>

  <!-- columna derecha: fallas por día -->
  <g font-family="Segoe UI, Arial">
    <text x="524" y="182" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">FALLAS POR DÍA</text>
    <line x1="524" y1="300" x2="964" y2="300" stroke="#e2e8f0"/>
    <!-- barras: valores 2,1,3,0,4,1,1 (x18) -->
    <g fill="#f59e0b">
      <rect x="524" y="264" width="34" height="36" rx="3"/>
      <rect x="592" y="282" width="34" height="18" rx="3"/>
      <rect x="660" y="246" width="34" height="54" rx="3"/>
      <rect x="728" y="298" width="34" height="2" rx="1" fill="#e2e8f0"/>
      <rect x="796" y="228" width="34" height="72" rx="3"/>
      <rect x="864" y="282" width="34" height="18" rx="3"/>
      <rect x="932" y="282" width="34" height="18" rx="3"/>
    </g>
    <g font-size="10" fill="#475569" text-anchor="middle" font-weight="600">
      <text x="541" y="258">2</text><text x="609" y="276">1</text><text x="677" y="240">3</text>
      <text x="813" y="222">4</text><text x="881" y="276">1</text><text x="949" y="276">1</text>
    </g>
    <g font-size="10" fill="#94a3b8" text-anchor="middle">
      <text x="541" y="315">L</text><text x="609" y="315">M</text><text x="677" y="315">X</text>
      <text x="745" y="315">J</text><text x="813" y="315">V</text><text x="881" y="315">S</text><text x="949" y="315">D</text>
    </g>

    <text x="524" y="350" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">FALLAS POR TIPO DE SALA</text>
    <g font-family="Segoe UI, Arial" font-size="11">
      <text x="524" y="378" fill="#475569">Salas de juntas</text>
      <rect x="664" y="369" width="300" height="12" rx="6" fill="#f1f5f9"/>
      <rect x="664" y="369" width="260" height="12" rx="6" fill="#dc2626"/>
      <text x="524" y="402" fill="#475569">Videoconferencia</text>
      <rect x="664" y="393" width="300" height="12" rx="6" fill="#f1f5f9"/>
      <rect x="664" y="393" width="150" height="12" rx="6" fill="#f59e0b"/>
      <text x="524" y="426" fill="#475569">Directorio</text>
      <rect x="664" y="417" width="300" height="12" rx="6" fill="#f1f5f9"/>
      <rect x="664" y="417" width="55" height="12" rx="6" fill="#22c55e"/>
    </g>
  </g>

  <!-- leyenda -->
  <g font-family="Segoe UI, Arial" font-size="10" fill="#64748b">
    <circle cx="30" cy="466" r="5" fill="#22c55e"/><text x="42" y="470">Operativa</text>
    <circle cx="130" cy="466" r="5" fill="#f59e0b"/><text x="142" y="470">Con fallas</text>
    <circle cx="240" cy="466" r="5" fill="#ef4444"/><text x="252" y="470">Sin conexión</text>
    <text x="964" y="470" text-anchor="end" fill="#cbd5e1">Vista ilustrativa · datos de ejemplo</text>
  </g>
</svg>

**Lo que verá en el dashboard:**
- Estado en tiempo real de cada sala (operativa / con fallas / sin conexión).
- Salas **agrupadas por piso, por tipo de sala o por grupo**.
- **Cantidad de fallas por período** (día, semana, mes) con gráficos.
- Detalle por sala al hacer clic.

---

## 4. Cómo se conecta

La solución toma información de **dos fuentes oficiales de Logitech**, y las unifica en el dashboard:

```
   1) NUBE DE LOGITECH  ──────────────▶  DASHBOARD
      (Sync Cloud API, conexión saliente, autenticación por certificado)

   2) DISPOSITIVOS EN SUS SALAS  ─────▶  DASHBOARD
      (API local CollabOS/LNA, lectura desde un equipo YA conectado a su red)
```

- **Fuente 1 — Sync Cloud API:** conexión **nube-a-nube**, **saliente**, autenticada con un **certificado que ustedes generan y controlan** desde su portal Logitech (y pueden revocar cuando quieran).
- **Fuente 2 — CollabOS local (LNA):** para leer el estado detallado directamente de cada dispositivo, el monitoreo se ejecutará desde un **equipo que YA se encuentra conectado a su red mediante VPN** (el equipo de nuestro ingeniero, Esteban), el cual **ya cuenta con acceso autorizado** apuntando a su red interna.

> **Tranquilidad para su equipo:** no es necesario habilitar nuevos accesos, instalar hardware adicional, ni **abrir ningún puerto entrante**. Se aprovecha un canal que ya existe y ya está autorizado, y la información **solo se lee** (nunca se modifica ni se controla nada de sus equipos).

---

## 5. Ventajas de un dashboard que unifica Sync API + CollabOS

1. **Una sola pantalla en lugar de revisar sala por sala.** Hoy, para ver las fallas de una reunión hay que entrar a cada reunión individualmente. El dashboard las consolida todas.

2. **Visión de fallas por grupos, pisos y tipos de sala** — algo que la plataforma de Logitech **no ofrece hoy**. Podrá ver cuántas fallas hubo, agrupadas como usted las organiza (por piso, por tipo de sala, por edificio).

3. **Análisis por período** (día, semana, mes): identifique tendencias y salas problemáticas a lo largo del tiempo, no solo el estado del momento.

4. **Correlación entre cambios y fallas** — el mayor valor operativo: cuando se hace una modificación en una sala, en un equipo o en la red, el dashboard permite ver **en qué momento empezaron a presentarse las fallas**. Esto ayuda a diagnosticar la causa y validar si un cambio mejoró o empeoró la estabilidad.

5. **Mantenimiento proactivo:** detectar equipos que fallan repetidamente antes de que impacten una reunión importante.

6. **Información en tiempo real + histórico** en un mismo lugar, listo para reportes.

---

## 6. Alcance de la Etapa 1

| Incluye | No incluye (etapas siguientes) |
|---|---|
| Dashboard con estado en tiempo real de las salas | Control remoto de dispositivos |
| Integración de Sync Cloud API + CollabOS (LNA) | Despliegue a la totalidad de salas |
| Métricas de fallas por piso, tipo y período | Automatizaciones avanzadas |
| **Piloto en 1–2 salas** para validar | Alta disponibilidad / redundancia |

Todo en la Etapa 1 es de **solo lectura**: el sistema **observa y reporta**, nunca modifica ni controla los equipos.

---

## 7. Seguridad (resumen)

- **Sin conectividad entrante** a su red: todas las conexiones son salientes.
- **Solo lectura**: no se envían comandos a los dispositivos.
- **Certificado bajo su control**: ustedes lo generan y pueden revocarlo cuando quieran.
- **Canal ya autorizado**: se usa el equipo que ya tiene acceso VPN a su red.
- **Cifrado en tránsito** en todas las comunicaciones; **credenciales almacenadas de forma cifrada**.
- **Trazabilidad**: registro de cada sincronización y alertas ante fallos.

*(El detalle técnico de arquitectura y controles se entrega en documento aparte para su equipo de ciberseguridad.)*

---

## 8. Qué necesitamos de su equipo

1. Habilitar la **API local (LNA)** en los dispositivos de las salas piloto y cambiar sus contraseñas por defecto.
2. Generar el **certificado de la Sync Cloud API** en su portal Logitech.
3. Confirmar el **acceso VPN** ya existente al equipo desde el que operaremos el monitoreo.
4. Acordar el **alcance de datos** y la política de retención.

---

## 9. Plan por fases

| Fase | Entregable | Resultado |
|---|---|---|
| 1. Preparación | Habilitación de accesos y credenciales (con su equipo) | Listos para conectar |
| 2. Conexión | Integración de Sync Cloud API + CollabOS | Datos fluyendo al dashboard |
| 3. Dashboard | Vistas de estado, agrupaciones y fallas por período | Dashboard operativo |
| 4. Piloto | Validación en 1–2 salas reales | Prueba exitosa documentada |
| 5. Ampliación | (Etapa siguiente) Escalar a más salas | Cobertura total |

---

## 10. Próximo paso

Agendar la sesión técnica con su equipo de infraestructura y ciberseguridad para validar los accesos y dar inicio a la Etapa 1.

**Contacto:** MeetUp Colombia — [nombre] · [correo] · [teléfono]
