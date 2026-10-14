'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirMotorista, confere, hash } from '@/lib/auth'
import { viagemAtiva } from '@/lib/dados'
import { hoje } from '@/lib/datas'
import { lerNumero, lerReais } from '@/lib/format'
import { registrar } from '@/lib/audit'

export type Resp = { erro?: string; campo?: string } | undefined
const okUrl = (t: string) => '/m?ok=' + encodeURIComponent(t)

export async function iniciarViagem(f: FormData): Promise<Resp> {
  const m = await exigirMotorista()
  if (!m.caminhaoId) return { erro: 'Você está sem caminhão no cadastro. Fale com o escritório.' }
  if (await viagemAtiva(m.id)) return { erro: 'Você já tem uma viagem em andamento. Encerre antes de iniciar outra.' }
  const [cam] = await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, m.caminhaoId))
  const origem = String(f.get('origem') ?? '').trim().slice(0, 80)
  const destino = String(f.get('destino') ?? '').trim().slice(0, 80)
  const carga = String(f.get('carga') ?? '').trim().slice(0, 80)
  if (!origem) return { erro: 'Digite a cidade de origem.', campo: 'origem' }
  if (!destino) return { erro: 'Digite a cidade de destino.', campo: 'destino' }
  if (!carga) return { erro: 'Digite a carga.', campo: 'carga' }
  const semFrete = f.get('semFrete') === '1'
  const frete = semFrete ? 0 : lerReais(f.get('frete'))
  if (frete === null || (!semFrete && frete <= 0)) return { erro: 'Digite o valor do frete ou marque que não sabe.', campo: 'frete' }
  const km = lerNumero(f.get('km'))
  if (!km || km <= 0) return { erro: 'Digite o km do caminhão.', campo: 'km' }
  if (km < cam.km) return { erro: `O km não pode ser menor que o último registrado (${cam.km.toLocaleString('pt-BR')}).`, campo: 'km' }
  const inicio = String(f.get('inicio') ?? '') || hoje()
  try {
    const [v] = await db.insert(s.viagens).values({
      motoristaId: m.id, caminhaoId: cam.id, origem, destino, carga, frete, comissaoPct: m.comissaoPct, inicio, kmInicial: Math.round(km), status: 'andamento',
    }).returning()
    await db.update(s.caminhoes).set({ km: Math.round(km) }).where(eq(s.caminhoes.id, cam.id))
    await registrar('motorista:' + m.id, 'iniciou', 'viagem', v.id, { origem, destino, frete })
  } catch (e) {
    if (String(e).includes('viagem_ativa_por_motorista')) return { erro: 'Você já tem uma viagem em andamento.' }
    throw e
  }
  revalidatePath('/m')
  redirect(okUrl('Viagem iniciada. Boa viagem!'))
}

export async function encerrarViagem(f: FormData): Promise<Resp> {
  const m = await exigirMotorista()
  const v = await viagemAtiva(m.id)
  if (!v) redirect('/m')
  const kmFinal = lerNumero(f.get('kmFinal'))
  if (!kmFinal || kmFinal <= v.kmInicial) return { erro: `O km final precisa ser maior que o inicial (${v.kmInicial.toLocaleString('pt-BR')}).`, campo: 'kmFinal' }
  const vazio = f.get('voltouVazio') === '1' ? lerNumero(f.get('kmVazio')) ?? 0 : 0
  if (vazio < 0 || vazio >= kmFinal - v.kmInicial) return { erro: 'O km rodado vazio precisa ser menor que o total da viagem.', campo: 'kmVazio' }
  const fim = String(f.get('fim') ?? '') || hoje()
  if (fim < v.inicio) return { erro: 'A chegada não pode ser antes do início da viagem.' }
  if (fim > hoje()) return { erro: 'A data de chegada não pode ser no futuro.' }
  await db.update(s.viagens).set({ kmFinal: Math.round(kmFinal), kmVazio: Math.round(vazio), fim, status: 'encerrada' })
    .where(and(eq(s.viagens.id, v.id), eq(s.viagens.status, 'andamento')))
  await db.update(s.caminhoes).set({ km: Math.round(kmFinal) }).where(eq(s.caminhoes.id, v.caminhaoId))
  await registrar('motorista:' + m.id, 'encerrou', 'viagem', v.id, { kmFinal, vazio, fim })
  revalidatePath('/m')
  redirect('/m/extrato?ok=' + encodeURIComponent('Viagem encerrada. Confira seu extrato.'))
}

export async function trocarPin(f: FormData): Promise<Resp> {
  const m = await exigirMotorista()
  const atual = String(f.get('atual') ?? ''), novo = String(f.get('novo') ?? ''), conf = String(f.get('confirma') ?? '')
  if (!(await confere(atual, m.pinHash))) return { erro: 'O PIN atual não confere.', campo: 'atual' }
  if (!/^\d{4}$/.test(novo)) return { erro: 'O novo PIN precisa ter 4 números.', campo: 'novo' }
  if (/^(\d)\1{3}$/.test(novo) || ['1234', '4321', '0123'].includes(novo)) return { erro: 'Escolha um PIN menos óbvio.', campo: 'novo' }
  if (novo !== conf) return { erro: 'A confirmação não bate com o novo PIN.', campo: 'confirma' }
  await db.update(s.motoristas).set({ pinHash: await hash(novo) }).where(eq(s.motoristas.id, m.id))
  await registrar('motorista:' + m.id, 'trocou o PIN', 'motorista', m.id)
  redirect('/m/conta?ok=' + encodeURIComponent('PIN alterado'))
}
