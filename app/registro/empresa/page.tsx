'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegistroEmpresaPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre_empresa: '',
    nombre_admin: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    try {
      const data = new FormData()
      Object.entries(form).forEach(([k, v]) => data.append(k, v))

      const res = await fetch('/api/registro/empresa', {
        method: 'POST',
        body: data,
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Error al registrar la empresa.')
        setLoading(false)
        return
      }

      router.push('/login?registered=empresa')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl mb-4">
            <span className="text-2xl">⬡</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registra tu empresa</h1>
          <p className="text-gray-500 text-sm mt-2">
            Crea tu cuenta de empresa integradora y empieza a gestionar tus proyectos AV.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sección empresa */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tu empresa</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la empresa *
              </label>
              <input
                type="text"
                required
                value={form.nombre_empresa}
                onChange={e => update('nombre_empresa', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Integración AV Colombia S.A.S."
              />
            </div>
          </div>

          {/* Sección administrador */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Administrador principal</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  required
                  value={form.nombre_admin}
                  onChange={e => update('nombre_admin', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="admin@tuempresa.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar *</label>
                  <input
                    type="password"
                    required
                    value={form.confirm}
                    onChange={e => update('confirm', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Creando cuenta…' : 'Crear empresa y cuenta admin'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-emerald-600 hover:underline">Ingresar</Link>
        </p>
      </div>
    </main>
  )
}
