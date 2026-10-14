// Datas no formato AAAA-MM-DD, sempre no fuso da empresa.
const TZ = process.env.TZ_EMPRESA || 'America/Sao_Paulo'

export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export const mesAtual = () => hoje().slice(0, 7)

export function dias(de: string, ate: string): number {
  return Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5)
}
export function somaDias(d: string, n: number): string {
  const x = new Date(d + 'T12:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
export function somaMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1 + n, 1))
  return x.toISOString().slice(0, 7)
}
export function diasNoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function nomeMes(mes: string, curto = false): string {
  const [a, m] = mes.split('-').map(Number)
  const n = MESES[m - 1]
  return (curto ? n.slice(0, 3) : n[0].toUpperCase() + n.slice(1)) + (curto ? '/' + String(a).slice(2) : ' de ' + a)
}
export function mesValido(m: unknown): m is string {
  return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
}
