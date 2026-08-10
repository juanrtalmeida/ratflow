import type { Template } from './types.ts'

export const pr: Template = {
  id: 'pr',
  label: 'Razão progressiva (PR) com ruptura',
  icone: '📈',
  resumo: 'A razão exigida sobe a cada reforço, até o sujeito desistir — mede o quanto ele "paga".',
  explicacao:
    'Depois de cada reforço, a razão exigida aumenta (aqui, soma um incremento fixo). Se o tempo ' +
    'limite passar sem completar a próxima razão, isso é registrado como o «ponto de ruptura» — a ' +
    'medida de motivação do esquema. Este template só registra o ponto de ruptura (`SHOW`); ' +
    'encerrar a sessão automaticamente nesse momento pede um segundo processo, como o "Sessão" da ' +
    'fixture de referência `fr5-sintetico.MPC`.',
  params: [
    { id: 'razaoInicial', label: 'Razão inicial', type: 'numero', default: '2' },
    { id: 'incremento', label: 'Incremento a cada reforço', type: 'numero', default: '2' },
    { id: 'limiteTempo', label: 'Tempo limite sem completar a razão (s)', type: 'numero', default: '120' },
    { id: 'duracaoPulso', label: 'Duração do pulso do dispensador (s)', type: 'numero', default: '0.05' },
  ],
  gerar: (v) => `\\ Razão progressiva (PR, início ${v.razaoInicial}, incremento ${v.incremento})
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1
^Pelota   = 1

VAR_ALIAS
  Respostas  = A
  Reforcos   = B
  RazaoAtual = C
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0, B = 0, C = ${v.razaoInicial} ---> S2

S2, \\@nome: Esperando resposta \\@papel: espera \\@pos: 360,140
  #R^Alavanca: ADD A; IF A >= C [@Reforco, @Continua]
       @Reforco: SET A = 0 ---> S3
       @Continua: ---> SX
  ${v.limiteTempo}": SHOW 1, Ruptura, C ---> SX

S3, \\@nome: Reforço \\@papel: reforco \\@pos: 680,140
  .01": ON ^Pelota; ADD B; SET C = C + ${v.incremento} ---> S4

S4, \\@nome: Pulso \\@papel: reforco \\@pos: 1000,140 \\@macro: pulso ^Pelota ${v.duracaoPulso}
  ${v.duracaoPulso}": OFF ^Pelota ---> S2
`,
}
