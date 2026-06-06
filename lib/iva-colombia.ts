/**
 * Helpers para períodos de IVA en Colombia — DIAN 2026
 *
 * Cuatrimestral  (ingresos < 92,000 UVT año anterior):
 *   Ene-Abr → vence ~20 mayo
 *   May-Ago → vence ~18 septiembre
 *   Sep-Dic → vence ~20 enero año siguiente
 *
 * Bimestral (ingresos ≥ 92,000 UVT año anterior):
 *   Ene-Feb → ~17 marzo | Mar-Abr → ~19 mayo | May-Jun → ~16 julio
 *   Jul-Ago → ~16 sep   | Sep-Oct → ~18 nov  | Nov-Dic → ~20 enero
 *
 * Las fechas exactas varían por el último dígito del NIT.
 * Usamos el punto medio del rango oficial como fecha representativa.
 */

export type IVAPeriodicidad = 'cuatrimestral' | 'bimestral' | 'anual'

export interface PeriodoIVA {
  key:       string  // '2026-C2' | '2026-B3' | '2026-A'
  label:     string  // 'May-Ago 2026'
  mesPago:   string  // 'YYYY-MM'
  fechaPago: string  // 'YYYY-MM-DD' fecha aproximada de vencimiento
}

export function getPeriodoIVA(fechaStr: string, periodicidad: IVAPeriodicidad): PeriodoIVA {
  const d = new Date(fechaStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1 // 1–12

  /* ── Bimestral ── */
  if (periodicidad === 'bimestral') {
    const b      = Math.ceil(m / 2)                                               // 1-6
    const labels = ['Ene-Feb', 'Mar-Abr', 'May-Jun', 'Jul-Ago', 'Sep-Oct', 'Nov-Dic']
    const payMs  = [3, 5, 7, 9, 11, 1]                                           // mes de pago
    const payDs  = [17, 19, 16, 16, 18, 20]                                       // día aprox.
    const payY   = b === 6 ? y + 1 : y
    const payM   = payMs[b - 1]
    const mes    = `${payY}-${String(payM).padStart(2, '0')}`
    return {
      key:       `${y}-B${b}`,
      label:     `${labels[b - 1]} ${y}`,
      mesPago:   mes,
      fechaPago: `${mes}-${String(payDs[b - 1]).padStart(2, '0')}`,
    }
  }

  /* ── Anual ── */
  if (periodicidad === 'anual') {
    return {
      key:       `${y}-A`,
      label:     `Año ${y}`,
      mesPago:   `${y + 1}-01`,
      fechaPago: `${y + 1}-01-20`,
    }
  }

  /* ── Cuatrimestral (default) ── */
  const c      = m <= 4 ? 1 : m <= 8 ? 2 : 3                                     // 1-3
  const labels = ['Ene-Abr', 'May-Ago', 'Sep-Dic']
  const payMs  = [5, 9, 1]
  const payDs  = [20, 18, 20]
  const payY   = c === 3 ? y + 1 : y
  const payM   = payMs[c - 1]
  const mes    = `${payY}-${String(payM).padStart(2, '0')}`
  return {
    key:       `${y}-C${c}`,
    label:     `${labels[c - 1]} ${y}`,
    mesPago:   mes,
    fechaPago: `${mes}-${String(payDs[c - 1]).padStart(2, '0')}`,
  }
}

/** Periodo IVA cuatrimestral vigente para una fecha dada */
export function getPeriodoActual(hoy: Date = new Date()): PeriodoIVA {
  return getPeriodoIVA(hoy.toISOString(), 'cuatrimestral')
}
