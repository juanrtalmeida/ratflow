import type { Template } from './types.ts'

export const fr: Template = {
  id: 'fr',
  label: 'Razão fixa (FR)',
  icone: '🍬',
  resumo: 'Reforça a cada N respostas, sempre o mesmo N.',
  explicacao:
    'O esquema mais simples: depois de exatamente «Razão» respostas na alavanca, o dispensador ' +
    'entrega uma pelota e a contagem recomeça do zero. Bom ponto de partida para qualquer coisa nova.',
  params: [
    { id: 'razao', label: 'Razão (respostas por reforço)', type: 'numero', default: '5' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => `\\ Razão fixa (FR ${v.razao})
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1
^Pelota   = 1
^Razao    = ${v.razao}

VAR_ALIAS
  Respostas = A
  Reforcos  = B
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0 ---> S2

S2, \\@nome: Esperando resposta \\@papel: espera \\@pos: 360,140
  #R^Alavanca: ADD A; IF A >= ^Razao [@Reforco, @Continua]
       @Reforco: SET A = 0 ---> S3
       @Continua: ---> SX

S3, \\@nome: Reforço \\@papel: reforco \\@pos: 680,140
  .01": ON ^Pelota; ADD B ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`,
}
