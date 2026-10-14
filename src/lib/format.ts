// Formatação em português do Brasil. Dinheiro chega em centavos.
const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const cache = new Map<number, Intl.NumberFormat>()
export function num(v: number | null | undefined, d = 0): string {
  if (!cache.has(d)) cache.set(d, nf(d))
  return cache.get(d)!.format(Number(v) || 0)
}
/** R$ 1.234 (sem centavos), para painéis e resumos */
export function reais(centavos: number): string {
  const v = Math.round(centavos / 100)
  return (v < 0 ? '−' : '') + 'R$ ' + num(Math.abs(v))
}
/** R$ 1.234,56, para lançamentos e acerto */
export function reaisC(centavos: number): string {
  return (centavos < 0 ? '−' : '') + 'R$ ' + num(Math.abs(centavos) / 100, 2)
}
export function dataCurta(d: string | null | undefined): string {
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—'
}
export function dataLonga(d: string | null | undefined): string {
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—'
}
/** "1.234,56" ou "1234.56" ou "1234" -> número; null se inválido */
export function lerNumero(s: unknown): number | null {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null
  if (typeof s !== 'string') return null
  let t = s.replace(/[^\d,.-]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}
/** Reais digitados -> centavos */
export function lerReais(s: unknown): number | null {
  const v = lerNumero(s)
  return v === null ? null : Math.round(v * 100)
}
export function soDigitos(s: string): string {
  return s.replace(/\D/g, '')
}
export function telefone(t: string | null | undefined): string {
  const d = soDigitos(t ?? '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t ?? ''
}
export function primeiroNome(n: string) {
  return n.trim().split(/\s+/)[0]
}
export const TIPOS_DESPESA = ['Diesel', 'Pedágio', 'Alimentação', 'Borracharia', 'Chapa / descarga', 'Estadia', 'Arla 32', 'Outros'] as const
export const nomeTipo = (t: string) => (t === 'Diesel' ? 'Combustível' : t)
