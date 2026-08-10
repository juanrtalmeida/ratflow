import type { Span } from './tokens.ts'

export type { Span }

/**
 * Toda construção da AST carrega duas camadas:
 *
 * - `raw`: o texto exato da origem — sempre presente, sempre fiel;
 * - `parsed`: a interpretação estruturada — presente só quando reconhecida.
 *
 * Construção não reconhecida não vira erro: fica com `parsed: null` e continua
 * sendo reescrita idêntica. É o que permite abrir `.MPC` de terceiros sem
 * estragá-los e alimentar o "nó avançado" do canvas.
 */
export interface RawNode {
  readonly span: Span
  readonly raw: string
}

// ---------------------------------------------------------------- Diagnósticos

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface ParseDiagnostic {
  readonly span: Span
  readonly severity: DiagnosticSeverity
  readonly code: string
  /** Mensagem em linguagem simples, para quem não programa. */
  readonly plain: string
}

// ------------------------------------------------------- Metadados do editor

/** Anotações que o editor guarda em comentários `\@chave: valor`. */
export interface MetaAnnotations {
  readonly nome?: string
  readonly papel?: string
  readonly pos?: { readonly x: number; readonly y: number }
  readonly macro?: string
}

// ------------------------------------------------------------------ Preâmbulo

export interface ConstantDef extends RawNode {
  readonly kind: 'ConstantDef'
  readonly name: string
  readonly nameSpan: Span
  readonly value: string
  readonly valueSpan: Span
}

export interface DimDecl extends RawNode {
  readonly kind: 'DimDecl'
  readonly variable: string
  readonly size: string
  readonly sizeSpan: Span
}

export interface ListDecl extends RawNode {
  readonly kind: 'ListDecl'
  readonly variable: string
  readonly values: readonly string[]
}

export interface VarAlias {
  readonly span: Span
  readonly alias: string
  readonly variable: string
}

export interface VarAliasBlock extends RawNode {
  readonly kind: 'VarAliasBlock'
  readonly aliases: readonly VarAlias[]
}

export interface DiskDirective extends RawNode {
  readonly kind: 'DiskDirective'
  /** `DISKVARS`, `DISKCOLUMNS` ou `DISKFORMAT`, em maiúsculas. */
  readonly directive: string
  readonly values: readonly string[]
  readonly valuesSpan: Span
}

export interface RawPreamble extends RawNode {
  readonly kind: 'RawPreamble'
}

export type PreambleItem =
  | ConstantDef
  | DimDecl
  | ListDecl
  | VarAliasBlock
  | DiskDirective
  | RawPreamble

// --------------------------------------------------------------- Operandos

/** Um valor citado em comando ou condição: variável, constante, número ou array. */
export interface Operand extends RawNode {
  readonly kind: 'Operand'
  /** `variable` = `A`, `constant` = `^Razao`, `number` = `5`, `element` = `A(I)`. */
  readonly type: 'variable' | 'constant' | 'number' | 'element' | 'unknown'
  readonly name: string
  /** Índice, para `type === 'element'`. */
  readonly index?: string
}

// ---------------------------------------------------------------- Gatilhos

export type TriggerDetail =
  | { readonly kind: 'start' }
  | {
      readonly kind: 'response'
      /** Canal do evento: `R`, `K`, … */
      readonly channel: string
      readonly port: Operand
    }
  | { readonly kind: 'signal'; readonly number: number }
  | {
      readonly kind: 'time'
      readonly amount: Operand
      readonly unit: 's' | 'min'
    }

export interface Trigger extends RawNode {
  readonly kind: 'Trigger'
  readonly parsed: TriggerDetail | null
}

// ---------------------------------------------------------------- Comandos

export type CommandDetail =
  | {
      readonly kind: 'port'
      readonly op: 'ON' | 'OFF' | 'LOCKON' | 'LOCKOFF'
      readonly ports: readonly Operand[]
    }
  | { readonly kind: 'counter'; readonly op: 'ADD' | 'SUB'; readonly target: Operand }
  | {
      readonly kind: 'set'
      readonly assignments: readonly {
        readonly target: Operand
        readonly value: string
        readonly valueSpan: Span
      }[]
    }
  | {
      readonly kind: 'show'
      readonly items: readonly {
        readonly slot: string
        readonly label: string
        readonly value: Operand
      }[]
    }
  | { readonly kind: 'signal'; readonly number: number }
  | {
      readonly kind: 'if'
      readonly condition: Condition
      readonly thenLabel: string
      readonly elseLabel: string | null
    }

/** Condição de um `IF`, decomposta quando tem a forma `operando op operando`. */
export interface Condition extends RawNode {
  readonly kind: 'Condition'
  readonly left: Operand | null
  readonly operator: string | null
  readonly right: Operand | null
}

export interface Command extends RawNode {
  readonly kind: 'Command'
  readonly parsed: CommandDetail | null
}

// -------------------------------------------------------------- Transições

export interface Target extends RawNode {
  readonly kind: 'Target'
  /** Número do estado de destino, ou `'SX'` para "fica onde está". */
  readonly state: number | 'SX' | null
}

/**
 * Um trecho de statement: a sequência de comandos que roda até um `--->`.
 * O primeiro segmento vem logo após o gatilho; os seguintes são rotulados
 * (`@Reforco:`) e servem de destino aos ramos de um `IF`.
 */
export interface Segment {
  readonly kind: 'Segment'
  readonly span: Span
  readonly label: string | null
  readonly labelSpan: Span | null
  readonly commands: readonly Command[]
  readonly target: Target | null
}

/** Uma linha de transição completa — o que o canvas de nível 2 chama de "regra". */
export interface Statement {
  readonly kind: 'Statement'
  readonly span: Span
  readonly raw: string
  readonly trigger: Trigger
  readonly segments: readonly Segment[]
}

// ------------------------------------------------------- Estados e processos

export interface State {
  readonly kind: 'State'
  readonly span: Span
  /** `n` em `Sn`. */
  readonly index: number
  readonly headerSpan: Span
  readonly statements: readonly Statement[]
  readonly meta: MetaAnnotations
}

export interface StateSet {
  readonly kind: 'StateSet'
  readonly span: Span
  /** `n` em `S.S.n`. */
  readonly index: number
  readonly headerSpan: Span
  readonly states: readonly State[]
  readonly meta: MetaAnnotations
}

export interface CommentNode {
  readonly kind: 'Comment'
  readonly span: Span
  readonly raw: string
  readonly meta: MetaAnnotations
}

export interface Program {
  readonly kind: 'Program'
  readonly span: Span
  /** A fonte completa. A AST guarda spans dentro dela, nunca cópias do arquivo. */
  readonly text: string
  readonly preamble: readonly PreambleItem[]
  readonly stateSets: readonly StateSet[]
  readonly comments: readonly CommentNode[]
  readonly diagnostics: readonly ParseDiagnostic[]
}

// --------------------------------------------------------------- Utilidades

export function findStateSet(program: Program, index: number): StateSet | undefined {
  return program.stateSets.find((s) => s.index === index)
}

export function findState(stateSet: StateSet, index: number): State | undefined {
  return stateSet.states.find((s) => s.index === index)
}

/** Nome amigável de um estado, com queda para `S<n>` quando não anotado. */
export function stateLabel(state: State): string {
  return state.meta.nome ?? `S${state.index}`
}

export function stateSetLabel(stateSet: StateSet): string {
  return stateSet.meta.nome ?? `Processo ${stateSet.index}`
}

/** O estado deste processo cujo span contém `offset` — para o espelhamento código → canvas. */
export function findStateAtOffset(stateSet: StateSet, offset: number): State | undefined {
  return stateSet.states.find((s) => offset >= s.span[0] && offset < s.span[1])
}

/** Índice da regra (statement) deste estado cujo span contém `offset`. */
export function findStatementIndexAtOffset(state: State, offset: number): number | null {
  const i = state.statements.findIndex((s) => offset >= s.span[0] && offset < s.span[1])
  return i === -1 ? null : i
}
