import type { Operand, Program } from '../core/ast.ts'
import { buildIndex } from '../core/validate/index.ts'
import {
  eachCommand,
  eachStatement,
  operandsOf,
  operandsOfTrigger,
  writtenOperandsOf,
} from '../core/walk.ts'

/**
 * Contadores do programa, inferidos do próprio arquivo — o análogo de
 * `suggestDevices` para variáveis.
 *
 * O MedState só tem 26 variáveis de uma letra, então programas reais usam
 * arrays (`DIM B = 19`) e documentam o significado de cada posição num
 * comentário, uma linha por posição:
 *
 * ```
 * \ B(5) = LEFTLEVER RESPONSES
 * \ B(9) = REINFORCERS LEFT
 * ```
 *
 * Esse comentário é a única fonte de nome que esses arquivos têm: `VAR_ALIAS`
 * não aceita elemento de array, só a letra inteira. Ler o comentário é o que
 * faz a interface conseguir dizer "reforços à esquerda" em vez de `B(9)` — e é
 * de leitura apenas, porque o texto pertence ao autor do arquivo.
 */

export interface CounterInfo {
  /** Operando MedState — a identidade, e o que vai escrito no arquivo: `B`, `B(5)`. */
  readonly operando: string
  readonly variable: string
  /** Posição, quando é um elemento de array com índice literal. */
  readonly index: number | null
  /** Nome amigável: apelido do `VAR_ALIAS`, ou o comentário de documentação. */
  readonly nome: string | null
  /** O programa soma, subtrai ou define este contador em algum ponto. */
  readonly escrito: boolean
  /** Aparece em algum comando ou gatilho (lido ou escrito). */
  readonly usado: boolean
}

/** `\ B(5) = LEFTLEVER RESPONSES` — nome de uma posição de array. */
const DOC_ELEMENTO = /^\\\s*([A-Z])\s*\(\s*(\d+)\s*\)\s*=\s*(\S.*?)\s*$/

function operando(variable: string, index: number | null): string {
  return index === null ? variable : `${variable}(${index})`
}

/** Índice só conta como posição quando é um número literal (`B(5)`, não `B(I)`). */
function indiceLiteral(op: Operand): number | null {
  if (op.type !== 'element' || op.index === undefined) return null
  const n = Number(op.index)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function suggestCounters(program: Program): CounterInfo[] {
  const index = buildIndex(program)
  const nomes = new Map<string, string>()

  // Nomes documentados em comentário. A última definição vence, como em
  // qualquer arquivo que se corrige mais abaixo.
  for (const comment of program.comments) {
    const m = DOC_ELEMENTO.exec(comment.raw)
    if (m) nomes.set(operando(m[1]!, Number(m[2]!)), m[3]!)
  }
  // `VAR_ALIAS` nomeia a variável inteira, sem posição.
  for (const [variable, alias] of index.aliasOf) nomes.set(variable, alias)

  const usados = new Set<string>()
  const escritos = new Set<string>()

  const registrar = (op: Operand, destino: Set<string>) => {
    if (op.type !== 'variable' && op.type !== 'element') return
    // Índice não literal (`D(B(17))`, `A(I)`) não endereça uma posição
    // conhecida: o que se sabe é que a variável é usada.
    destino.add(operando(op.name, indiceLiteral(op)))
  }

  for (const { statement } of eachStatement(program)) {
    for (const op of operandsOfTrigger(statement.trigger)) registrar(op, usados)
  }
  for (const { command } of eachCommand(program)) {
    for (const op of operandsOf(command)) registrar(op, usados)
    for (const op of writtenOperandsOf(command)) {
      registrar(op, usados)
      registrar(op, escritos)
    }
  }

  const todos = new Set([...nomes.keys(), ...usados])
  return [...todos]
    .map((chave) => {
      const m = /^([A-Z])(?:\((\d+)\))?$/.exec(chave)
      return {
        operando: chave,
        variable: m?.[1] ?? chave,
        index: m?.[2] === undefined ? null : Number(m[2]),
        nome: nomes.get(chave) ?? null,
        escrito: escritos.has(chave),
        usado: usados.has(chave),
      }
    })
    .sort(
      (a, b) =>
        a.variable.localeCompare(b.variable) || (a.index ?? -1) - (b.index ?? -1),
    )
}

/** Rótulo de um contador para listas e frases: o nome quando existe, senão o operando. */
export function counterLabel(counter: CounterInfo): string {
  return counter.nome ?? counter.operando
}
