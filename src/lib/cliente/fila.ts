'use client'
// Fila de gastos para quando o celular está sem sinal.
// Cada lançamento ganha um clientId no aparelho; o servidor ignora repetições, então reenviar é seguro.

export type ItemFila = {
  clientId: string; motoristaId: number; viagemId: number; tipo: string; valor: string; litros?: string; kmAbastecimento?: string
  obs?: string; pagoPor: string; data: string; foto?: Blob | null; criadoEm: number
}

import { enviarComProgresso } from './envio'

const DB = 'fg-motorista', STORE = 'fila', EVENTO = 'fg:fila'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'clientId' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => falha(r.error)
  })
}
async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((ok, falha) => {
    const t = db.transaction(STORE, modo)
    const r = f(t.objectStore(STORE))
    t.oncomplete = () => { ok(r.result); db.close() }
    t.onerror = () => { falha(t.error); db.close() }
  })
}
export const listar = () => tx<ItemFila[]>('readonly', (s) => s.getAll() as IDBRequest<ItemFila[]>).catch(() => [] as ItemFila[])
const guardar = (i: ItemFila) => tx('readwrite', (s) => s.put(i))
const remover = (id: string) => tx('readwrite', (s) => s.delete(id))
const avisar = () => window.dispatchEvent(new Event(EVENTO))
export const aoMudar = (f: () => void) => { window.addEventListener(EVENTO, f); return () => window.removeEventListener(EVENTO, f) }

export function novoId() {
  return (crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2))
}

function formData(i: ItemFila) {
  const f = new FormData()
  for (const [k, v] of Object.entries(i)) if (v != null && k !== 'foto' && k !== 'criadoEm' && k !== 'motoristaId') f.set(k, String(v))
  if (i.foto) f.set('foto', i.foto, 'comprovante.jpg')
  return f
}

export type Resultado = { estado: 'enviado' } | { estado: 'na-fila' } | { estado: 'erro'; erro: string }

/** Tenta enviar agora; sem sinal, guarda no aparelho e envia depois sozinho. */
export async function enviarGasto(i: ItemFila, aoProgredir?: (fracao: number) => void): Promise<Resultado> {
  if (!navigator.onLine) { await guardar(i); avisar(); return { estado: 'na-fila' } }
  const r = await enviarComProgresso('/api/m/despesas', formData(i), aoProgredir)
  if (r.rede || r.status >= 500 || r.status === 0) { await guardar(i); avisar(); return { estado: 'na-fila' } }
  if (r.status < 300) return { estado: 'enviado' }
  return { estado: 'erro', erro: typeof r.json.erro === 'string' ? r.json.erro : 'Não foi possível enviar.' }
}

let rodando = false
export type Sincronia = { enviados: number; recusados: string[] }
/** Envia o que ficou guardado por este motorista. Itens de outro motorista no mesmo celular ficam esperando o dono entrar. */
export async function sincronizar(motoristaId: number): Promise<Sincronia> {
  const r: Sincronia = { enviados: 0, recusados: [] }
  if (rodando || !navigator.onLine) return r
  rodando = true
  try {
    for (const i of await listar()) {
      if (i.motoristaId != null && i.motoristaId !== motoristaId) continue // itens antigos, sem dono gravado, vão com quem estiver conectado
      try {
        const res = await fetch('/api/m/despesas', { method: 'POST', body: formData(i) })
        if (res.ok) { await remover(i.clientId); r.enviados++; continue }
        if (res.status === 401) break
        // Recusa definitiva (ex.: viagem apagada pelo escritório): sai da fila, mas o motorista é avisado.
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          const j = await res.json().catch(() => ({}))
          await remover(i.clientId)
          r.recusados.push(`${i.tipo === 'Diesel' ? 'Combustível' : i.tipo} de R$ ${i.valor.replace('.', ',')}: ${j.erro ?? 'recusado pelo sistema'}`)
        }
      } catch { break }
    }
  } finally {
    rodando = false
    avisar()
  }
  return r
}

/** Data de hoje no fuso da empresa, calculada no celular na hora do lançamento. */
export function hojeLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Reduz a foto no próprio celular (máx. 1600 px, JPEG) para enviar rápido mesmo com sinal fraco. */
export async function reduzirFoto(arq: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arq, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close?.()
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.72))
    return b ?? arq
  } catch {
    return arq
  }
}
