'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const sections = [
  {
    label: 'CLIENTES',
    items: [
      { href: '/admin/empresas',  label: 'Empresas',   icon: '⬡', modulo: 'empresas'  },
      { href: '/admin/contactos', label: 'Contactos',  icon: '◈', modulo: 'contactos' },
      { href: '/admin/clientes',  label: 'Usuarios',   icon: '◎', modulo: 'clientes'  },
    ],
  },
  {
    label: 'VENTA',
    items: [
      { href: '/admin/proyectos',    label: 'Proyectos',    icon: '◫', modulo: 'proyectos'    },
      { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: '◑', modulo: 'cotizaciones' },
      { href: '/admin/ordenes',      label: 'Órdenes',      icon: '▣', modulo: 'ordenes'      },
      { href: '/admin/productos',    label: 'Productos',    icon: '▦', modulo: 'productos'    },
    ],
  },
  {
    label: 'POST-VENTA',
    items: [
      { href: '/admin/tickets', label: 'Tickets', icon: '◉', modulo: 'tickets' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { href: '/admin/finanzas',                label: 'Dashboard',    icon: '◈', modulo: 'finanzas' },
      { href: '/admin/finanzas/movimientos',    label: 'Movimientos',  icon: '⇅', modulo: 'finanzas' },
      { href: '/admin/finanzas/cobrar',         label: 'Por cobrar',   icon: '◎', modulo: 'finanzas' },
      { href: '/admin/finanzas/pagar',          label: 'Por pagar',    icon: '◑', modulo: 'finanzas' },
      { href: '/admin/finanzas/rentabilidad',   label: 'Rentabilidad', icon: '◫', modulo: 'finanzas' },
      { href: '/admin/finanzas/flujo',          label: 'Flujo de caja',icon: '▣', modulo: 'finanzas' },
      { href: '/admin/finanzas/gastos-fijos',   label: 'Gastos fijos', icon: '◇', modulo: 'finanzas' },
    ],
  },
  {
    label: 'SALAS',
    items: [
      { href: '/admin/rooms',               label: 'Estado de salas', icon: '⬡', modulo: 'rooms' },
      { href: '/admin/rooms/alertas',       label: 'Alertas',         icon: '◉', modulo: 'rooms' },
      { href: '/admin/rooms/configuracion', label: 'Configuración',   icon: '◇', modulo: 'rooms' },
    ],
  },
]

const configNav = { href: '/admin/configuracion', label: 'Configuración', icon: '⚙' }

export default function Sidebar({
  tenantNombre,
  brandColor = '#059669',
  modulos,
}: {
  tenantNombre?: string | null
  brandColor?:   string
  modulos?:      string[]
}) {
  const modulosSet = new Set(modulos ?? [])
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  // Menú lateral como cajón deslizable en celular
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [pathname])   // cerrar al navegar

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  /** Clases + style para el estado activo con color dinámico */
  function activeStyle(active: boolean) {
    return active
      ? { style: { backgroundColor: brandColor }, className: 'text-white' }
      : { style: undefined, className: 'text-gray-400 hover:bg-gray-800 hover:text-white' }
  }

  const collapsedUI = collapsed && !mobileOpen

  return (
    <>
      {/* Barra superior — solo celular */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-gray-900 text-white flex items-center gap-3 px-4 print:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-800 text-xl leading-none"
        >
          ☰
        </button>
        <span className="font-bold tracking-tight truncate">{tenantNombre ?? 'Admin'}</span>
      </div>

      {/* Fondo oscuro al abrir el menú en celular */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 print:hidden"
        />
      )}

    <aside
      className={`w-60 ${collapsedUI ? 'md:w-14' : 'md:w-60'} shrink-0 bg-gray-900 text-white flex flex-col h-screen fixed md:sticky top-0 left-0 z-50 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-all duration-200 print:hidden`}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center border-b border-gray-700 ${collapsedUI ? 'md:justify-center md:py-4 md:px-2 px-4 py-5' : 'px-4 py-5'}`}>
        {!collapsedUI && (
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold tracking-tight truncate block" title={tenantNombre ?? ''}>
              {tenantNombre ?? 'Admin'}
            </span>
            <span className="text-xs font-medium" style={{ color: brandColor }}>Panel de administración</span>
          </div>
        )}
        {/* Colapsar — solo escritorio */}
        <button
          onClick={toggleCollapsed}
          title={collapsedUI ? 'Expandir menú' : 'Colapsar menú'}
          className="ml-auto flex-shrink-0 w-7 h-7 hidden md:flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors text-sm"
        >
          {collapsedUI ? '›' : '‹'}
        </button>
        {/* Cerrar — solo celular */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="ml-auto flex-shrink-0 w-8 h-8 flex md:hidden items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Dashboard */}
      <div className="px-2 pt-3">
        {(() => {
          const { style, className } = activeStyle(pathname === '/admin')
          return (
            <Link href="/admin" title="Dashboard" style={style}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${collapsedUI ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${className}`}
            >
              <span className="text-base">⊞</span>
              {!collapsedUI &&'Dashboard'}
            </Link>
          )
        })()}
      </div>

      {/* Secciones agrupadas */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {sections.map(section => {
          const visibles = modulos
            ? section.items.filter(i => modulosSet.has(i.modulo))
            : section.items
          if (visibles.length === 0) return null
          return (
            <div key={section.label}>
              {!collapsedUI &&(
                <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  {section.label}
                </p>
              )}
              {collapsedUI && <div className="border-t border-gray-700 my-2" />}
              <div className="space-y-0.5">
                {visibles.map(item => {
                  const { style, className } = activeStyle(isActive(item.href))
                  return (
                    <Link key={item.href} href={item.href} title={item.label} style={style}
                      className={`flex items-center rounded-lg text-sm font-medium transition-colors ${collapsedUI ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${className}`}
                    >
                      <span className="text-base">{item.icon}</span>
                      {!collapsedUI &&item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Configuración */}
      <div className="px-2 pb-2">
        {(() => {
          const { style, className } = activeStyle(isActive(configNav.href))
          return (
            <Link href={configNav.href} title={configNav.label} style={style}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${collapsedUI ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${className}`}
            >
              <span className="text-base">{configNav.icon}</span>
              {!collapsedUI &&configNav.label}
            </Link>
          )
        })()}
      </div>

      {/* Sign out */}
      <div className="px-2 py-4 border-t border-gray-700">
        <button
          onClick={signOut}
          title="Cerrar sesión"
          className={`w-full flex items-center rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${
            collapsedUI ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <span className="text-base">⇤</span>
          {!collapsedUI &&'Cerrar sesión'}
        </button>
      </div>
    </aside>
    </>
  )
}
