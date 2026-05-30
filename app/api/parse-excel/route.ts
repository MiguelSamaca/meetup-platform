import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getCurrentProfile } from '@/lib/auth'

const COL_MAP: Record<string, string> = {
  referencia:  'referencia',
  sku:         'referencia',
  ref:         'referencia',
  descripcion: 'descripcion',
  descripción: 'descripcion',
  nombre:      'descripcion',
  producto:    'descripcion',
  proveedor:   'proveedor',
  marca:       'proveedor',
  brand:       'proveedor',
  unidad:      'unidad',
  unit:        'unidad',
  und:         'unidad',
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb     = XLSX.read(buffer, { type: 'buffer' })
  const ws     = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

  if (rawRows.length < 2) {
    return NextResponse.json({ error: 'El archivo no tiene filas de datos' }, { status: 400 })
  }

  const headers  = rawRows[0].map(h => String(h ?? '').trim().toLowerCase())
  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => {
    const field = COL_MAP[h]
    if (field && !(field in colIndex)) colIndex[field] = i
  })

  const UNIDADES_VALIDAS = ['und', 'm', 'm2', 'kg', 'gl', 'hr', 'kit']

  const filas = rawRows.slice(1).map((row, idx) => {
    const get = (field: string) => String(row[colIndex[field]] ?? '').trim()

    const descripcion = get('descripcion')
    const referencia  = get('referencia')  || null
    const proveedor   = get('proveedor')   || null
    const rawUnidad   = get('unidad').toLowerCase()
    const unidad      = UNIDADES_VALIDAS.includes(rawUnidad) ? rawUnidad : 'und'
    const error       = !descripcion ? 'Descripción vacía' : undefined

    return {
      _fila:       idx + 2,
      referencia,
      proveedor,
      descripcion,
      unidad,
      ...(error ? { _error: error } : {}),
    }
  }).filter(f =>
    // quitar filas completamente vacías
    f.descripcion || f.referencia || f.proveedor
  )

  return NextResponse.json({ filas, total: filas.length })
}
