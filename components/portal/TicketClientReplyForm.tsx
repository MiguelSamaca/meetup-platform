'use client'

import { useState } from 'react'
import { agregarMensajeCliente } from '@/app/actions/tickets'

export default function TicketClientReplyForm({ ticketId }: { ticketId: string }) {
  const [sending, setSending] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function handleSubmit(formData: FormData) {
    setSending(true)
    try {
      await agregarMensajeCliente(ticketId, formData)
      setFormKey(k => k + 1)
    } finally {
      setSending(false)
    }
  }

  return (
    <form key={formKey} action={handleSubmit} className="border-t border-gray-200 pt-4">
      <textarea
        name="mensaje"
        required
        rows={3}
        placeholder="Escribe tu mensaje..."
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
      />
      <div className="flex justify-end mt-2">
        <button
          type="submit"
          disabled={sending}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {sending ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </div>
    </form>
  )
}
