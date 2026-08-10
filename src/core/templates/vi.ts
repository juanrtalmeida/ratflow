import { espalhar, formatarLista } from './common.ts'
import type { Template } from './types.ts'

export const vi: Template = {
  id: 'vi',
  label: 'Intervalo variável (VI)',
  icone: '⏱',
  resumo: 'A primeira resposta depois de um intervalo de tempo variável é reforçada.',
  explicacao:
    'Um intervalo (sorteado em torno de uma média) precisa passar antes que o reforço fique ' +
    'disponível; a partir daí, a primeira resposta na alavanca é reforçada. Produz uma taxa de ' +
    'resposta estável, pouco sensível a pausar depois do reforço — ao contrário da razão.',
  params: [
    { id: 'intervaloMedio', label: 'Intervalo médio (s)', type: 'numero', default: '30' },
    { id: 'espalhamento', label: 'Espalhamento (passo entre valores, s)', type: 'numero', default: '10' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => {
    const lista = formatarLista(espalhar(Number(v.intervaloMedio), Number(v.espalhamento)))
    return `\\ Intervalo variável (VI ${v.intervaloMedio}")
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1
^Pelota   = 1

VAR_ALIAS
  Respostas     = A
  Reforcos      = B
  IntervaloAtual = C
END

LIST Intervalos = ${lista}

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0; RANDD C = Intervalos ---> S2

S2, \\@nome: Esperando o intervalo \\@papel: espera \\@pos: 360,140
  C": ---> S3

S3, \\@nome: Reforço disponível \\@papel: espera \\@pos: 680,140
  #R^Alavanca: ADD A; ON ^Pelota; ADD B; RANDD C = Intervalos ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`
  },
}
