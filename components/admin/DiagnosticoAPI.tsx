'use client'

import { useState, useTransition } from 'react'
import {
  probarConexionSyncDemo,
  probarConexionLNADemo,
  type DemoResultado,
} from '@/app/actions/logitech'

function ResultadoPanel({ r }: { r: DemoResultado }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
      {/* Encabezado con estado */}
      <div className={`px-4 py-2 flex items-center gap-3 text-sm font-medium ${
        r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
      }`}>
        <span>{r.ok ? '✅ Conexión exitosa' : '⚠ Sin éxito'}</span>
        {r.status != null && <span className="opacity-70">HTTP {r.status}</span>}
        {r.durationMs != null && <span className="opacity-70">· {r.durationMs} ms</span>}
      </div>

      {/* Petición realizada */}
      {r.request && (
        <div className="px-4 py-3 border-t border-gray-100 text-xs space-y-1">
          <p className="text-gray-400 uppercase tracking-wide font-semibold">Petición realizada</p>
          <p className="font-mono text-gray-700">
            <span className="font-bold">{r.request.method}</span> {r.request.url}
          </p>
          <p className="text-gray-500">Autenticación: {r.request.auth}</p>
        </div>
      )}

      {/* Error */}
      {r.error && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-red-600 font-mono">{r.error}</p>
        </div>
      )}

      {/* Datos crudos recolectados */}
      {r.raw && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-gray-400 uppercase tracking-wide font-semibold text-xs mb-1">
            Datos recolectados (respuesta cruda)
          </p>
          <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto max-h-72">
{r.parsed ? JSON.stringify(r.parsed, null, 2) : r.raw}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function DiagnosticoAPI() {
  const [pending, start] = useTransition()
  const [resSync, setResSync] = useState<DemoResultado | null>(null)
  const [resLNA,  setResLNA]  = useState<DemoResultado | null>(null)
  const [cargando, setCargando] = useState<'sync' | 'lna' | null>(null)

  // LNA inputs
  const [url, setUrl]   = useState('https://')
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')

  function correrSync() {
    setCargando('sync'); setResSync(null)
    start(async () => {
      const r = await probarConexionSyncDemo()
      setResSync(r); setCargando(null)
    })
  }

  function correrLNA() {
    setCargando('lna'); setResLNA(null)
    start(async () => {
      const r = await probarConexionLNADemo({ url, user, pass })
      setResLNA(r); setCargando(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Sync Cloud API */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">1 · Sync Cloud API (nube de Logitech)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Llamada saliente con autenticación por certificado (mTLS). Lee las salas desde la nube.
            </p>
          </div>
          <button
            onClick={correrSync}
            disabled={pending}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {cargando === 'sync' ? 'Consultando…' : 'Ejecutar llamada'}
          </button>
        </div>
        {resSync && <ResultadoPanel r={resSync} />}
      </section>

      {/* CollabOS LNA */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">2 · CollabOS local (LNA)</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Llamada local al dispositivo en la red. Ejecutar desde un equipo con acceso a la subred de las salas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="sm:col-span-3">
            <label className="block text-xs text-gray-500 mb-1">URL del dispositivo</label>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://192.168.1.50/status"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Usuario LNA</label>
            <input value={user} onChange={e => setUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contraseña LNA</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-end">
            <button
              onClick={correrLNA}
              disabled={pending}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {cargando === 'lna' ? 'Consultando…' : 'Ejecutar llamada'}
            </button>
          </div>
        </div>
        {resLNA && <ResultadoPanel r={resLNA} />}
      </section>
    </div>
  )
}
