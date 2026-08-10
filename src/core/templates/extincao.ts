import type { Template } from './types.ts'

export const extincao: Template = {
  id: 'extincao',
  label: 'Extinção',
  icone: '📉',
  resumo: 'A resposta continua sendo contada, mas nunca mais é reforçada.',
  explicacao:
    'Usado depois que um comportamento já foi aprendido, para estudar como ele desaparece quando o ' +
    'reforço para de vir. A alavanca continua registrando respostas — só não há dispensador nenhum ' +
    'ligado a ela. Compare a curva de respostas com a de um esquema de razão para ver a extinção ' +
    'acontecer.',
  params: [],
  gerar: () => `\\ Extinção
\\ Gerado pela biblioteca de templates do RatFlow.

^Alavanca = 1

VAR_ALIAS
  Respostas = A
END

S.S.1, \\@nome: Tarefa
S1, \\@nome: Início \\@papel: espera \\@pos: 40,140
  #START: SET A = 0 ---> S2

S2, \\@nome: Respondendo (sem reforço) \\@papel: espera \\@pos: 360,140
  #R^Alavanca: ADD A ---> S3

S3, \\@nome: Respondendo (sem reforço) \\@papel: espera \\@pos: 680,140
  #R^Alavanca: ADD A ---> S2
`,
}
