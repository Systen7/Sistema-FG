import { eq } from 'drizzle-orm'
import { MessageCircle } from 'lucide-react'
import { db, schema as s } from '@/db'
import { exigirMotorista } from '@/lib/auth'
import { config } from '@/lib/dados'
import { dataLonga, num, telefone } from '@/lib/format'
import { sair } from '@/app/entrar/actions'
import { TrocarPin, Instalar, Sair } from './conta-cliente'

export const metadata = { title: 'Minha conta' }

export default async function Conta() {
  const m = await exigirMotorista()
  const cfg = await config()
  const [cam] = m.caminhaoId ? await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, m.caminhaoId)) : []
  return (
    <>
      <div>
        <h1>{m.nome}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {telefone(m.telefone)}
        </p>
      </div>
      <Instalar />
      <section className="panel">
        <h2>Meus dados</h2>
        <div className="list">
          <div>
            <span>Caminhão</span>
            <span>
              {cam ? (
                <>
                  <span className="plate">{cam.placa}</span>
                  {cam.placaCarreta && (
                    <>
                      {' '}
                      <span className="plate">{cam.placaCarreta}</span>
                    </>
                  )}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div>
            <span>Comissão sobre o frete</span>
            <b>{num(m.comissaoPct, m.comissaoPct % 1 ? 1 : 0)}%</b>
          </div>
          <div>
            <span>Validade da CNH</span>
            <span>{dataLonga(m.cnhAte)}</span>
          </div>
          <div>
            <span>Exame toxicológico</span>
            <span>{dataLonga(m.toxicologicoAte)}</span>
          </div>
        </div>
        <p className="small muted">Algum dado errado? Avise o escritório.</p>
      </section>
      <TrocarPin />
      {cfg.whatsappEscritorio && (
        <a className="acao" href={`https://wa.me/55${cfg.whatsappEscritorio}`}>
          <MessageCircle className="ico" />
          <span>
            Falar com o escritório<small>Abre o WhatsApp</small>
          </span>
        </a>
      )}
      <Sair acao={sair} />
    </>
  )
}
