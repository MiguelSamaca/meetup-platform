'use client'

import { useRef, useState, useTransition } from 'react'
import { importarProductos, type FilaProductoImport } from '@/app/actions/productos'

type FilaPreview = FilaProductoImport & { _fila: number; _error?: string }

interface Props {
  onClose:     () => void
  onImportado: (n: number) => void
}

export default function ImportarProductosModal({ onClose, onImportado }: Props) {
  const fileRef                          = useRef<HTMLInputElement>(null)
  const [filas,      setFilas]           = useState<FilaPreview[]>([])
  const [fileName,   setFileName]        = useState('')
  const [paso,       setPaso]            = useState<'upload' | 'preview' | 'done'>('upload')
  const [resultado,  setResultado]       = useState<{ insertados: number; errores: string[] } | null>(null)
  const [cargando,   setCargando]        = useState(false)
  const [errorCarga, setErrorCarga]      = useState('')
  const [pending,    start]              = useTransition()

  /* ── Subir y parsear en el servidor ── */
  async function handleFile(file: File) {
    setCargando(true)
    setErrorCarga('')
    setFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/parse-excel', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error procesando el archivo')
      if (!json.filas?.length) throw new Error('No se encontraron filas con datos')
      setFilas(json.filas)
      setPaso('preview')
    } catch (e: any) {
      setErrorCarga(e.message)
    } finally {
      setCargando(false)
    }
  }

  /* ── Descargar plantilla ── */
  function descargarPlantilla() {
    const csv = 'referencia,descripcion,proveedor,unidad\nSKU-001,Proyector Epson EB-X51,Epson,und\nSKU-002,Cable HDMI 5m,Generic,m\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'plantilla_productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Confirmar import ── */
  function handleImportar() {
    const validas: FilaProductoImport[] = filas
      .filter(f => !f._error)
      .map(({ referencia, proveedor, descripcion, unidad }) => ({ referencia, proveedor, descripcion, unidad }))

    start(async () => {
      const res = await importarProductos(validas)
      setResultado(res)
      setPaso('done')
      onImportado(res.insertados)
    })
  }

  const validas   = filas.filter(f => !f._error)
  const invalidas = filas.filter(f =>  f._error)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importar productos desde Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Columnas: <span className="font-mono">referencia · descripcion · proveedor · unidad</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── PASO 1: Upload ── */}
          {paso === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  cargando
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                }`}
                onClick={() => !cargando && fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f && !cargando) handleFile(f)
                }}
              >
                <div className="text-4xl mb-3">{cargando ? '⏳' : '📊'}</div>
                <p className="font-semibold text-gray-700">
                  {cargando ? 'Procesando archivo…' : 'Arrastra tu Excel o CSV aquí, o haz clic para seleccionar'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx · .xls · .csv</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {errorCarga && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  ⚠ {errorCarga}
                </p>
              )}

              {/* Plantilla */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">📋</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">¿Primera vez?</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Descarga la plantilla CSV con el formato correcto y complétala con tus productos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={descargarPlantilla}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  ⬇ Descargar plantilla
                </button>
              </div>

              {/* Instrucciones */}
              <div className="text-xs text-gray-500 space-y-2">
                <p className="font-semibold text-gray-600">Columnas del archivo:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ['referencia', 'SKU del producto (opcional)'],
                    ['descripcion', 'Nombre del producto ✱ obligatorio'],
                    ['proveedor',  'Marca o proveedor (opcional)'],
                    ['unidad',     'und · m · m2 · kg · gl · hr · kit'],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex gap-1.5 items-start">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 w-24 flex-shrink-0">{col}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: Preview ── */}
          {paso === 'preview' && (
            <div className="p-6 space-y-4">
              {/* Resumen */}
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{validas.length}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Productos a importar</p>
                </div>
                {invalidas.length > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{invalidas.length}</p>
                    <p className="text-xs text-red-500 font-medium mt-0.5">Filas omitidas (error)</p>
                  </div>
                )}
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-gray-700 truncate" title={fileName}>{fileName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{filas.length} filas detectadas</p>
                </div>
              </div>

              {/* Tabla preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Fila</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Referencia</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Descripción</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Proveedor</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Unidad</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filas.map(f => (
                      <tr key={f._fila} className={f._error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{f._fila}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{f.referencia ?? '—'}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[200px]">
                          {f.descripcion || <span className="text-red-400 italic">vacío</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{f.proveedor ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{f.unidad}</span>
                        </td>
                        <td className="px-3 py-2">
                          {f._error && <span className="text-red-500 text-xs">⚠ {f._error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PASO 3: Done ── */}
          {paso === 'done' && resultado && (
            <div className="p-10 text-center space-y-4">
              <div className="text-5xl">{resultado.insertados > 0 ? '✅' : '⚠️'}</div>
              <p className="text-xl font-bold text-gray-800">
                {resultado.insertados > 0
                  ? `${resultado.insertados} producto${resultado.insertados !== 1 ? 's' : ''} importado${resultado.insertados !== 1 ? 's' : ''}`
                  : 'No se importaron productos'}
              </p>
              {resultado.errores.length > 0 && (
                <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 space-y-1 max-w-md mx-auto">
                  <p className="font-semibold mb-2">Advertencias:</p>
                  {resultado.errores.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center">
          {paso === 'preview' && (
            <button
              type="button"
              onClick={() => { setPaso('upload'); setFilas([]); setFileName(''); setErrorCarga('') }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Cambiar archivo
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            {paso !== 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            )}
            {paso === 'preview' && (
              <button
                type="button"
                disabled={validas.length === 0 || pending}
                onClick={handleImportar}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {pending ? 'Importando…' : `Importar ${validas.length} producto${validas.length !== 1 ? 's' : ''}`}
              </button>
            )}
            {paso === 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Listo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
