import { espalhar, formatarLista } from './common.ts'
import type { Template } from './types.ts'

export const vt: Template = {
  id: 'vt',
  label: 'Tempo variável (VT)',
  icone: '🎁',
  resumo: 'Entrega o reforço em intervalos de tempo variáveis, sem exigir nenhuma resposta.',
  explicacao:
    'Não-contingente: o dispensador entrega a pelota sozinho, num intervalo sorteado em torno de ' +
    'uma média, sem depender de nada que o sujeito faça. Usado em treino de magazine (ensinar onde ' +
    'está o comedouro) e como controle para esquemas de razão/intervalo.',
  params: [
    { id: 'intervaloMedio', label: 'Intervalo médio (s)', type: 'numero', default: '60' },
    { id: 'espalhamento', label: 'Espalhamento (passo entre valores, s)', type: 'numero', default: '15' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => {
    const lista = formatarLista(espalhar(Number(v.intervaloMedio), Number(v.espalhamento)))
    return `\\ Tempo variável (VT ${v.intervaloMedio}")
\\ Gerado pela biblioteca de templates do RatFlow.

^Pelota = 1

VAR_ALIAS
  Reforcos       = B
  IntervaloAtual = C
END

LIST Intervalos = ${lista}

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET B = 0; RANDD C = Intervalos ---> S2

S2, \\@nome: Esperando o intervalo \\@papel: espera \\@pos: 360,140
  C": ON ^Pelota; ADD B; RANDD C = Intervalos ---> S3

S3, \\@nome: Pulso \\@papel: reforco \\@pos: 680,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`
  },
}
