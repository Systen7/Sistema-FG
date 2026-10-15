import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { POST } from '@/app/api/m/despesas/route'
import { DELETE, PATCH } from '@/app/api/m/despesas/[id]/route'
import { hoje } from '@/lib/datas'
import { base, entrarComo, limpar } from './banco'

beforeEach(limpar)

const form = (campos: Record<string, string | File>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}
const req = (f: FormData, metodo = 'POST') => new Request('http://localhost/api/m/despesas', { method: metodo, body: f })
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const lancar = async (campos: Record<string, string | File>) => {
  const r = await POST(req(form(campos)))
  return { status: r.status, json: await r.json() }
}

describe('API de gastos do motorista (banco de verdade)', () => {
  it('sem sessão não lança nada', async () => {
    const { v } = await base()
    const r = await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '45,90' })
    expect(r.status).toBe(401)
    expect(await db.select().from(s.despesas)).toHaveLength(0)
  })

  it('lança gasto pendente com foto e registra na auditoria', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const foto = new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], 'c.jpg', { type: 'image/jpeg' })
    const r = await lancar({ viagemId: String(v.id), tipo: 'Diesel', valor: '1.250,40', litros: '200,5', pagoPor: 'empresa', foto, clientId: 'abc-1' })
    expect(r).toMatchObject({ status: 200, json: { ok: true } })
    const [d] = await db.select().from(s.despesas)
    expect(d).toMatchObject({ valor: 125040, litros: 200.5, status: 'pendente', pagoPor: 'empresa', data: hoje() })
    expect(d.fotoId).toBeTruthy()
    const log = await db.select().from(s.auditoria).where(eq(s.auditoria.entidade, 'despesa'))
    expect(log[0]).toMatchObject({ autor: `motorista:${mot.id}`, acao: 'lançou' })
  })

  it('reenvio com o mesmo clientId (fila sem sinal) não duplica', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const campos = { viagemId: String(v.id), tipo: 'Pedágio', valor: '45,90', clientId: 'fila-7' }
    const a = await lancar(campos)
    const b = await lancar(campos)
    expect(b.json).toMatchObject({ ok: true, repetido: true, id: a.json.id })
    expect(await db.select().from(s.despesas)).toHaveLength(1)
  })

  it('não lança na viagem de outro motorista', async () => {
    const { v } = await base()
    const [outro] = await db.insert(s.motoristas).values({ nome: 'Outro', telefone: '66900000009', pinHash: 'x' }).returning()
    await entrarComo(outro)
    const r = await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10' })
    expect(r.status).toBe(404)
  })

  it('data fora da viagem vira hoje; dados inválidos são recusados com mensagem', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10', data: '2020-01-01' })
    expect((await db.select().from(s.despesas))[0].data).toBe(hoje())
    expect((await lancar({ viagemId: String(v.id), tipo: 'Diesel', valor: '10' })).json.erro).toBe('Informe quantos litros abasteceu.')
    expect((await lancar({ viagemId: String(v.id), tipo: 'Pizza', valor: '10' })).json.erro).toBe('Escolha o tipo do gasto.')
    const pdf = new File(['%PDF'], 'x.pdf', { type: 'application/pdf' })
    expect((await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10', foto: pdf })).json.erro).toBe('A foto precisa ser uma imagem.')
  })

  it('corrigir volta o gasto para aprovação; aprovado não pode ser apagado', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const { json } = await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10' })
    await db.update(s.despesas).set({ status: 'recusada', motivoRecusa: 'valor errado' }).where(eq(s.despesas.id, json.id))
    const r = await PATCH(req(form({ tipo: 'Pedágio', valor: '12,50' }), 'PATCH'), ctx(json.id))
    expect(r.status).toBe(200)
    const [d] = await db.select().from(s.despesas)
    expect(d).toMatchObject({ valor: 1250, status: 'pendente', motivoRecusa: null })

    await db.update(s.despesas).set({ status: 'aprovada' }).where(eq(s.despesas.id, json.id))
    expect((await DELETE(req(new FormData(), 'DELETE'), ctx(json.id))).status).toBe(409)
  })

  it('viagem encerrada não aceita correção pelo celular', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const { json } = await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10' })
    await db.update(s.viagens).set({ status: 'encerrada', fim: hoje(), kmFinal: 101000 }).where(eq(s.viagens.id, v.id))
    const r = await PATCH(req(form({ tipo: 'Pedágio', valor: '1' }), 'PATCH'), ctx(json.id))
    expect(r.status).toBe(409)
  })

  it('apagar remove o gasto e a foto dele', async () => {
    const { mot, v } = await base()
    await entrarComo(mot)
    const foto = new File([Buffer.from([1, 2, 3])], 'c.png', { type: 'image/png' })
    const { json } = await lancar({ viagemId: String(v.id), tipo: 'Pedágio', valor: '10', foto })
    expect(await db.select().from(s.fotos)).toHaveLength(1)
    expect((await DELETE(req(new FormData(), 'DELETE'), ctx(json.id))).status).toBe(200)
    expect(await db.select().from(s.despesas)).toHaveLength(0)
    expect(await db.select().from(s.fotos)).toHaveLength(0)
  })
})
