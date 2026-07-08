# Guión de defensa — Reunión de Ciberseguridad (Logitech / AV CORE)

> Uso interno de Miguel. No compartir con el cliente.
> Acompaña al `SEGURIDAD_DOSSIER_LOGITECH.md` (ese sí se comparte).

---

## Cómo abrir la reunión (tu mensaje de 30 segundos)

> "Antes de entrar en detalle: lo que proponemos construir es un **dashboard** que lee el estado de sus salas desde **dos fuentes oficiales de Logitech** — la nube (Sync Cloud API) y los dispositivos (CollabOS local). Todo es **saliente**, con **autenticación por certificado que ustedes controlan**, y **solo lectura**. **No necesitamos abrir nada hacia su red**: el monitoreo local corre desde un equipo que **ya tiene acceso VPN autorizado**. Traigo el detalle de arquitectura, flujos, controles y un checklist de validación para que definamos juntos qué necesitan para aprobar."

> **Recuerda:** no nombres el producto ni digas que ya existe algo construido. Habla siempre de "el dashboard que vamos a construir" y de "la solución".

Esto desactiva de entrada el 80% de las preocupaciones de un equipo de infosec.

---

## Las 3 ideas que debes repetir (anclas)

1. **Sin conectividad entrante.** Todo es saliente desde la nube; su red no expone nada nuevo.
2. **El cliente controla el acceso.** El certificado se genera y revoca en su portal. Cortan el acceso sin depender de nosotros.
3. **Solo lectura.** Por Cloud API no reconfiguramos ni apagamos nada; solo leemos inventario y estado.

---

## Preguntas probables y respuestas preparadas

**P: ¿Qué puertos necesitan que abramos en el firewall?**
R: Ninguno entrante. La única conexión saliente involucrada es la que los equipos Logitech ya usan para reportar a su nube; eso no cambia. Nosotros nos conectamos a Logitech, no a su red.

**P: ¿Cómo se autentican contra Logitech?**
R: mTLS — TLS con autenticación mutua. Certificado de cliente + llave privada que **ustedes generan** en el portal Sync. Sin ese certificado válido, la conexión ni siquiera se establece.

**P: ¿Dónde guardan la llave privada y cómo la protegen?**
R: La llave privada se **almacenará cifrada en reposo** (gestor de secretos / Vault), con acceso restringido y rotación periódica. Además, ustedes pueden **revocar el certificado** en su portal en cualquier momento y cortar el acceso. Es el punto 1 de los controles del dossier; nos alineamos al estándar que ustedes exijan.

**P: ¿Qué datos nuestros almacenan y dónde?**
R: Inventario (modelo, serial, firmware), identificadores de red (IP/MAC), y estado (online/offline, temperatura, garantía). Se almacenarán en base de datos gestionada; la **región la definimos con ustedes** según sus requisitos, junto con la política de retención.

**P: ¿Pueden controlar o modificar nuestros dispositivos?**
R: No. Tanto la Sync Cloud API como el monitoreo local CollabOS son de **solo lectura** en esta etapa. El control local es una etapa posterior con su propia revisión de seguridad.

**P: ¿Cómo tenemos visibilidad de lo que pasa (logs, alertas)?**
R: Registramos cada sincronización (fecha, resultado, conteos, errores), alertamos ante fallos de sincronización o de certificado, y podemos darles una vista de auditoría. Es el punto 5 del dossier y lo dejamos como entregable de la aprobación.

**P: ¿Qué pasa si el certificado se filtra o el proveedor es comprometido?**
R: Ustedes revocan el certificado en su portal y el acceso se corta de inmediato. Como es solo lectura y no hay conectividad entrante a su red, el impacto queda acotado a la lectura de metadatos ya expuestos a la nube de Logitech.

**P: ¿Y el agente local en la LAN (CollabOS)?**
R: Se ejecutará desde un equipo que **ya cuenta con acceso VPN autorizado** a su red; no requiere nuevos accesos ni puertos entrantes. Es de **solo lectura** (endpoint `/status`) y lo desplegamos como **piloto en 1–2 salas**. Los controles están en el dossier y en el documento de Etapa 1.

**P: ¿Tienen certificaciones (ISO 27001, SOC 2)?**
R: (Responde con la verdad de tu estado.) A nivel de plataforma seguimos buenas prácticas: cifrado en tránsito, segregación multi-cliente, mínimo privilegio, auditoría. Las certificaciones formales son parte de nuestro roadmap. Nos alineamos a los controles que ustedes definan como requisito.

**P: ¿Cumplen Habeas Data / protección de datos?**
R: Sí; los datos son mayoritariamente de infraestructura. Si hay datos personales asociados, aplicamos el tratamiento y autorización que exige la Ley 1581.

---

## Qué NO decir / trampas a evitar

- ❌ No digas "es 100% seguro" ni "no hay ningún riesgo". Infosec desconfía de absolutos.
- ❌ **No nombres el producto ni digas que ya hay algo construido.** Siempre "el dashboard que vamos a construir".
- ❌ Presenta el cifrado de la llave como **parte del diseño** ("se almacenará cifrada"), nunca como algo pendiente de arreglar.
- ❌ No te comprometas a fechas en vivo sin pensarlo; di "lo confirmo por escrito tras la sesión".
- ❌ En la **prueba en vivo**, deja que ellos vean el llamado y los datos; no toques ni controles ningún equipo (solo lectura).

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
