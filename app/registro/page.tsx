'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegistroPage() {
  const router = useRouter()
  const [form, setForm] = useState({ nombre: '', email: '', empresa: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
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
    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { nombre: form.nombre, empresa: form.empresa, rol: 'cliente' },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push('/login?registered=1')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Accede al portal de seguimiento de tu proyecto</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { id: 'nombre',   label: 'Nombre completo',        type: 'text',     placeholder: 'Juan Pérez' },
            { id: 'email',    label: 'Correo electrónico',      type: 'email',    placeholder: 'juan@empresa.com' },
            { id: 'empresa',  label: 'Empresa (opcional)',      type: 'text',     placeholder: 'Mi Empresa S.A.S.' },
            { id: 'password', label: 'Contraseña',              type: 'password', placeholder: '••••••••' },
            { id: 'confirm',  label: 'Confirmar contraseña',    type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.id}>
              <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <input
                id={field.id}
                type={field.type}
                required={field.id !== 'empresa'}
                value={form[field.id as keyof typeof form]}
                onChange={e => update(field.id, e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder={field.placeholder}
              />
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-emerald-600 hover:underline">Ingresar</a>
        </p>
      </div>
    </main>
  )
}
