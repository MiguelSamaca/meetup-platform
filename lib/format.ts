/** Formatea número con separador de miles es-CO, sin decimales: 1234567 → "1.234.567" */
export function fmt(n: number) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/** Formatea como moneda COP: 1234567 → "$ 1.234.567" */
export function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
