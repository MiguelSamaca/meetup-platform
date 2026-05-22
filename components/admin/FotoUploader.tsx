'use client'

import { useState, useEffect, useRef } from 'react'

async function resizeAndUpload(file: File): Promise<string> {
  const MAX = 700
  const blob: Blob = await new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
      const c = document.createElement('canvas')
      c.width = width; c.height = height
      c.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      c.toBlob(b => resolve(b!), 'image/jpeg', 0.87)
    }
    img.src = url
  })
  const fd = new FormData()
  fd.append('file', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  fd.append('tipo', 'producto')
  const res  = await fetch('/api/upload', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error subiendo imagen')
  return json.url as string
}

interface Props {
  value:    string
  onChange: (url: string) => void
  /** Nombre para el hidden input (útil en formularios con Server Actions) */
  name?:    string
  /** 'sm' = 64×64 px (filas de tabla), 'lg' = 128×128 px (formulario de producto) */
  size?:    'sm' | 'lg'
}

export default function FotoUploader({ value, onChange, name, size = 'lg' }: Props) {
  const [active,   setActive]   = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)

  const dim      = size === 'sm' ? 'w-16 h-16' : 'w-32 h-32'
  const iconSize = size === 'sm' ? 'text-xl'   : 'text-4xl'
  const txtSize  = size === 'sm' ? 'text-[10px] leading-tight' : 'text-xs leading-snug'

  async function handleFile(file: File) {
    setSubiendo(true)
    setActive(false)
    try {
      const url = await resizeAndUpload(file)
      onChange(url)
    } catch {
      // silencio — podríamos mostrar un toast aquí
    } finally {
      setSubiendo(false)
    }
  }

  /* ── Escucha Ctrl+V solo cuando esta zona está activa ── */
  useEffect(() => {
    if (!active) return
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const img   = items.find(it => it.type.startsWith('image/'))
      const file  = img?.getAsFile()
      if (file) { e.preventDefault(); handleFile(file) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  /* ── Click fuera desactiva el modo paste ── */
  useEffect(() => {
    if (!active) return
    function onOut(e: MouseEvent) {
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) {
        setActive(false)
      }
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [active])

  return (
    <div ref={zoneRef} className="inline-block">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {/* Hidden input para Server Actions con FormData */}
      {name && <input type="hidden" name={name} value={value} />}

      {value ? (
        /* ── Con imagen ── */
        <div
          className={`relative group ${dim} rounded-lg overflow-hidden border border-gray-200 cursor-pointer`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f) }}
        >
          <img src={value} alt="foto" className="w-full h-full object-cover object-center" />
          {/* Overlay al hacer hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-semibold drop-shadow">Cambiar</span>
          </div>
          {/* Botón quitar */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
          >×</button>
        </div>
      ) : (
        /* ── Sin imagen: zona de carga ── */
        <button
          type="button"
          disabled={subiendo}
          onClick={() => { setActive(true); fileRef.current?.click() }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f?.type.startsWith('image/')) handleFile(f)
          }}
          title="Click para subir · Ctrl+V para pegar · Arrastrar imagen"
          className={`${dim} border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all font-medium ${txtSize}
            ${active
              ? 'border-emerald-500 bg-emerald-50 text-emerald-600 scale-105 shadow-sm'
              : 'border-gray-300 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50'
            }`}
        >
          {subiendo ? (
            <span className="animate-pulse text-gray-400 text-2xl">…</span>
          ) : active ? (
            <>
              <span className={iconSize}>📋</span>
              <span className="text-center">Ctrl+V<br />o arrastra</span>
            </>
          ) : (
            <>
              <span className={iconSize}>📷</span>
              <span className="text-center">Foto de<br />producto</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
