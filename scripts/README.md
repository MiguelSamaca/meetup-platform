# Scripts de prueba — Integración Logitech / Seguridad

> Herramientas de terminal, **independientes**. No modifican el dashboard ni la base de datos.
> Requieren Node.js. En este equipo: agrega Node al PATH antes de correr:
> `$env:Path = "$env:LOCALAPPDATA\nvm\v22.23.1;$env:Path"` (PowerShell)

---

## 1. `test-controles-seguridad.mjs` — Prueba de controles de seguridad
Demuestra en vivo que los controles de acceso funcionan. **Ideal para la reunión de ciberseguridad.**
No necesita certificados ni credenciales.

```bash
node scripts/test-controles-seguridad.mjs
```
Comprueba: HTTPS obligatorio · el endpoint rechaza llamadas sin token (401) · rechaza tokens inválidos ·
el panel admin y la configuración de certificados están protegidos.

---

## 2. `test-logitech-api.mjs` — Prueba de conexión a Logitech
Verifica la autenticación mTLS real contra la nube de Logitech. **Requiere los certificados** del portal Sync.

```bash
LOGI_API_SERVER="https://TU_API_SERVER/v1" \
LOGI_ORG_ID="TU_ORG_ID" \
node scripts/test-logitech-api.mjs
```
(Pon `certificate.pem` y `privateKey.pem` en la raíz del proyecto, o define `LOGI_CERT_PATH` / `LOGI_KEY_PATH`.)

---

## 3. `md-to-html.mjs` — Convertir documentos a página web / PDF
Convierte cualquier `.md` (dossier, guión, planes) en un `.html` que abres con doble clic.
Para PDF: dentro del navegador, **Ctrl/Cmd + P → Guardar como PDF**.

```bash
node scripts/md-to-html.mjs docs/SEGURIDAD_DOSSIER_LOGITECH.md
```
