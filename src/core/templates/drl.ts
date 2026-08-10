import type { Template } from './types.ts'

export const drl: Template = {
  id: 'drl',
  label: 'Taxa baixa diferencial (DRL)',
  icone: '🐢',
  resumo: 'Só reforça uma resposta que vem depois de um intervalo mínimo sem responder.',
  explicacao:
    'Uma resposta cedo demais (antes do intervalo mínimo passar) não reforça e reinicia a espera. ' +
    'Só a primeira resposta depois de esperar o suficiente é reforçada. Ensina o sujeito a espaçar ' +
    'as respostas — o oposto do que a razão ensina.',
  params: [
    { id: 'intervaloMinimo', label: 'Intervalo mínimo sem responder (s)', type: 'numero', default: '15' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => `\\ Taxa baixa diferencial (DRL ${v.intervaloMinimo}")
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1
^Pelota   = 1

VAR_ALIAS
  Respostas   = A
  Prematuras  = C
  Reforcos    = B
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0, C = 0 ---> S2

S2, \\@nome: Esperando o intervalo \\@papel: espera \\@pos: 360,140
  #R^Alavanca: ADD C ---> S2
  ${v.intervaloMinimo}": ---> S3

S3, \\@nome: Pronto para reforçar \\@papel: espera \\@pos: 680,140
  #R^Alavanca: ADD A; ON ^Pelota; ADD B ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`,
}
