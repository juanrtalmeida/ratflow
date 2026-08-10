export interface CommandHelp {
  readonly titulo: string
  readonly texto: string
}

/**
 * Explicação curta de cada palavra-chave e símbolo do MedState, para o
 * popover ao passar o mouse no editor de código. Deliberadamente separado do
 * glossário (`ui/glossary-terms.ts`): aquele explica conceitos de laboratório
 * ("o que é reforço"), este explica sintaxe ("o que o `ADD` faz").
 */
export const COMANDOS: Record<string, CommandHelp> = {
  ON: { titulo: 'ON', texto: 'Liga uma porta de saída (luz, dispensador, som…) e mantém ligada até um OFF.' },
  OFF: { titulo: 'OFF', texto: 'Desliga uma porta de saída ligada antes por um ON.' },
  LOCKON: {
    titulo: 'LOCKON',
    texto: 'Liga uma porta e trava: um OFF comum não apaga — só um LOCKOFF na mesma porta.',
  },
  LOCKOFF: { titulo: 'LOCKOFF', texto: 'Destrava e desliga uma porta que foi ligada com LOCKON.' },
  ADD: { titulo: 'ADD', texto: 'Soma um valor a uma variável — o jeito mais comum de contar respostas.' },
  SUB: { titulo: 'SUB', texto: 'Subtrai um valor de uma variável.' },
  SET: {
    titulo: 'SET',
    texto: 'Define o valor de uma variável diretamente, sem depender do valor que ela tinha antes.',
  },
  SHOW: {
    titulo: 'SHOW',
    texto: 'Mostra um rótulo e um valor no painel do MED-PC durante a sessão — não muda nada no programa.',
  },
  IF: {
    titulo: 'IF',
    texto:
      'Testa uma condição. Do par de rótulos entre colchetes, o primeiro é seguido quando ela é ' +
      'verdadeira, o segundo quando é falsa.',
  },
  END: { titulo: 'END', texto: 'Fecha um bloco de declaração (como VAR_ALIAS) aberto antes no preâmbulo.' },
  DIM: {
    titulo: 'DIM',
    texto: 'Reserva o tamanho de um array antes de indexá-lo — DIM A = 1000 permite A(0) até A(999).',
  },
  LIST: {
    titulo: 'LIST',
    texto: 'Declara uma lista fixa de valores, usada por RANDD/RANDI para sortear entre eles.',
  },
  VAR_ALIAS: {
    titulo: 'VAR_ALIAS',
    texto:
      'Dá um nome amigável a uma variável de uma letra só — só para quem lê o arquivo; o MedState ' +
      'continua vendo a letra.',
  },
  DISKVARS: {
    titulo: 'DISKVARS',
    texto: 'Lista as variáveis que vão para o arquivo de dados da sessão.',
  },
  DISKCOLUMNS: {
    titulo: 'DISKCOLUMNS',
    texto: 'Define quantas colunas o arquivo de dados usa (diretiva só do dialeto MED-PC V).',
  },
  DISKFORMAT: {
    titulo: 'DISKFORMAT',
    texto: 'Define o formato numérico do arquivo de dados (diretiva só do dialeto MED-PC V).',
  },
  RANDD: { titulo: 'RANDD', texto: 'Sorteia um valor de uma LIST sem repetir nenhum até esgotar todos.' },
  RANDI: { titulo: 'RANDI', texto: 'Sorteia um valor de uma LIST, podendo repetir a qualquer sorteio.' },
  SX: {
    titulo: 'SX — "fica aqui"',
    texto:
      'Destino especial que significa "não muda de estado". Diferente de apontar de volta pro mesmo ' +
      'estado por número, não reinicia nenhum temporizador em andamento.',
  },
}

const SIMBOLOS: Record<string, CommandHelp> = {
  caret: { titulo: '^', texto: 'Referência a uma constante nomeada no preâmbulo do arquivo (ex.: ^Alavanca).' },
  at: {
    titulo: '@',
    texto: 'Rótulo — marca um ramo de IF (ex.: @Reforco) para onde uma transição pode apontar.',
  },
  arrow: { titulo: '--->', texto: 'Transição: manda o processo para o estado indicado a seguir.' },
  quote: { titulo: '"', texto: 'Temporizador em segundos — dispara depois de parado esse tempo no estado.' },
  apostrophe: { titulo: "'", texto: 'Temporizador em minutos.' },
}

/** `numero` vem vazio em `#R^Alavanca` — a porta é a constante ao lado, não um número literal. */
function ajudaGatilho(letra: string, numero: string): CommandHelp | null {
  const porta = numero || 'indicada pela constante ao lado (^…)'
  const digito = numero || ''
  if (letra === 'R') {
    return {
      titulo: `#R${digito}`,
      texto: `Gatilho: dispara quando o dispositivo de entrada na porta ${porta} responde (ex.: a alavanca ligada nessa porta).`,
    }
  }
  if (letra === 'K') {
    return {
      titulo: `#K${digito}`,
      texto: `Gatilho: dispara ao apertar a tecla ${porta} do teclado do MED-PC — usado em testes manuais.`,
    }
  }
  if (letra === 'Z') {
    return {
      titulo: `#Z${digito}`,
      texto: `Gatilho: dispara quando outro processo emite o sinal Z ${numero ? `número ${numero}` : 'indicado pela constante ao lado'} (ver \\@nome dos processos que avisam).`,
    }
  }
  return null
}

/** Ajuda para uma palavra-chave ou `#START`/`#R1`/`#K1`/`#Z1`/`#R^Nome` (ident logo após um `#`). */
export function ajudaPalavra(texto: string, apósHash: boolean): CommandHelp | null {
  const maiuscula = texto.toUpperCase()
  if (apósHash && maiuscula === 'START') {
    return { titulo: '#START', texto: 'Gatilho que dispara uma vez, assim que o processo entra neste estado.' }
  }
  if (apósHash) {
    const m = /^([RKZ])(\d*)$/.exec(maiuscula)
    if (m) return ajudaGatilho(m[1]!, m[2]!)
  }
  return COMANDOS[maiuscula] ?? null
}

export function ajudaSimbolo(kind: string): CommandHelp | null {
  return SIMBOLOS[kind] ?? null
}
