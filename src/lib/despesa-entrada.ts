import 'server-only'
import { db, schema as s } from '@/db'
import { TIPOS_DESPESA, lerNumero, lerReais } from './format'

export const MAX_FOTO = 6 * 1024 * 1024

export type EntradaDespesa = {
  tipo: string; valor: number; litros: number | null; kmAbastecimento: number | null; obs: string | null; pagoPor: 'empresa' | 'motorista'; data: string | null
}

/** Lê e valida os campos de uma despesa vindos de um formulário. */
export function lerDespesa(f: FormData): EntradaDespesa | { erro: string } {
  const tipo = String(f.get('tipo') ?? '')
  if (!(TIPOS_DESPESA as readonly string[]).includes(tipo)) return { erro: 'Escolha o tipo do gasto.' }
  const valor = lerReais(f.get('valor'))
  if (!valor || valor <= 0) return { erro: 'Informe o valor.' }
  if (valor > 5_000_000) return { erro: 'Valor muito alto. Confira o número digitado.' }
  const litros = tipo === 'Diesel' ? lerNumero(f.get('litros')) : null
  if (tipo === 'Diesel' && (!litros || litros <= 0)) return { erro: 'Informe quantos litros abasteceu.' }
  if (litros && litros > 2000) return { erro: 'Litros acima do possível para um tanque. Confira.' }
  const km = lerNumero(f.get('kmAbastecimento'))
  const pago = f.get('pagoPor') === 'motorista' ? 'motorista' : 'empresa'
  const obs = String(f.get('obs') ?? '').trim().slice(0, 200) || null
  const data = String(f.get('data') ?? '')
  return { tipo, valor, litros, kmAbastecimento: km ? Math.round(km) : null, obs, pagoPor: pago, data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null }
}

export async function salvarFoto(f: FormData): Promise<string | null | { erro: string }> {
  const foto = f.get('foto')
  if (!(foto instanceof File) || foto.size === 0) return null
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(foto.type)) return { erro: 'A foto precisa ser uma imagem.' }
  if (foto.size > MAX_FOTO) return { erro: 'Foto muito grande.' }
  const dados = Buffer.from(await foto.arrayBuffer())
  const [r] = await db.insert(s.fotos).values({ dados, mime: foto.type, tamanho: foto.size }).returning({ id: s.fotos.id })
  return r.id
}
