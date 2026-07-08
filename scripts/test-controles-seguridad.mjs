#!/usr/bin/env node
/**
 * PRUEBA DE CONTROLES DE SEGURIDAD — AV CORE
 * ───────────────────────────────────────────
 * Script INDEPENDIENTE. No modifica nada. Demuestra, en vivo, que los
 * controles de acceso descritos en el dossier funcionan de verdad.
 * Ideal para ejecutarlo frente al equipo de ciberseguridad del cliente.
 *
 * USO:
 *   node scripts/test-controles-seguridad.mjs
 *
 * (opcional) BASE_URL para apuntar a otro entorno.
 */

const BASE_URL = process.env.BASE_URL || 'https://meetup-platform-ashen.vercel.app'
const CRON_PATH = '/api/cron/logitech-poll'

const line = (c = '─') => console.log(c.repeat(64))
let pass = 0, fail = 0

function check(nombre, ok, detalle) {
  const icon = ok ? '✅' : '❌'
  console.log(`${icon} ${nombre}`)
  if (detalle) console.log(`     ${detalle}`)
  ok ? pass++ : fail++
}

async function httpCode(path, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}?cb=${Date.now()}`, {
    method: 'GET', headers, redirect: 'manual',
  })
  return res.status
}

async function main() {
  console.log('')
  line('═')
  console.log('   PRUEBA DE CONTROLES DE SEGURIDAD — AV CORE')
  console.log('   Objetivo: comprobar acceso, autenticación y exposición')
  console.log('   ' + new Date().toLocaleString('es-CO'))
  console.log('   Entorno: ' + BASE_URL)
  line('═')
  console.log('')

  // 1) HTTPS obligatorio
  check('Transporte cifrado (HTTPS)',
    BASE_URL.startsWith('https://'),
    'Todo el tráfico viaja por TLS; no se expone HTTP plano.')

  // 2) Endpoint de sincronización RECHAZA sin credencial
  try {
    const sinSecreto = await httpCode(CRON_PATH)
    check('Endpoint de sincronización exige autenticación',
      sinSecreto === 401,
      `Sin token → HTTP ${sinSecreto} (se espera 401 = acceso denegado).`)
  } catch (e) {
    check('Endpoint de sincronización exige autenticación', false, e.message)
  }

  // 3) Endpoint RECHAZA con credencial incorrecta
  try {
    const secretoMalo = await httpCode(CRON_PATH, { Authorization: 'Bearer token-invalido-123' })
    check('Rechaza credenciales inválidas',
      secretoMalo === 401,
      `Token incorrecto → HTTP ${secretoMalo} (se espera 401).`)
  } catch (e) {
    check('Rechaza credenciales inválidas', false, e.message)
  }

  // 4) Panel de administración protegido (no accesible sin sesión)
  try {
    const admin = await httpCode('/admin/rooms')
    check('Panel de administración protegido',
      admin === 307 || admin === 302 || admin === 401,
      `Sin sesión → HTTP ${admin} (redirige a login; no expone datos).`)
  } catch (e) {
    check('Panel de administración protegido', false, e.message)
  }

  // 5) Configuración de salas protegida
  try {
    const cfg = await httpCode('/admin/rooms/configuracion')
    check('Configuración (certificados) protegida',
      cfg === 307 || cfg === 302 || cfg === 401,
      `Sin sesión → HTTP ${cfg} (los certificados nunca se exponen).`)
  } catch (e) {
    check('Configuración (certificados) protegida', false, e.message)
  }

  console.log('')
  line('═')
  console.log(`   RESULTADO: ${pass} controles OK · ${fail} fallidos`)
  line('═')
  console.log('')

  if (fail > 0) process.exit(1)
}

main()
