// Conjunto padrão: cavalo 6x4 (direcional + 2 eixos de tração duplos) e carreta de 3 eixos duplos = 22 pneus.
export const EIXOS: [string, number][] = [['Direcional', 1], ['Tração 1', 2], ['Tração 2', 2], ['Carreta 1', 2], ['Carreta 2', 2], ['Carreta 3', 2]]
export const SULCO_NOVO = 16
export const CUSTO_PNEU_NOVO = 290000 // centavos

export function gerarPneus(caminhaoId: number, novos: boolean) {
  const out: { caminhaoId: number; posicao: number; eixo: string; lado: string; local: string; sulco: number; recapagens: number; km: number; custo: number }[] = []
  let i = 0
  EIXOS.forEach(([eixo, porLado], ax) => {
    for (const lado of ['Esquerdo', 'Direito']) for (let k = 0; k < porLado; k++) {
      const sulco = novos ? SULCO_NOVO : 2 + ((caminhaoId * 7 + i * 5) % 13)
      const rec = novos || !ax ? 0 : (caminhaoId + i) % 3
      out.push({
        caminhaoId, posicao: i, eixo, lado, local: porLado > 1 ? (k ? 'interno' : 'externo') : '',
        sulco, recapagens: rec, km: novos ? 0 : (SULCO_NOVO - sulco) * 9500 + rec * 60000, custo: CUSTO_PNEU_NOVO + rec * 78000,
      })
      i++
    }
  })
  return out
}
