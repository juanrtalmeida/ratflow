export interface GlossaryEntry {
  readonly id: string
  readonly termo: string
  readonly definicao: string
}

/**
 * O glossário in-app. Curto de propósito — cada entrada é uma ou duas
 * frases, o suficiente para desempacar um termo sem virar uma segunda
 * documentação para manter atualizada.
 */
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'processo',
    termo: 'Processo paralelo (S.S.n)',
    definicao:
      'Uma máquina de estados que roda ao mesmo tempo que as outras, cada uma com seu próprio ' +
      'estado atual. Um programa MedState pode ter vários — um cuidando da tarefa, outro só ' +
      'contando o tempo de sessão, por exemplo.',
  },
  {
    id: 'estado',
    termo: 'Estado (Sn)',
    definicao:
      'Um "lugar" onde o processo fica esperando algo acontecer — uma resposta, um tempo, um sinal. ' +
      'Cada regra dentro de um estado diz o que fazer quando esse algo acontece, e para onde ir.',
  },
  {
    id: 'sx',
    termo: '"Fica aqui" (SX)',
    definicao:
      'O destino especial que significa "não muda de estado". Diferente de apontar de volta para o ' +
      'mesmo estado por número, `SX` não reinicia nenhum temporizador em andamento.',
  },
  {
    id: 'sinal-z',
    termo: 'Sinal Z',
    definicao:
      'Como um processo avisa os outros de alguma coisa — "a sessão acabou", "o intervalo passou". ' +
      'É um aviso geral (todo processo que estiver esperando aquele sinal recebe), não uma seta de ' +
      'um processo específico para outro.',
  },
  {
    id: 'diskvars',
    termo: 'DISKVARS',
    definicao:
      'A lista de variáveis que vão para o arquivo de dados da sessão. Só entra aqui o que realmente ' +
      'precisa ser analisado depois — o resto pode ficar de fora.',
  },
  {
    id: 'temporizador',
    termo: 'Temporizador (5", 30\')',
    definicao:
      'Um gatilho que dispara depois de um tempo parado no mesmo estado — em segundos (`"`) ou ' +
      'minutos (`\'`). Recomeça a contar toda vez que o processo entra de novo no estado (mas não ' +
      'quando "fica aqui" via `SX`).',
  },
  {
    id: 'reforco',
    termo: 'Reforço',
    definicao:
      'A consequência que aumenta a chance de um comportamento se repetir — na prática, geralmente ' +
      'ligar o dispensador por um instante. O que muda de esquema para esquema é a regra que decide ' +
      'quando entregar.',
  },
  {
    id: 'razao',
    termo: 'Razão (fixa/variável)',
    definicao:
      'Esquema em que o reforço depende do número de respostas — sempre o mesmo número (fixa) ou ' +
      'um número que varia em torno de uma média (variável).',
  },
  {
    id: 'intervalo',
    termo: 'Intervalo (fixo/variável)',
    definicao:
      'Esquema em que o reforço fica disponível depois de um tempo, e a primeira resposta depois ' +
      'disso o entrega. O tempo pode ser sempre o mesmo (fixo) ou variar em torno de uma média ' +
      '(variável).',
  },
  {
    id: 'var-alias',
    termo: 'VAR_ALIAS',
    definicao:
      'Onde uma variável de uma letra só (A, B, C…) ganha um nome amigável — «Respostas» em vez de ' +
      'A. Só existe para quem está lendo; o MedState continua vendo a letra.',
  },
  {
    id: 'dialeto',
    termo: 'Dialeto (MED-PC IV / V)',
    definicao:
      'As duas versões do MedState que este editor entende. Diferem em detalhes como o tamanho ' +
      'máximo de nome de constante e quais diretivas de preâmbulo são aceitas.',
  },
]

export function glossaryTerm(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.id === id)
}
