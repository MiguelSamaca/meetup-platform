# Guión de defensa — Reunión de Ciberseguridad (Logitech / AV CORE)

> Uso interno de Miguel. No compartir con el cliente.
> Acompaña al `SEGURIDAD_DOSSIER_LOGITECH.md` (ese sí se comparte).

---

## Cómo abrir la reunión (tu mensaje de 30 segundos)

> "Antes de entrar en detalle: la integración que estamos proponiendo es **nube-a-nube**. AV CORE consume la API en la nube de Logitech de forma **saliente y con autenticación mutua por certificado**. **No necesitamos abrir nada hacia su red**, ni instalar agentes internos, y las operaciones son **solo de lectura**. El certificado de acceso **lo generan y controlan ustedes** desde su portal Logitech, y pueden revocarlo cuando quieran. Traigo un dossier con la arquitectura, los flujos, los controles y un checklist de validación para que definamos juntos qué necesitan para aprobar."

Esto desactiva de entrada el 80% de las preocupaciones de un equipo de infosec.

---

## Las 3 ideas que debes repetir (anclas)

1. **Sin conectividad entrante.** Todo es saliente desde la nube; su red no expone nada nuevo.
2. **El cliente controla el acceso.** El certificado se genera y revoca en su portal. Cortan el acceso sin depender de nosotros.
3. **Solo lectura.** Por Cloud API no reconfiguramos ni apagamos nada; solo leemos inventario y estado.

---

## Preguntas probables y respuestas preparadas

**P: ¿Qué puertos necesitan que abramos en el firewall?**
R: Ninguno entrante. La única conexión saliente involucrada es la que los equipos Logitech ya usan hoy para reportar a la nube de Logitech; eso no cambia. AV CORE se conecta a Logitech, no a su red.

**P: ¿Cómo se autentican contra Logitech?**
R: mTLS — TLS con autenticación mutua. Certificado de cliente + llave privada que **ustedes generan** en el portal Sync. Sin ese certificado válido, la conexión ni siquiera se establece.

**P: ¿Dónde guardan la llave privada y cómo la protegen?**
R: (Sé honesto y proactivo.) Hoy reside en la base de datos, protegida por control de acceso a nivel de fila y credenciales de servicio. **Antes de producción** la ciframos en reposo (Supabase Vault / pgcrypto o gestor de secretos) e implementamos rotación. Está en nuestro plan de endurecimiento, punto 1 del dossier. Estamos abiertos a que definan el estándar que exigen.

**P: ¿Qué datos nuestros almacenan y dónde?**
R: Inventario (modelo, serial, firmware), identificadores de red (IP/MAC), y estado (online/offline, temperatura, garantía). Residen en Supabase (PostgreSQL gestionado) con cómputo en Vercel (EE. UU. Este hoy). Definimos con ustedes la política de retención y, si lo requieren, evaluamos región de datos.

**P: ¿Pueden controlar o modificar nuestros dispositivos?**
R: No por este canal. Cloud API es solo lectura. El control local es otro modelo (CollabOS) que no está desplegado y que someteríamos a una revisión de seguridad aparte.

**P: ¿Cómo tenemos visibilidad de lo que pasa (logs, alertas)?**
R: Registramos cada sincronización (fecha, resultado, conteos, errores), alertamos ante fallos de sincronización o de certificado, y podemos darles una vista de auditoría. Es el punto 5 del dossier y lo dejamos como entregable de la aprobación.

**P: ¿Qué pasa si el certificado se filtra o el proveedor es comprometido?**
R: Ustedes revocan el certificado en su portal y el acceso se corta de inmediato. Como es solo lectura y no hay conectividad entrante a su red, el impacto queda acotado a la lectura de metadatos ya expuestos a la nube de Logitech.

**P: ¿Y el agente en la LAN del que se habló?**
R: Es un modelo futuro, **no desplegado**. Cuando se plantee, traerá su propia revisión de seguridad (segmentación, hardening del host, VPN, mínimo privilegio). Hoy **no** lo estamos pidiendo.

**P: ¿Tienen certificaciones (ISO 27001, SOC 2)?**
R: (Responde con la verdad de tu estado.) A nivel de plataforma seguimos buenas prácticas: cifrado en tránsito, segregación multi-cliente, mínimo privilegio, auditoría. Las certificaciones formales son parte de nuestro roadmap. Nos alineamos a los controles que ustedes definan como requisito.

**P: ¿Cumplen Habeas Data / protección de datos?**
R: Sí; los datos son mayoritariamente de infraestructura. Si hay datos personales asociados, aplicamos el tratamiento y autorización que exige la Ley 1581.

---

## Qué NO decir / trampas a evitar

- ❌ No digas "es 100% seguro" ni "no hay ningún riesgo". Infosec desconfía de absolutos.
- ❌ No ocultes el tema del cifrado de la llave privada. Si su analista lo encuentra y tú lo tapaste, pierdes toda la credibilidad. Preséntalo tú primero con plan.
- ❌ No te comprometas a fechas de endurecimiento en vivo sin pensarlo; di "lo confirmo por escrito tras la sesión".
- ❌ No mezcles el modelo LAN (CollabOS) con el de hoy. Mantén la línea: "hoy solo Cloud API".

---

## Tu meta de salida de la reunión

Que acuerden el **checklist de validación** (sección 8 del dossier) como criterio de aprobación. Si sales con esa lista acordada y firmada, tienes un camino claro y medible hacia el "sí".

**Cierre sugerido:**
> "Propongo que tomemos el checklist de validación del dossier como nuestro criterio de aceptación. Yo les envío por escrito el cronograma de endurecimiento y la declaración de región de datos esta semana. ¿Qué le agregarían o quitarían a esa lista para dar el visto bueno a la conectividad?"

---

## Antes de la reunión (checklist tuyo)

- [ ] Completar datos de contacto en la sección 9 del dossier.
- [ ] Confirmar la **región de Supabase** (para no titubear si preguntan residencia).
- [ ] Tener claro si van a hablar **solo Cloud API** o también CollabOS (idealmente acotar a Cloud API).
- [ ] Enviar el dossier **antes** de la reunión si se puede (llegan con las preguntas hechas y ganas tono).
- [ ] Tener a la mano el nombre del analista de vulnerabilidades (Wilson Armando Roa Muñoz) y saludarlo directo: su aval es clave.
