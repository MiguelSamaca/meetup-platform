'use client'

import { useState, useRef } from 'react'

interface Props {
  label:       string
  currentUrl?: string | null
  inputName:   string       // hidden input name que guarda la URL final
  tipo:        'logo' | 'banner' | 'producto'
  maxWidth?:   number       // px máx al redimensionar (default 900)
  aspectHint?: string       // ej. "16:9" solo informativo
}

async function resizeImage(file: File, maxWidth: number): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width  = maxWidth
      }
      const canvas  = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.88)
    }
    img.src = url
  })
}

export default function ImageUploader({
  label, currentUrl, inputName, tipo, maxWidth = 900, aspectHint
}: Props) {
  const [preview,    setPreview]    = useState<string | null>(currentUrl ?? null)
  const [url,        setUrl]        = useState<string>(currentUrl ?? '')
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    try {
      const resized = await resizeImage(file, maxWidth)
      const fd      = new FormData()
      fd.append('file', new File([resized], file.name, { type: 'image/jpeg' }))
      fd.append('tipo', tipo)

      const res  = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error subiendo imagen')

      setUrl(json.url)
      setPreview(json.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {aspectHint && <span className="text-gray-400 font-normal">({aspectHint})</span>}
      </label>

      {/* Preview */}
      {preview && (
        <div className="mb-2">
          <img
            src={preview}
            alt="preview"
            className={`rounded-lg border border-gray-200 object-contain bg-gray-50 ${
              tipo === 'banner' ? 'w-full h-28' : 'h-20'
            }`}
          />
        </div>
      )}

      {/* Hidden input que viaja con el form */}
      <input type="hidden" name={inputName} value={url} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Subiendo…' : preview ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => { setPreview(null); setUrl('') }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Quitar
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
