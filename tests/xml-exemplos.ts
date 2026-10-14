// XML de exemplo no formato oficial (CT-e 4.00 e MDF-e 3.00), usados nos testes.
// Monta uma chave válida: UF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) + DV
export function chave(modelo: '57' | '58', numero: number) {
  const base = `51${'2610'}12345678000199${modelo}001${String(numero).padStart(9, '0')}1${'12345678'}`
  let soma = 0, peso = 2
  for (let i = 42; i >= 0; i--) { soma += Number(base[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  const r = soma % 11
  return base + (r < 2 ? 0 : 11 - r)
}

export const CTE = (ch: string, extra = '', dia = '2026-10-10') => `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <CTe><infCte Id="CTe${ch}" versao="4.00">
    <ide><cUF>51</cUF><CFOP>6352</CFOP><mod>57</mod><serie>1</serie><nCT>1234</nCT><dhEmi>${dia}T08:15:00-04:00</dhEmi>
      <xMunIni>RONDONOPOLIS</xMunIni><UFIni>MT</UFIni><xMunFim>SANTOS</xMunFim><UFFim>SP</UFFim></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>FG TRANSPORTES LTDA</xNome></emit>
    <rem><xNome>AGRO SOJA SA</xNome></rem><dest><xNome>TERMINAL PORTUARIO SANTOS</xNome></dest>
    <vPrest><vTPrest>13800.00</vTPrest><vRec>13800.00</vRec></vPrest>
    <infCTeNorm><infCarga><vCarga>98000.00</vCarga><proPred>SOJA EM GRAOS</proPred>
      <infQ><cUnid>03</cUnid><tpMed>UNIDADE</tpMed><qCarga>1.0000</qCarga></infQ>
      <infQ><cUnid>01</cUnid><tpMed>PESO BRUTO</tpMed><qCarga>37000.0000</qCarga></infQ></infCarga>
      <infModal versaoModal="4.00"><rodo><RNTRC>12345678</RNTRC></rodo></infModal></infCTeNorm>
  </infCte></CTe>
  <protCTe versao="4.00"><infProt><chCTe>${ch}</chCTe><dhRecbto>2026-10-10T08:16:00-04:00</dhRecbto><nProt>151260000012345</nProt><cStat>100</cStat><xMotivo>Autorizado o uso do CT-e</xMotivo></infProt></protCTe>
  ${extra}
</cteProc>`

export const MDFE = (ch: string, chCte: string, dia = '2026-10-10', placa = 'RKT-4E21') => `<?xml version="1.0" encoding="UTF-8"?>
<mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <MDFe><infMDFe Id="MDFe${ch}" versao="3.00">
    <ide><cUF>51</cUF><mod>58</mod><serie>1</serie><nMDF>77</nMDF><dhEmi>${dia}T09:00:00-04:00</dhEmi><UFIni>MT</UFIni><UFFim>SP</UFFim>
      <infMunCarrega><cMunCarrega>5107602</cMunCarrega><xMunCarrega>RONDONOPOLIS</xMunCarrega></infMunCarrega></ide>
    <emit><xNome>FG TRANSPORTES LTDA</xNome></emit>
    <infModal versaoModal="3.00"><rodo><veicTracao><placa>${placa}</placa><condutor><xNome>VALDIR</xNome><CPF>00000000000</CPF></condutor></veicTracao>
      <veicReboque><placa>RLB8F45</placa></veicReboque></rodo></infModal>
    <infDoc><infMunDescarga><cMunDescarga>3548500</cMunDescarga><xMunDescarga>SANTOS</xMunDescarga><infCTe><chCTe>${chCte}</chCTe></infCTe></infMunDescarga></infDoc>
    <tot><qCTe>1</qCTe><vCarga>98000.00</vCarga><cUnid>02</cUnid><qCarga>37.0000</qCarga></tot>
    <prodPred><tpCarga>01</tpCarga><xProd>SOJA</xProd></prodPred>
  </infMDFe></MDFe>
  <protMDFe versao="3.00"><infProt><chMDFe>${ch}</chMDFe><nProt>951260000001111</nProt><cStat>100</cStat></infProt></protMDFe>
</mdfeProc>`

export const ENCERRAMENTO = (ch: string) => `<procEventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <eventoMDFe versao="3.00"><infEvento Id="ID110112${ch}01"><chMDFe>${ch}</chMDFe><dhEvento>2026-10-13T17:30:00-03:00</dhEvento><tpEvento>110112</tpEvento></infEvento></eventoMDFe>
  <retEventoMDFe versao="3.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo></infEvento></retEventoMDFe>
</procEventoMDFe>`

