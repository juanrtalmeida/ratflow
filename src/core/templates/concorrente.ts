import type { Template } from './types.ts'

export const concorrente: Template = {
  id: 'concorrente',
  label: 'Esquema concorrente (FR × FR)',
  icone: '⚖️',
  resumo: 'Duas alavancas, cada uma com sua própria razão — o sujeito escolhe entre as duas.',
  explicacao:
    'As duas alavancas competem pelo mesmo reforço, cada uma com sua própria razão. Comparar quantas ' +
    'respostas vão para cada lado mede preferência. Este template usa razão fixa nas duas pontas, ' +
    'por simplicidade — um concorrente VI×VI de verdade (o clássico da lei da igualação) precisa de ' +
    'um relógio por alavanca, o que pede processos separados, como nos arquivos reais de VI-VI ' +
    'concorrente do laboratório.',
  params: [
    { id: 'razaoEsquerda', label: 'Razão — alavanca esquerda', type: 'numero', default: '5' },
    { id: 'razaoDireita', label: 'Razão — alavanca direita', type: 'numero', default: '10' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => `\\ Esquema concorrente FR ${v.razaoEsquerda} × FR ${v.razaoDireita}
\\ Gerado pela biblioteca de templates do RatFlow.

^AlavancaEsq = 1
^AlavancaDir = 2
^Pelota      = 1
^RazaoEsq    = ${v.razaoEsquerda}
^RazaoDir    = ${v.razaoDireita}

VAR_ALIAS
  RespostasEsq = A
  RespostasDir = D
  Reforcos     = B
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, D = 0, B = 0 ---> S2

S2, \\@nome: Esperando resposta \\@papel: espera \\@pos: 360,140
  #R^AlavancaEsq: ADD A; IF A >= ^RazaoEsq [@ReforcoEsq, @ContinuaEsq]
       @ReforcoEsq: SET A = 0 ---> S3
       @ContinuaEsq: ---> SX
  #R^AlavancaDir: ADD D; IF D >= ^RazaoDir [@ReforcoDir, @ContinuaDir]
       @ReforcoDir: SET D = 0 ---> S3
       @ContinuaDir: ---> SX

S3, \\@nome: Reforço \\@papel: reforco \\@pos: 680,140
  .01": ON ^Pelota; ADD B ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`,
}
