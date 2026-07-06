# AV CORE — Plan Maestro de Trabajo (6 meses)

> Plan integral: Desarrollo de producto (incl. plataforma agéntica con IA), Mercado, Marketing, Promoción/Ventas y Estrategia.
> Founder: Miguel (founder-led, Claude Code como equipo de desarrollo).
> Julio – Diciembre 2026. Complementa a `GTM_AVCORE.md` (detalle comercial).

---

## Visión de producto

**Hoy:** plataforma de gestión para integradores AV (cotizaciones → OEs → proyectos → finanzas → salas).
**Meta a 6 meses:** el primer **integrador AV virtual con IA** de LatAm — la plataforma no solo registra el negocio: **lo opera contigo**. Un copiloto que cotiza, hace seguimiento, alerta sobre la caja y redacta propuestas.

**El diferencial agéntico (nadie en el nicho lo tiene):**

| Agente | Qué hace | Valor |
|---|---|---|
| 🤖 **Copiloto de cotización** | "Cotiza una sala mediana con Rally Bar para 8 personas" → arma la cotización con productos del catálogo, márgenes históricos y TRM del día | Cotizar en 3 min, no 2 horas |
| 📞 **Agente de seguimiento** | Detecta cotizaciones enviadas sin respuesta >5 días y redacta el mensaje de follow-up (WhatsApp/email) listo para enviar | Nunca más se pierde una venta por olvido |
| 💰 **Analista financiero** | Chat sobre tus datos: "¿cómo cierro el mes?", "¿qué proyecto me está quemando margen?", "¿cuánto IVA pago en septiembre?" | CFO de bolsillo |
| 📄 **Generador de propuestas** | De cotización → propuesta comercial PDF con alcance, cronograma y condiciones, en el tono de la empresa | Propuesta profesional en minutos |
| 🚨 **Vigía de operación** | Resumen diario proactivo: caja proyectada, cobros vencidos, salas offline, OEs atrasadas — por email/WhatsApp cada mañana | El dueño abre el día sabiendo todo |

**Stack IA:** Claude API (Anthropic). Modelos: `claude-sonnet-5` para agentes complejos (cotización, propuestas, analista), `claude-haiku-4-5` para tareas de alto volumen/bajo costo (clasificación, resúmenes diarios, follow-ups). Tool use sobre las tablas Supabase existentes. Costo estimado: USD 20–80/mes con 10 tenants activos (se traslada al plan Business).

---

## Estructura del plan: 5 frentes × 6 fases

Frentes: **[DEV]** Desarrollo · **[MKT]** Marketing/Contenido · **[VTA]** Promoción/Ventas · **[MER]** Mercado/Investigación · **[EST]** Estrategia/Operación

---

## FASE 1 · Julio 2026 — Cimientos vendibles

### [DEV] Desarrollo
| # | Tarea | Entregable |
|---|---|---|
| 1.1 | Ejecutar migraciones 015 (IVA) y 016 (Logitech) en Supabase; activar módulo rooms al tenant | Producción al día |
| 1.2 | Configurar Vercel: `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, cron activo | Infra estable |
| 1.3 | **Módulo Oportunidades/Pipeline** (Kanban etapas, valor estimado, probabilidad, motivo de pérdida, comité de compra) | CRM comercial completo |
| 1.4 | Registro autoservicio de tenant + trial 14 días + email de bienvenida | Onboarding sin fricción |
| 1.5 | **Fundación IA**: endpoint interno `/api/ai` con Claude API, autenticación por tenant, límites de uso, logging de costos | Infraestructura agéntica lista |
| 1.6 | **Agente #1 — Analista financiero (chat)**: chat flotante en /admin/finanzas que responde sobre flujo, IVA, cartera con tool use sobre Supabase | Primer "wow" de IA |
| 1.7 | Suite básica de datos semilla para demos (tenant demo con datos realistas) | Demo sin improvisar |

### [MER] Mercado
| # | Tarea |
|---|---|
| 1.8 | Mapear 100 integradores objetivo en Colombia (LinkedIn, cámaras de comercio, directorios de partners Logitech/Yealink/Poly/Kramer) |
| 1.9 | 5 entrevistas de descubrimiento con integradores conocidos (no vender: escuchar dolores y validar pricing) |
| 1.10 | Análisis competitivo: qué usan hoy (Excel, Monday, HubSpot, Siigo) y qué les falta |

### [EST] Estrategia
| # | Tarea |
|---|---|
| 1.11 | Nombre definitivo, dominio (avcore.co), logo y mini-manual de marca |
| 1.12 | Definir pricing v1 (Starter 250K / Pro 650K / Business 1.2M COP) y política founding members |
| 1.13 | Constituir lo legal mínimo: términos de servicio, tratamiento de datos (Habeas Data), contrato de suscripción |

**🎯 Resultado Fase 1:** producto que se prueba solo + primer agente IA funcionando + 100 prospectos mapeados.

---

## FASE 2 · Agosto 2026 — Máquina de marketing + IA visible

### [DEV] Desarrollo
| # | Tarea | Entregable |
|---|---|---|
| 2.1 | **Agente #2 — Copiloto de cotización**: prompt "describe el proyecto" → borrador de cotización con productos del catálogo + precios sugeridos por histórico | Feature estrella para demos |
| 2.2 | **Agente #3 — Vigía de operación**: cron diario que genera resumen ejecutivo (caja, cobros, alertas salas, OEs) y lo envía por email | Retención diaria |
| 2.3 | Landing page pública AV CORE (hero + video + pricing + CTA demo) en el mismo repo | avcore.co en vivo |
| 2.4 | Calculadora pública "¿Cuánta plata tienes regada?" (lead magnet interactivo que captura email) | Generador de leads |
| 2.5 | Analytics: eventos de producto (registro, primera cotización, primer uso IA) + panel simple | Medir activación |

### [MKT] Marketing
| # | Tarea |
|---|---|
| 2.6 | Optimizar perfil LinkedIn de Miguel: "Ayudo a integradores AV a controlar su plata y vender más" |
| 2.7 | Sistema de contenido: 12 posts/mes calendarizados (reutilizar metodología ComercIA): casos MeetUp, errores financieros del integrador, demos de la IA |
| 2.8 | Video demo de 3 min (Loom pulido) mostrando el copiloto de cotización — la IA ES el gancho del video |
| 2.9 | Plantilla Excel gratuita "Flujo de caja del integrador AV" + secuencia de 4 emails automatizada |
| 2.10 | Grabar 3 clips cortos (reels) del agente IA cotizando en vivo — formato "mira esto" |

### [VTA] Ventas
| # | Tarea |
|---|---|
| 2.11 | Guion de demo de 30 min escrito y ensayado (dolor → demo con IA → precio → cierre de fecha) |
| 2.12 | Configurar Cal.com + WhatsApp Business + pipeline propio en AV CORE (dogfooding) |

**🎯 Resultado Fase 2:** landing en vivo, 3 agentes IA operando, máquina de contenido rodando, todo listo para vender.

---

## FASE 3 · Septiembre 2026 — Founding members

### [VTA] Ventas (frente principal del mes)
| # | Tarea | Meta |
|---|---|---|
| 3.1 | Outreach 1-a-1 a 50 prospectos (WhatsApp/LinkedIn, personalizado, nunca masivo) | 15+ conversaciones |
| 3.2 | Ejecutar 10 demos con guion | 10 demos |
| 3.3 | 5 pilotos guiados de 14 días (onboarding hecho por Miguel: montar SUS datos en la sesión 1) | 5 pilotos |
| 3.4 | Cerrar founding members (40% dcto. año 1 + roadmap prioritario, a cambio de testimonio) | 🎯 **3 clientes pagos** |
| 3.5 | Playbook de objeciones v1 (documentar cada "no" y su respuesta) | Guion v2 |

### [DEV] Desarrollo
| # | Tarea |
|---|---|
| 3.6 | **Agente #4 — Seguimiento comercial**: detecta cotizaciones sin respuesta >5 días, redacta follow-up listo para enviar; se integra al Pipeline |
| 3.7 | Soporte del piloto: corregir fricción real que reporten los 5 pilotos (prioridad absoluta sobre features nuevas) |
| 3.8 | Facturación/cobro: integrar Wompi o link de pago recurrente + estados de suscripción por tenant |

### [MKT] Marketing
| # | Tarea |
|---|---|
| 3.9 | Mantener 3 posts/semana; ahora con aprendizajes reales de las demos ("las 5 objeciones que me repiten los integradores") |
| 3.10 | Publicar los reels de la IA cotizando (LinkedIn + Instagram MeetUp cruzado) |

**🎯 Resultado Fase 3:** 3 clientes pagando, IA de seguimiento activa, pricing validado.

---

## FASE 4 · Octubre 2026 — Prueba social y repetición

### [MKT] Marketing (frente principal del mes)
| # | Tarea |
|---|---|
| 4.1 | Caso de éxito MeetUp Colombia con números reales (horas ahorradas, cartera recuperada, IVA sin sustos) — PDF + página + post |
| 4.2 | 2–3 testimonios en video de founding members |
| 4.3 | Webinar en vivo: "Cómo saber si tu empresa AV realmente gana plata" (gancho: análisis financiero con IA en vivo) — meta 30+ registrados |
| 4.4 | Empezar SEO básico: 4 artículos pilares ("flujo de caja para integradores", "cuánto cobrar por una sala de juntas", etc.) |

### [VTA] Ventas
| # | Tarea | Meta |
|---|---|---|
| 4.5 | Segundo lote: 50 prospectos más + pedir 2 referidos a cada cliente activo | 10 demos |
| 4.6 | Convertir asistentes del webinar a demos | +5 demos |
| 4.7 | Meta acumulada | 🎯 **6 clientes pagos** |

### [DEV] Desarrollo
| # | Tarea |
|---|---|
| 4.8 | **Agente #5 — Generador de propuestas**: cotización → propuesta comercial PDF (alcance, cronograma, condiciones) con branding del tenant |
| 4.9 | Portal del cliente final mejorado (el cliente del integrador ve avance del proyecto → el integrador se ve profesional) |
| 4.10 | Onboarding en producto: checklist guiado + tooltips para reducir dependencia de Miguel |

**🎯 Resultado Fase 4:** 6 clientes, prueba social publicada, propuestas con IA como nuevo gancho de venta.

---

## FASE 5 · Noviembre 2026 — Sistematizar y escalar

### [EST] Estrategia (frente principal del mes)
| # | Tarea |
|---|---|
| 5.1 | Alianza con 1–2 distribuidores/marcas AV (ellos recomiendan AV CORE a su red de partners; comisión o co-marketing) |
| 5.2 | Programa de referidos formal: 1 mes gratis por referido que pague |
| 5.3 | Análisis go/no-go expansión México/Perú/Ecuador (IVA/impuestos configurables por país — evaluar esfuerzo dev) |
| 5.4 | Revisar unit economics: CAC, LTV proyectado, churn, margen por plan |

### [DEV] Desarrollo
| # | Tarea |
|---|---|
| 5.5 | Onboarding 100% autoservicio (videos + datos de ejemplo + activación guiada por el propio agente IA) |
| 5.6 | **IA multi-tenant productiva**: límites por plan (Starter sin IA, Pro con copiloto, Business todo), medición de costos por tenant |
| 5.7 | Hardening: backups, monitoreo de errores (Sentry), rate limits, auditoría de seguridad básica |
| 5.8 | Si go a expansión: parametrizar impuestos por país (IVA CO / IVA MX / IGV PE) |

### [VTA] Ventas
| # | Tarea | Meta |
|---|---|---|
| 5.9 | Ciclo continuo: 10 demos/mes entre inbound + referidos + alianza | 🎯 **9 clientes pagos** |

### [MKT] Marketing
| # | Tarea |
|---|---|
| 5.10 | Contenido co-creado con la alianza (webinar conjunto con distribuidor) |
| 5.11 | Email mensual a toda la base de leads (novedades IA + caso del mes) |

**🎯 Resultado Fase 5:** 9 clientes, máquina que no depende 100% de Miguel, decisión de expansión tomada.

---

## FASE 6 · Diciembre 2026 — Cierre de año y plan 2027

### [VTA] Ventas
| # | Tarea | Meta |
|---|---|---|
| 6.1 | Campaña de cierre fiscal: "Empieza 2027 con tus finanzas claras" (el IVA de enero es el gancho perfecto) | +3 cierres |
| 6.2 | Meta final | 🎯 **12 clientes · MRR ~COP 6.5M** |

### [EST] Estrategia
| # | Tarea |
|---|---|
| 6.3 | Dashboard de negocio: MRR, churn, NPS, CAC, uso de IA por tenant |
| 6.4 | Decisión 2027: contratar primer comercial vs. seguir founder-led + presupuesto anual |
| 6.5 | Roadmap producto 2027 (candidatos: app móvil, integración contable Siigo/Alegra, marketplace de integradores, agente de compras a proveedores) |

### [DEV] Desarrollo
| # | Tarea |
|---|---|
| 6.6 | Estabilización: deuda técnica, tests de flujos críticos (cotización→OE→cobro), performance |
| 6.7 | **Reporte anual IA para cada tenant**: "tu 2026 en números" generado por el analista financiero (retención + marketing viral) |

### [MKT] Marketing
| # | Tarea |
|---|---|
| 6.8 | Post recapitulación del año construyendo en público ("de Excel a 12 clientes en 6 meses") |

---

## Resumen de la capa IA (roadmap agéntico)

| Fase | Agente | Modelo sugerido |
|---|---|---|
| 1 (Jul) | Infraestructura `/api/ai` + Analista financiero (chat) | claude-sonnet-5 |
| 2 (Ago) | Copiloto de cotización + Vigía diario | sonnet-5 / haiku-4-5 |
| 3 (Sep) | Agente de seguimiento comercial | haiku-4-5 |
| 4 (Oct) | Generador de propuestas PDF | sonnet-5 |
| 5 (Nov) | Límites por plan + onboarding guiado por IA | — |
| 6 (Dic) | Reporte anual "tu 2026 en números" | sonnet-5 |

Principios: la IA siempre **propone, el humano aprueba** (cotizaciones y mensajes nunca se envían solos) · tool use directo sobre Supabase con scoping por tenant_id · registro de costo por tenant desde el día 1.

---

## Metas globales por mes

| Métrica | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|---|---|---|---|---|
| Clientes pagos | 0 | 0 | 3 | 6 | 9 | **12** |
| MRR (COP M) | 0 | 0 | 1.5 | 3.2 | 5.0 | **6.5** |
| Demos acumuladas | — | — | 10 | 25 | 35 | 45 |
| Leads/mes | — | 20 | 30 | 50 | 65 | 80 |
| Agentes IA en producción | 1 | 3 | 4 | 5 | 5 | 6 |

## Ritmo semanal de Miguel (protegido)

- **Comercial (2h/día):** posts L-X-V · demos Ma-Ju 9–11am · métricas viernes 15 min
- **Producto:** Ma-Ju por la tarde con Claude Code; el resto de la semana Claude desarrolla en paralelo
- **Regla:** ninguna semana sin publicar 3 veces y sin al menos 2 conversaciones comerciales nuevas
