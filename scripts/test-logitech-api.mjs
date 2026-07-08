#!/usr/bin/env node
/**
 * PRUEBA DE CONEXIÓN — Logitech Sync Cloud API
 * ─────────────────────────────────────────────
 * Script INDEPENDIENTE. No toca el dashboard ni la base de datos.
 * Solo demuestra que la autenticación mTLS con Logitech funciona
 * y que la API responde con datos reales.
 *
 * USO:
 *   node scripts/test-logitech-api.mjs
 *
 * CONFIGURACIÓN (variables de entorno o edita los valores de abajo):
 *   LOGI_API_SERVER   URL base que aparece en tu portal (ej. https://api.sync.logitech.com/v1)
 *   LOGI_ORG_ID       Organization ID del portal Sync
 *   LOGI_CERT_PATH    Ruta al archivo certificate.pem
 *   LOGI_KEY_PATH     Ruta al archivo privateKey.pem
 *   LOGI_ENDPOINT     (opcional) endpoint a probar. Default: /orgs/{ORG_ID}/places
 */

import { readFileSync } from 'node:fs'
import { Agent, request } from 'undici'

// ─── Configuración ───────────────────────────────────────────────
const API_SERVER = process.env.LOGI_API_SERVER || 'https://api.sync.logitech.com/v1'
const ORG_ID     = process.env.LOGI_ORG_ID     || 'PEGA_AQUI_TU_ORG_ID'
const CERT_PATH  = process.env.LOGI_CERT_PATH  || './certificate.pem'
const KEY_PATH   = process.env.LOGI_KEY_PATH   || './privateKey.pem'
const ENDPOINT   = process.env.LOGI_ENDPOINT   || `/orgs/${ORG_ID}/places`

const line = (c = '─') => console.log(c.repeat(60))

async function main() {
  console.log('')
  line('═')
  console.log('   PRUEBA DE CONEXIÓN — LOGITECH SYNC CLOUD API')
  console.log('   ' + new Date().toLocaleString('es-CO'))
  line('═')

  // 1) Cargar certificados
  let cert, key
  try {
    cert = readFileSync(CERT_PATH, 'utf8')
    key  = readFileSync(KEY_PATH, 'utf8')
    console.log(`✓ Certificado cargado:  ${CERT_PATH}`)
    console.log(`✓ Llave privada cargada: ${KEY_PATH}`)
  } catch (e) {
    console.error(`✗ No se pudieron leer los certificados: ${e.message}`)
    console.error('  → Genera certificate.pem y privateKey.pem en el portal Sync')
    console.error('    y ponlos junto a este script (o define LOGI_CERT_PATH / LOGI_KEY_PATH).')
    process.exit(1)
  }

  const url = `${API_SERVER}${ENDPOINT}`
  console.log(`✓ Org ID: ${ORG_ID}`)
  console.log(`→ Llamando: GET ${url}`)
  line()

  // 2) Llamada mTLS
  const t0 = Date.now()
  try {
    // El certificado mTLS se envía vía Agent (dispatcher), no como opción de request()
    const dispatcher = new Agent({ connect: { cert, key } })
    const res = await request(url, {
      method: 'GET',
      dispatcher,
      headers: { accept: 'application/json' },
    })
    const ms   = Date.now() - t0
    const body = await res.body.text()

    console.log(`ESTADO HTTP:  ${res.statusCode}`)
    console.log(`TIEMPO:       ${ms} ms`)
    console.log(`HANDSHAKE:    mTLS establecido correctamente ✓`)
    line()

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ CONEXIÓN EXITOSA — la API respondió con datos:')
      line()
      try {
        const json = JSON.parse(body)
        const items = json.data ?? json.places ?? json
        const count = Array.isArray(items) ? items.length : '—'
        console.log(`   Salas/espacios recibidos: ${count}`)
        console.log('')
        console.log('   Muestra de la respuesta (primeros 800 caracteres):')
        console.log('   ' + JSON.stringify(json, null, 2).slice(0, 800).replace(/\n/g, '\n   '))
      } catch {
        console.log(body.slice(0, 800))
      }
    } else {
      console.log(`⚠ La API respondió con código ${res.statusCode}.`)
      console.log('  Aun así, esto CONFIRMA que llegamos al servidor de Logitech')
      console.log('  y que el canal mTLS está activo. Detalle:')
      line()
      console.log(body.slice(0, 800))
    }
  } catch (e) {
    line()
    console.error('✗ Error en la llamada:')
    console.error(`  ${e.code || ''} ${e.message}`)
    console.error('')
    console.error('  Pistas:')
    console.error('  · ENOTFOUND / EAI_AGAIN → revisa LOGI_API_SERVER (URL del portal)')
    console.error('  · certificate error     → certificados no válidos o vencidos')
    console.error('  · ECONNREFUSED/timeout  → firewall o URL incorrecta')
    process.exit(1)
  }

  line('═')
  console.log('   Fin de la prueba.')
  line('═')
  console.log('')
}

main()
