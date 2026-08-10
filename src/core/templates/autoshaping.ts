import type { Template } from './types.ts'

export const autoshaping: Template = {
  id: 'autoshaping',
  label: 'Autoshaping (aproximação pavloviana)',
  icone: '💡',
  resumo: 'Um estímulo acende por um tempo fixo e o reforço vem sozinho, respondendo ou não.',
  explicacao:
    'Condicionamento pavloviano: o estímulo (aqui, a luz da alavanca) fica aceso por uma duração ' +
    'fixa; se o sujeito responder durante esse tempo, o reforço vem na hora — mas mesmo sem ' +
    'resposta nenhuma, o reforço vem de qualquer jeito assim que o estímulo apaga. É como o ' +
    'comportamento de se aproximar do estímulo (sign-tracking) se desenvolve sem exigir nada.',
  params: [
    { id: 'duracaoEstimulo', label: 'Duração do estímulo (s)', type: 'numero', default: '8' },
    { id: 'intervaloEntreTentativas', label: 'Intervalo entre tentativas (s)', type: 'numero', default: '30' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => `\\ Autoshaping / aproximação pavloviana (CS de ${v.duracaoEstimulo} s)
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca      = 1
^LuzAlavanca   = 1
^Pelota        = 1

VAR_ALIAS
  Respostas = A
  Reforcos  = B
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0 ---> S2

S2, \\@nome: Intervalo entre tentativas \\@papel: espera \\@pos: 360,140
  ${v.intervaloEntreTentativas}": ON ^LuzAlavanca ---> S3

S3, \\@nome: Estímulo aceso \\@papel: espera \\@pos: 680,140
  #R^Alavanca: ADD A; OFF ^LuzAlavanca; ON ^Pelota; ADD B ---> S4
  ${v.duracaoEstimulo}": OFF ^LuzAlavanca; ON ^Pelota; ADD B ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`,
}
