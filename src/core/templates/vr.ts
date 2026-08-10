import { espalhar, formatarLista } from './common.ts'
import type { Template } from './types.ts'

export const vr: Template = {
  id: 'vr',
  label: 'Razão variável (VR)',
  icone: '🎲',
  resumo: 'Reforça a cada N respostas, mas N muda a cada vez, em torno de uma média.',
  explicacao:
    'Como a razão fixa, mas o número de respostas exigido varia — sorteado de uma lista espalhada ' +
    'em torno da «Razão média» a cada reforço. Produz uma taxa de resposta mais estável e resistente ' +
    'à extinção do que a razão fixa.',
  params: [
    { id: 'razaoMedia', label: 'Razão média', type: 'numero', default: '10' },
    {
      id: 'espalhamento',
      label: 'Espalhamento (passo entre valores)',
      type: 'numero',
      default: '3',
    },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => {
    const lista = formatarLista(espalhar(Number(v.razaoMedia), Number(v.espalhamento)))
    return `\\ Razão variável (VR ${v.razaoMedia})
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1
^Pelota   = 1

VAR_ALIAS
  Respostas   = A
  Reforcos    = B
  RazaoAtual  = C
END

LIST Razoes = ${lista}

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0; RANDD C = Razoes ---> S2

S2, \\@nome: Esperando resposta \\@papel: espera \\@pos: 360,140
  #R^Alavanca: ADD A; IF A >= C [@Reforco, @Continua]
       @Reforco: SET A = 0 ---> S3
       @Continua: ---> SX

S3, \\@nome: Reforço \\@papel: reforco \\@pos: 680,140
  .01": ON ^Pelota; ADD B; RANDD C = Razoes ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`
  },
}
