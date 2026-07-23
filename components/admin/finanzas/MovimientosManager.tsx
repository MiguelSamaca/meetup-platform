'use client'

import { useState, useTransition, useMemo } from 'react'
import { fmt } from '@/lib/format'
import {
  crearMovimiento,
  editarMovimiento,
  eliminarMovimiento,
  crearCuenta,
  editarCuenta,
  eliminarCuenta,
  crearCategoria,
  importarMovimientosExistentes,
  type NuevoMovimiento,
} from '@/app/actions/movimientos'

interface Cuenta    { id: string; nombre: string; tipo: string; saldo_inicial: number }
interface Categoria { id: string; nombre: string; clase: string }
interface Proyecto  { id: string; nombre: string }
interface Movimiento {
  id: string; fecha: string; tipo: string; monto: number; concepto: string | null
  clasificacion: string; recurrente: boolean
  cuenta_id: string | null; categoria_id: string | null; proyecto_id: string | null
}

const CLASES = [
  { v: 'operacional',    l: 'Operacional' },
  { v: 'administrativo', l: 'Administrativo' },
  { v: 'financiero',     l: 'Financiero' },
  { v: 'proyecto',       l: 'Proyecto' },
  { v: 'otro',           l: 'Otro' },
]
const claseColor: Record<string, string> = {
  operacional:    'bg-blue-50 text-blue-700',
  administrativo: 'bg-amber-50 text-amber-700',
  financiero:     'bg-violet-50 text-violet-700',
  proyecto:       'bg-indigo-50 text-indigo-700',
  otro:           'bg-gray-100 text-gray-600',
}

/** Input de dinero: símbolo $ y separador de miles. Guarda solo dígitos. */
function MoneyInput({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const display = value ? Number(value).toLocaleString('es-CO') : ''
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export default function MovimientosManager({
  cuentas, categorias, proyectos, movimientos,
}: {
  cuentas: Cuenta[]; categorias: Categoria[]; proyectos: Proyecto[]; movimientos: Movimiento[]
}) {
  const [pending, start] = useTransition()
  const hoy = new Date().toISOString().slice(0, 10)

  // Form movimiento
  const [tipo, setTipo]           = useState<'entrada' | 'salida'>('salida')
  const [monto, setMonto]         = useState('')
  const [fecha, setFecha]         = useState(hoy)
  const [concepto, setConcepto]   = useState('')
  const [cuentaId, setCuentaId]   = useState(cuentas[0]?.id ?? '')
  const [clasif, setClasif]       = useState('operacional')
  const [categoriaId, setCatId]   = useState('')
  const [proyectoId, setProyId]   = useState('')
  const [recurrente, setRecu]     = useState(false)

  // Filtros lista
  const [fClase, setFClase]   = useState('')
  const [fCuenta, setFCuenta] = useState('')

  // Importación
  const [importMsg, setImportMsg] = useState('')
  function importar() {
    setImportMsg('')
    start(async () => {
      const r = await importarMovimientosExistentes()
      setImportMsg(r.importados > 0
        ? `Se importaron ${r.importados} movimiento(s) de proyectos.`
        : 'No hay movimientos nuevos por importar (ya están todos).')
    })
  }

  const cuentaNombre = useMemo(() => new Map(cuentas.map(c => [c.id, c.nombre])), [cuentas])
  const catNombre    = useMemo(() => new Map(categorias.map(c => [c.id, c.nombre])), [categorias])
  const proyNombre   = useMemo(() => new Map(proyectos.map(p => [p.id, p.nombre])), [proyectos])

  // Conceptos ya guardados (para autocompletar) y su última clasificación/categoría.
  // `movimientos` viene ordenado por fecha desc → el primero es el más reciente.
  const conceptosPrevios = useMemo(() => {
    const m = new Map<string, { clasificacion: string; categoria_id: string | null }>()
    for (const mv of movimientos) {
      const c = mv.concepto?.trim()
      if (c && !m.has(c)) m.set(c, { clasificacion: mv.clasificacion, categoria_id: mv.categoria_id })
    }
    return m
  }, [movimientos])

  /** Al escribir/elegir el concepto, si ya se usó antes hereda clasificación y categoría. */
  function onConceptoChange(v: string) {
    setConcepto(v)
    const previo = conceptosPrevios.get(v.trim())
    if (previo) {
      setClasif(previo.clasificacion)
      setCatId(previo.categoria_id ?? '')
    }
  }

  // Saldo por cuenta = saldo_inicial + entradas − salidas
  const saldos = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cuentas) m.set(c.id, c.saldo_inicial ?? 0)
    for (const mv of movimientos) {
      if (!mv.cuenta_id) continue
      const s = m.get(mv.cuenta_id) ?? 0
      m.set(mv.cuenta_id, s + (mv.tipo === 'entrada' ? mv.monto : -mv.monto))
    }
    return m
  }, [cuentas, movimientos])

  const movsFiltrados = movimientos.filter(mv =>
    (!fClase  || mv.clasificacion === fClase) &&
    (!fCuenta || mv.cuenta_id === fCuenta)
  )
  const totMes = useMemo(() => {
    const mesActual = hoy.slice(0, 7)
    let ent = 0, sal = 0
    for (const mv of movimientos) {
      if (!mv.fecha?.startsWith(mesActual)) continue
      if (mv.tipo === 'entrada') ent += mv.monto; else sal += mv.monto
    }
    return { ent, sal }
  }, [movimientos, hoy])

  function guardar() {
    const m = Number(monto)
    if (!m || m <= 0) return
    const data: NuevoMovimiento = {
      cuenta_id: cuentaId || null, fecha, tipo, monto: m, concepto,
      clasificacion: clasif, categoria_id: categoriaId || null,
      proyecto_id: proyectoId || null, recurrente,
    }
    start(async () => {
      await crearMovimiento(data)
      // Volver todo a valores por defecto (no heredar el movimiento anterior)
      setTipo('salida')
      setMonto('')
      setFecha(hoy)
      setConcepto('')
      setCuentaId(cuentas[0]?.id ?? '')
      setClasif('operacional')
      setCatId('')
      setProyId('')
      setRecu(false)
    })
  }

  const catsVisibles = categorias.filter(c => c.clase === clasif || c.clase === 'otro')

  return (
    <div className="space-y-6">
      {/* Importar movimientos ya hechos */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-indigo-900">¿Ya tienes cobros y gastos de proyectos?</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Importa los anticipos y saldos recibidos y los gastos ya registrados. No se duplican si lo repites.
          </p>
          {importMsg && <p className="text-xs font-semibold text-indigo-800 mt-1">{importMsg}</p>}
        </div>
        <button onClick={importar} disabled={pending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {pending ? 'Importando…' : 'Importar movimientos existentes'}
        </button>
      </div>

      {/* Resumen de cuentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cuentas.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{c.nombre}</p>
            <p className={`text-2xl font-bold mt-1 ${(saldos.get(c.id) ?? 0) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              ${fmt(saldos.get(c.id) ?? 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{c.tipo}</p>
          </div>
        ))}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Este mes</p>
          <p className="text-sm font-bold text-emerald-700 mt-1">+${fmt(totMes.ent)}</p>
          <p className="text-sm font-bold text-red-600">−${fmt(totMes.sal)}</p>
        </div>
      </div>

      {/* Sin cuentas → crear */}
      {cuentas.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">Primero crea tus cuentas (ej. Davibank Corriente, Davibank Ahorros)</p>
          <CrearCuentaForm pending={pending} />
        </div>
      )}

      {/* Formulario rápido de movimiento */}
      {cuentas.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Registrar movimiento</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Tipo */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                <button type="button" onClick={() => setTipo('salida')}
                  className={`flex-1 py-2 text-sm font-medium ${tipo === 'salida' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`}>Salida</button>
                <button type="button" onClick={() => setTipo('entrada')}
                  className={`flex-1 py-2 text-sm font-medium ${tipo === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600'}`}>Entrada</button>
              </div>
            </div>
            {/* Monto */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto</label>
              <MoneyInput value={monto} onChange={setMonto} placeholder="0" />
            </div>
            {/* Fecha */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* Cuenta */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cuenta</label>
              <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {/* Concepto */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Concepto</label>
              <input
                value={concepto}
                onChange={e => onConceptoChange(e.target.value)}
                list="conceptos-guardados"
                placeholder="Descripción del movimiento"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <datalist id="conceptos-guardados">
                {[...conceptosPrevios.keys()].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            {/* Clasificación */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Clasificación</label>
              <select value={clasif} onChange={e => { setClasif(e.target.value); setCatId('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CLASES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            {/* Categoría */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoría</label>
              <select value={categoriaId} onChange={e => setCatId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sin categoría —</option>
                {catsVisibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {/* Proyecto */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Proyecto (opcional)</label>
              <select value={proyectoId} onChange={e => setProyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Ninguno —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            {/* Recurrente + guardar */}
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input type="checkbox" checked={recurrente} onChange={e => setRecu(e.target.checked)} className="w-4 h-4" />
                Cada mes
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">
              {recurrente ? 'Se marcará como recurrente (se proyectará en el flujo de caja).' : 'Movimiento puntual.'}
            </p>
            <button onClick={guardar} disabled={pending || !monto}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {pending ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros + lista */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-gray-800 mr-auto">Movimientos ({movsFiltrados.length})</h2>
          <select value={fCuenta} onChange={e => setFCuenta(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600">
            <option value="">Todas las cuentas</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={fClase} onChange={e => setFClase(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600">
            <option value="">Todas las clasificaciones</option>
            {CLASES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <div className="divide-y divide-gray-50">
          {movsFiltrados.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No hay movimientos con estos filtros.</p>
          )}
          {movsFiltrados.map(mv => (
            <MovimientoRow key={mv.id} mv={mv} pending={pending} start={start}
              cuentas={cuentas} categorias={categorias} proyectos={proyectos}
              cuentaNombre={cuentaNombre} catNombre={catNombre} proyNombre={proyNombre} />
          ))}
        </div>
      </div>

      {/* Gestión de cuentas y categorías */}
      <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden group">
        <summary className="px-5 py-3 cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-gray-700">
          <span className="text-gray-400 text-xs transition-transform group-open:rotate-90">▶</span>
          Cuentas y categorías
        </summary>
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cuentas</p>
            <div className="space-y-2 mb-3">
              {cuentas.map(c => <EditableCuenta key={c.id} cuenta={c} pending={pending} start={start} />)}
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Nueva cuenta</p>
            <CrearCuentaForm pending={pending} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nueva categoría</p>
            <form action={crearCategoria} className="flex flex-col gap-2">
              <input name="nombre" placeholder="Nombre de la categoría" required
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <select name="clase" className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {CLASES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
              <button type="submit" className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900">
                Agregar categoría
              </button>
            </form>
          </div>
        </div>
      </details>
    </div>
  )
}

function MovimientoRow({
  mv, pending, start, cuentas, categorias, proyectos, cuentaNombre, catNombre, proyNombre,
}: {
  mv: Movimiento; pending: boolean; start: (fn: () => void) => void
  cuentas: Cuenta[]; categorias: Categoria[]; proyectos: Proyecto[]
  cuentaNombre: Map<string, string>; catNombre: Map<string, string>; proyNombre: Map<string, string>
}) {
  const [editando, setEditando] = useState(false)
  const [tipo, setTipo]         = useState<'entrada' | 'salida'>(mv.tipo as 'entrada' | 'salida')
  const [monto, setMonto]       = useState(String(mv.monto))
  const [fecha, setFecha]       = useState(mv.fecha)
  const [concepto, setConcepto] = useState(mv.concepto ?? '')
  const [cuentaId, setCuentaId] = useState(mv.cuenta_id ?? '')
  const [clasif, setClasif]     = useState(mv.clasificacion)
  const [categoriaId, setCatId] = useState(mv.categoria_id ?? '')
  const [proyectoId, setProyId] = useState(mv.proyecto_id ?? '')
  const [recurrente, setRecu]   = useState(mv.recurrente)

  function guardar() {
    const m = Number(monto)
    if (!m || m <= 0) return
    start(async () => {
      await editarMovimiento(mv.id, {
        cuenta_id: cuentaId || null, fecha, tipo, monto: m, concepto,
        clasificacion: clasif, categoria_id: categoriaId || null,
        proyecto_id: proyectoId || null, recurrente,
      })
      setEditando(false)
    })
  }

  if (editando) {
    return (
      <div className="px-5 py-3 bg-blue-50/40 border-l-2 border-blue-400">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-300 col-span-2 md:col-span-1">
            <button type="button" onClick={() => setTipo('salida')} className={`flex-1 py-1.5 text-xs font-medium ${tipo === 'salida' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`}>Salida</button>
            <button type="button" onClick={() => setTipo('entrada')} className={`flex-1 py-1.5 text-xs font-medium ${tipo === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600'}`}>Entrada</button>
          </div>
          <MoneyInput value={monto} onChange={setMonto} placeholder="Monto" />
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">— Sin cuenta —</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Concepto" className="col-span-2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          <select value={clasif} onChange={e => setClasif(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            {CLASES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <select value={categoriaId} onChange={e => setCatId(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">— Categoría —</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={proyectoId} onChange={e => setProyId(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="">— Proyecto —</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={recurrente} onChange={e => setRecu(e.target.checked)} className="w-4 h-4" /> Cada mes
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => setEditando(false)} className="px-3 py-1.5 text-gray-500 text-xs">Cancelar</button>
          <button onClick={guardar} disabled={pending} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">Guardar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center px-5 py-3 hover:bg-gray-50">
      <span className={`text-xs font-bold w-5 ${mv.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>
        {mv.tipo === 'entrada' ? '↑' : '↓'}
      </span>
      <div className="flex-1 min-w-0 ml-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800 truncate">{mv.concepto || 'Sin concepto'}</p>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${claseColor[mv.clasificacion] ?? 'bg-gray-100'}`}>
            {mv.clasificacion}
          </span>
          {mv.recurrente && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">↻ mensual</span>}
        </div>
        <p className="text-xs text-gray-400">
          {new Date(mv.fecha + 'T12:00:00').toLocaleDateString('es-CO')}
          {mv.cuenta_id && ` · ${cuentaNombre.get(mv.cuenta_id) ?? ''}`}
          {mv.categoria_id && ` · ${catNombre.get(mv.categoria_id) ?? ''}`}
          {mv.proyecto_id && ` · 📁 ${proyNombre.get(mv.proyecto_id) ?? ''}`}
        </p>
      </div>
      <span className={`font-bold text-sm w-32 text-right ${mv.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
        {mv.tipo === 'entrada' ? '+' : '−'}${fmt(mv.monto)}
      </span>
      <button onClick={() => setEditando(true)} className="ml-3 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
      <button onClick={() => start(() => eliminarMovimiento(mv.id))} disabled={pending}
        className="ml-2 text-gray-300 hover:text-red-500 text-sm" title="Eliminar">✕</button>
    </div>
  )
}

function EditableCuenta({
  cuenta, pending, start,
}: {
  cuenta: Cuenta; pending: boolean; start: (fn: () => void) => void
}) {
  const [editando, setEditando] = useState(false)

  if (!editando) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700 border border-gray-100 rounded-lg px-3 py-2">
        <span className="flex-1">{cuenta.nombre} <span className="text-gray-400 text-xs capitalize">· {cuenta.tipo}</span></span>
        <span className="text-xs text-gray-400">inicial ${fmt(cuenta.saldo_inicial ?? 0)}</span>
        <button onClick={() => setEditando(true)} className="text-blue-500 hover:text-blue-700 text-xs">Editar</button>
        <button
          onClick={() => { if (confirm(`¿Eliminar la cuenta "${cuenta.nombre}"? Los movimientos quedarán sin cuenta.`)) start(() => eliminarCuenta(cuenta.id)) }}
          disabled={pending} className="text-gray-300 hover:text-red-500 text-sm" title="Eliminar">✕</button>
      </div>
    )
  }

  return (
    <form action={editarCuenta.bind(null, cuenta.id)} onSubmit={() => setEditando(false)}
      className="flex flex-wrap gap-2 items-end border border-blue-200 bg-blue-50/40 rounded-lg p-2">
      <input name="nombre" defaultValue={cuenta.nombre} required
        className="flex-1 min-w-[140px] px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
      <select name="tipo" defaultValue={cuenta.tipo} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
        <option value="corriente">Corriente</option>
        <option value="ahorros">Ahorros</option>
        <option value="efectivo">Efectivo</option>
        <option value="otro">Otro</option>
      </select>
      <input name="saldo_inicial" type="number" defaultValue={cuenta.saldo_inicial ?? 0}
        className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Guardar</button>
      <button type="button" onClick={() => setEditando(false)} className="px-2 py-1.5 text-gray-500 text-xs">Cancelar</button>
    </form>
  )
}

function CrearCuentaForm({ pending }: { pending: boolean }) {
  return (
    <form action={crearCuenta} className="flex flex-wrap gap-2 items-end">
      <input name="nombre" placeholder="Nombre (ej. Davibank Corriente)" required
        className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <select name="tipo" className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
        <option value="corriente">Corriente</option>
        <option value="ahorros">Ahorros</option>
        <option value="efectivo">Efectivo</option>
        <option value="otro">Otro</option>
      </select>
      <input name="saldo_inicial" type="number" placeholder="Saldo inicial" defaultValue="0"
        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <button type="submit" disabled={pending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        Agregar cuenta
      </button>
    </form>
  )
}
