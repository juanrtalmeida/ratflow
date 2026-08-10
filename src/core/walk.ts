import type {
  Command,
  Operand,
  Program,
  Segment,
  State,
  StateSet,
  Statement,
  Trigger,
} from './ast.ts'

/**
 * Percursos sobre a AST, compartilhados por validação, vocabulário, simulador e
 * compilador de grafo. Manter num só lugar evita que cada camada reinvente o
 * caminho até os operandos — e que uma delas esqueça um caso.
 */

export interface StatementRef {
  readonly stateSet: StateSet
  readonly state: State
  readonly statement: Statement
}

export interface CommandRef extends StatementRef {
  readonly segment: Segment
  readonly command: Command
}

export function* eachStatement(program: Program): Generator<StatementRef> {
  for (const stateSet of program.stateSets) {
    for (const state of stateSet.states) {
      for (const statement of state.statements) {
        yield { stateSet, state, statement }
      }
    }
  }
}

export function* eachCommand(program: Program): Generator<CommandRef> {
  for (const ref of eachStatement(program)) {
    for (const segment of ref.statement.segments) {
      for (const command of segment.commands) {
        yield { ...ref, segment, command }
      }
    }
  }
}

/** Todos os operandos citados por um comando, incluindo os de uma condição. */
export function operandsOf(command: Command): Operand[] {
  const detail = command.parsed
  if (!detail) return []

  switch (detail.kind) {
    case 'port':
      return [...detail.ports]
    case 'counter':
      return [detail.target]
    case 'set':
      return detail.assignments.map((a) => a.target)
    case 'show':
      return detail.items.map((i) => i.value)
    case 'if':
      return [detail.condition.left, detail.condition.right].filter(
        (o) => o !== null,
      )
    case 'signal':
      return []
  }
}

export function operandsOfTrigger(trigger: Trigger): Operand[] {
  const detail = trigger.parsed
  if (!detail) return []
  if (detail.kind === 'response') return [detail.port]
  if (detail.kind === 'time') return [detail.amount]
  return []
}

/** Operandos que o comando **escreve** (e não apenas lê). */
export function writtenOperandsOf(command: Command): Operand[] {
  const detail = command.parsed
  if (!detail) return []
  if (detail.kind === 'counter') return [detail.target]
  if (detail.kind === 'set') return detail.assignments.map((a) => a.target)
  return []
}

/** Portas que o comando liga ou desliga. */
export function portOperandsOf(command: Command): Operand[] {
  const detail = command.parsed
  return detail?.kind === 'port' ? [...detail.ports] : []
}

/** Nome da variável por trás de um operando, seja `A` ou `A(I)`. */
export function variableNameOf(operand: Operand): string | null {
  if (operand.type === 'variable' || operand.type === 'element') {
    return operand.name
  }
  return null
}
