import type {
  Command,
  CommandDetail,
  Condition,
  Operand,
  Segment,
  Statement,
  Target,
  Trigger,
  TriggerDetail,
} from './ast.ts'

/**
 * Serializa **nós individuais** da AST. Não existe função que reimprima o
 * arquivo: reescrever tudo destruiria comentários e formatação. O que se
 * imprime aqui é sempre colado no texto original por uma edição cirúrgica.
 */

export function printOperand(operand: Operand): string {
  switch (operand.type) {
    case 'constant':
      return `^${operand.name}`
    case 'element':
      return `${operand.name}(${operand.index ?? ''})`
    case 'variable':
    case 'number':
      return operand.name
    default:
      return operand.raw
  }
}

export function printTriggerDetail(detail: TriggerDetail): string {
  switch (detail.kind) {
    case 'start':
      return '#START'
    case 'response':
      return `#${detail.channel}${printOperand(detail.port)}`
    case 'signal':
      return `#Z${detail.number}`
    case 'time':
      return `${printOperand(detail.amount)}${detail.unit === 's' ? '"' : "'"}`
  }
}

export function printTrigger(trigger: Trigger): string {
  return trigger.parsed ? printTriggerDetail(trigger.parsed) : trigger.raw
}

export function printCondition(condition: Condition): string {
  if (condition.left && condition.operator && condition.right) {
    return `${printOperand(condition.left)} ${condition.operator} ${printOperand(condition.right)}`
  }
  return condition.raw
}

export function printCommandDetail(detail: CommandDetail): string {
  switch (detail.kind) {
    case 'port':
      return `${detail.op} ${detail.ports.map(printOperand).join(', ')}`
    case 'counter':
      return `${detail.op} ${printOperand(detail.target)}`
    case 'set':
      return `SET ${detail.assignments
        .map((a) => `${printOperand(a.target)} = ${a.value}`)
        .join(', ')}`
    case 'show':
      return `SHOW ${detail.items
        .map((i) => `${i.slot}, ${i.label}, ${printOperand(i.value)}`)
        .join(', ')}`
    case 'signal':
      return `Z${detail.number}`
    case 'if': {
      const labels = detail.elseLabel
        ? `@${detail.thenLabel}, @${detail.elseLabel}`
        : `@${detail.thenLabel}`
      return `IF ${printCondition(detail.condition)} [${labels}]`
    }
  }
}

export function printCommand(command: Command): string {
  return command.parsed ? printCommandDetail(command.parsed) : command.raw
}

export function printTarget(target: Target): string {
  if (target.state === 'SX') return 'SX'
  if (typeof target.state === 'number') return `S${target.state}`
  return target.raw
}

export function printSegmentBody(segment: Segment): string {
  const parts: string[] = []
  const commands = segment.commands.map(printCommand).join('; ')
  if (commands.length > 0) parts.push(commands)
  if (segment.target) parts.push(`---> ${printTarget(segment.target)}`)
  return parts.join(' ')
}

/**
 * Estilo de quebra de linha predominante no arquivo. `compileRule` e
 * `printStatement` recebem isso como `newline` para não misturar CRLF (comum
 * em arquivos exportados do Windows, como os do MED-PC) com LF dentro do
 * mesmo `.MPC` quando só um trecho é reescrito.
 */
export function detectNewline(text: string): '\n' | '\r\n' {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export interface PrintStatementOptions {
  /** Recuo da linha do gatilho. */
  readonly indent?: string
  /** Recuo dos segmentos rotulados que continuam o statement. */
  readonly labelIndent?: string
  readonly newline?: string
}

export function printStatement(
  statement: Statement,
  options: PrintStatementOptions = {},
): string {
  const indent = options.indent ?? '  '
  const labelIndent = options.labelIndent ?? indent + '     '
  const newline = options.newline ?? '\n'

  const lines: string[] = []
  for (const segment of statement.segments) {
    const body = printSegmentBody(segment)
    if (segment.label === null) {
      const head = `${indent}${printTrigger(statement.trigger)}:`
      lines.push(body.length > 0 ? `${head} ${body}` : head)
    } else {
      lines.push(`${labelIndent}@${segment.label}: ${body}`)
    }
  }
  return lines.join(newline)
}

/** Cabeçalho de processo (`S.S.n,`), com o nome amigável no mesmo comentário. */
export function printStateSetHeader(index: number, meta: { nome?: string } = {}): string {
  const parts: string[] = [`S.S.${index},`]
  if (meta.nome) parts.push(`\\@nome: ${meta.nome}`)
  return parts.join(' ')
}

/** Cabeçalho de estado, com as anotações do editor no mesmo comentário. */
export function printStateHeader(
  index: number,
  meta: {
    nome?: string
    papel?: string
    pos?: { x: number; y: number }
    macro?: string
  } = {},
): string {
  const parts: string[] = [`S${index},`]
  if (meta.nome) parts.push(`\\@nome: ${meta.nome}`)
  if (meta.papel) parts.push(`\\@papel: ${meta.papel}`)
  if (meta.pos) parts.push(`\\@pos: ${Math.round(meta.pos.x)},${Math.round(meta.pos.y)}`)
  if (meta.macro) parts.push(`\\@macro: ${meta.macro}`)
  return parts.join(' ')
}
