'use client'

import { useState, useEffect, useRef } from 'react'

type MensajeConAutor = {
  id: string
  mensaje: string
  created_at: string
  profiles: { nombre: string; rol: string } | null
}

export default function TicketThread({
  ticketId,
  initialMensajes,
  isAdmin = false,
}: {
  ticketId: string
  initialMensajes: MensajeConAutor[]
  isAdmin?: boolean
}) {
  const [mensajes, setMensajes]   = useState(initialMensajes)
  const [updating, setUpdating]   = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const prevCountRef              = useRef(initialMensajes.length)

  useEffect(() => {
    const interval = setInterval(async () => {
      setUpdating(true)
      try {
        const res = await fetch(`/api/tickets/${ticketId}/mensajes`)
        if (res.ok) {
          const data: MensajeConAutor[] = await res.json()
          setMensajes(data)
        }
      } finally {
        setUpdating(false)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [ticketId])

  // Scroll to bottom only when new messages arrive
  useEffect(() => {
    if (mensajes.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCountRef.current = mensajes.length
  }, [mensajes.length])

  return (
    <div className="relative min-h-24">
      {updating && (
        <span className="absolute top-0 right-0 text-xs text-gray-300 select-none">●</span>
      )}

      <div className="space-y-4 p-5">
        {mensajes.length > 0 ? (
          mensajes.map(m => {
            const autorRol = m.profiles?.rol ?? 'cliente'
            // En admin: mensajes admin = derecha (propios). En portal: mensajes cliente = derecha (propios)
            const isOwn = isAdmin ? autorRol === 'admin' : autorRol === 'cliente'

            return (
              <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  isOwn
                    ? 'bg-emerald-500 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${isOwn ? 'text-emerald-100' : 'text-gray-500'}`}>
                    {m.profiles?.nombre ?? 'Soporte'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.mensaje}</p>
                  <p className={`text-xs mt-1.5 ${isOwn ? 'text-emerald-200' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleString('es-CO', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Sin mensajes aún.</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
