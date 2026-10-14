'use client'
// Fila de gastos para quando o celular está sem sinal.
// Cada lançamento ganha um clientId no aparelho; o servidor ignora repetições, então reenviar é seguro.

export type ItemFila = {
  clientId: string; viagemId: number; tipo: string; valor: string; litros?: string; kmAbastecimento?: string
  obs?: string; pagoPor: string; data: string; foto?: Blob | null; criadoEm: number
}

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
  for (const [k, v] of Object.entries(i)) if (v != null && k !== 'foto' && k !== 'criadoEm') f.set(k, String(v))
  if (i.foto) f.set('foto', i.foto, 'comprovante.jpg')
  return f
}

export type Resultado = { estado: 'enviado' } | { estado: 'na-fila' } | { estado: 'erro'; erro: string }

/** Tenta enviar agora; sem sinal, guarda no aparelho e envia depois sozinho. */
export async function enviarGasto(i: ItemFila): Promise<Resultado> {
  if (!navigator.onLine) { await guardar(i); avisar(); return { estado: 'na-fila' } }
  try {
    const r = await fetch('/api/m/despesas', { method: 'POST', body: formData(i) })
    if (r.ok) return { estado: 'enviado' }
    const j = await r.json().catch(() => ({}))
    if (r.status >= 500) { await guardar(i); avisar(); return { estado: 'na-fila' } }
    return { estado: 'erro', erro: j.erro ?? 'Não foi possível enviar.' }
  } catch {
    await guardar(i); avisar(); return { estado: 'na-fila' }
  }
}

let rodando = false
/** Envia o que ficou guardado. Devolve quantos foram enviados. */
export async function sincronizar(): Promise<number> {
  if (rodando || !navigator.onLine) return 0
  rodando = true
  let n = 0
  try {
    for (const i of await listar()) {
      try {
        const r = await fetch('/api/m/despesas', { method: 'POST', body: formData(i) })
        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 408 && r.status !== 429)) {
          // 4xx definitivo (ex.: dado inválido) não fica preso na fila para sempre.
          await remover(i.clientId); n++
        }
        if (r.status === 401) break
      } catch { break }
    }
  } finally {
    rodando = false
    avisar()
  }
  return n
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
