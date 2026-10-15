'use client'
// Envio de formulário com progresso real (porcentagem do upload). fetch() ainda não informa o progresso do envio,
// por isso usa XMLHttpRequest. Erro de rede vira { rede: true } para quem chamou decidir (ex.: guardar na fila).

export type RespostaEnvio = { status: number; json: Record<string, unknown>; rede?: false } | { rede: true }

export function enviarComProgresso(url: string, corpo: FormData, aoProgredir?: (fracao: number) => void, metodo = 'POST'): Promise<RespostaEnvio> {
  return new Promise((ok) => {
    const x = new XMLHttpRequest()
    x.open(metodo, url)
    x.responseType = 'json'
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgredir?.(Math.min(0.98, e.loaded / e.total)) }
    x.onload = () => { aoProgredir?.(1); ok({ status: x.status, json: (x.response as Record<string, unknown>) ?? {} }) }
    x.onerror = () => ok({ rede: true })
    x.ontimeout = () => ok({ rede: true })
    x.timeout = 120000
    x.send(corpo)
  })
}
