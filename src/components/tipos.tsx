import { Fuel, Ticket, UtensilsCrossed, Wrench, PackageOpen, BedDouble, Droplet, Receipt, type LucideIcon } from 'lucide-react'

export const ICONE_TIPO: Record<string, LucideIcon> = {
  Diesel: Fuel, 'Pedágio': Ticket, 'Alimentação': UtensilsCrossed, Borracharia: Wrench,
  'Chapa / descarga': PackageOpen, Estadia: BedDouble, 'Arla 32': Droplet, Outros: Receipt,
}
export const NOME_TIPO: Record<string, string> = {
  Diesel: 'Combustível', 'Pedágio': 'Pedágio', 'Alimentação': 'Alimentação', Borracharia: 'Borracharia',
  'Chapa / descarga': 'Chapa e descarga', Estadia: 'Estadia', 'Arla 32': 'Arla 32', Outros: 'Outros',
}
export function IconeTipo({ tipo, className = 'ico' }: { tipo: string; className?: string }) {
  const I = ICONE_TIPO[tipo] ?? Receipt
  return <I className={className} />
}

export const STATUS: Record<string, { t: string; c: string }> = {
  pendente: { t: 'Aguardando aprovação', c: 'warn' }, aprovada: { t: 'Aprovado', c: 'ok' }, recusada: { t: 'Recusado', c: 'bad' },
}
