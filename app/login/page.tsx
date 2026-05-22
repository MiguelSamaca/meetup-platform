'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/app/actions/auth'
import Link from 'next/link'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)
  const searchParams = useSearchParams()
  const registered   = searchParams.get('registered')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AVCore</h1>
          <p className="text-gray-500 text-sm mt-1">Plataforma integral para integradores AV</p>
        </div>

        {registered === 'empresa' && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 text-center">
            ✓ Empresa registrada. Ya puedes iniciar sesión.
          </div>
        )}
        {registered === '1' && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 text-center">
            ✓ Cuenta creada. Ya puedes iniciar sesión.
          </div>
        )}

        <form action={action} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="tu@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
          <p className="text-xs text-gray-400">
            ¿Eres una empresa integradora?{' '}
            <Link href="/registro/empresa" className="text-emerald-600 hover:underline font-medium">
              Regístrate aquí
            </Link>
          </p>
          <p className="text-xs text-gray-400">
            ¿Problemas para acceder?{' '}
            <a href="mailto:soporte@avcore.app" className="text-emerald-600 hover:underline">
              Contacta soporte
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
