import type { ParseDiagnostic, Program } from '../ast.ts'
import type { DialectProfile } from './dialect.ts'

/**
 * Diagnóstico escrito para quem não programa: `plain` diz o que está errado,
 * `why` explica por que isso importa no experimento e `fix` sugere o conserto.
 * O mesmo objeto alimenta o badge do nó no canvas e o lint do editor de código.
 */
export interface Diagnostic extends ParseDiagnostic {
  readonly why?: string
  readonly fix?: string
}

export interface ProgramIndex {
  /** `^Nome` → definição. */
  readonly constants: ReadonlyMap<string, { value: string; length: number }>
  /** Variável com `DIM` → tamanho declarado (quando numérico). */
  readonly dims: ReadonlyMap<string, number | null>
  readonly lists: ReadonlySet<string>
  /** Alias amigável → letra da variável. */
  readonly aliases: ReadonlyMap<string, string>
  /** Letra da variável → alias amigável. */
  readonly aliasOf: ReadonlyMap<string, string>
  readonly diskVars: readonly string[]
  /** Variáveis escritas em algum ponto do programa (`SET`, `ADD`, `SUB`). */
  readonly written: ReadonlySet<string>
}

export interface ValidationContext {
  readonly program: Program
  readonly dialect: DialectProfile
  readonly index: ProgramIndex
}

export type Rule = (context: ValidationContext) => Diagnostic[]
