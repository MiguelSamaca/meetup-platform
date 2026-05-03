'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PortalNav({ nombre }: { nombre: string }) {
  const router   = useRouter()
  const pathname = usePathname()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== '/portal' && pathname.startsWith(href))
    return `text-sm font-medium transition-colors ${active ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-gray-900">
            MeetUp <span className="text-emerald-500 font-medium text-sm">Portal</span>
          </span>
          <nav className="flex items-center gap-6">
            <Link href="/portal" className={linkClass('/portal')}>Mis proyectos</Link>
            <Link href="/portal/tickets" className={linkClass('/portal/tickets')}>Soporte</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Hola, <span className="font-medium text-gray-700">{nombre}</span></span>
          <button
            onClick={signOut}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
