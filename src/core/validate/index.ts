import type { Program } from '../ast.ts'
import { eachCommand, variableNameOf, writtenOperandsOf } from '../walk.ts'
import { dialectOf, type DialectId } from './dialect.ts'
import { ALL_RULES } from './rules.ts'
import type { Diagnostic, ProgramIndex, ValidationContext } from './types.ts'

export { DIALECTS, DEFAULT_DIALECT, dialectOf } from './dialect.ts'
export type { DialectId, DialectProfile } from './dialect.ts'
export type { Diagnostic, ProgramIndex, Rule, ValidationContext } from './types.ts'
export * as rules from './rules.ts'

/** Índices derivados do preâmbulo e do corpo, calculados uma vez por validação. */
export function buildIndex(program: Program): ProgramIndex {
  const constants = new Map<string, { value: string; length: number }>()
  const dims = new Map<string, number | null>()
  const lists = new Set<string>()
  const aliases = new Map<string, string>()
  const aliasOf = new Map<string, string>()
  const diskVars: string[] = []

  for (const item of program.preamble) {
    switch (item.kind) {
      case 'ConstantDef':
        constants.set(item.name, { value: item.value, length: item.name.length })
        break
      case 'DimDecl': {
        const size = Number(item.size)
        dims.set(item.variable, Number.isFinite(size) ? size : null)
        break
      }
      case 'ListDecl':
        lists.add(item.variable)
        break
      case 'VarAliasBlock':
        for (const alias of item.aliases) {
          aliases.set(alias.alias, alias.variable)
          aliasOf.set(alias.variable, alias.alias)
        }
        break
      case 'DiskDirective':
        if (item.directive === 'DISKVARS') diskVars.push(...item.values)
        break
      case 'RawPreamble':
        break
    }
  }

  const written = new Set<string>()
  for (const { command } of eachCommand(program)) {
    for (const operand of writtenOperandsOf(command)) {
      const name = variableNameOf(operand)
      if (name) written.add(name)
    }
  }

  return { constants, dims, lists, aliases, aliasOf, diskVars, written }
}

export interface ValidateOptions {
  readonly dialect?: DialectId
}

/**
 * Roda todas as regras sobre um programa já analisado. Inclui os diagnósticos
 * do parser, para que o editor tenha uma lista única de problemas.
 *
 * Nunca lança: uma regra que falhe vira um diagnóstico interno, e as demais
 * continuam rodando — um bug de validação não pode derrubar o canvas.
 */
export function validate(
  program: Program,
  options: ValidateOptions = {},
): Diagnostic[] {
  const context: ValidationContext = {
    program,
    dialect: dialectOf(options.dialect),
    index: buildIndex(program),
  }

  const out: Diagnostic[] = [...program.diagnostics]
  for (const rule of ALL_RULES) {
    try {
      out.push(...rule(context))
    } catch (error) {
      out.push({
        span: program.span,
        severity: 'warning',
        code: 'regra-falhou',
        plain: 'Uma verificação interna não pôde ser concluída neste arquivo.',
        why: String(error),
      })
    }
  }

  return out.sort(
    (a, b) => a.span[0] - b.span[0] || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

/** Agrupa diagnósticos por intervalo, para pendurar badges nos nós do canvas. */
export function diagnosticsIn(
  diagnostics: readonly Diagnostic[],
  span: readonly [number, number],
): Diagnostic[] {
  return diagnostics.filter((d) => d.span[0] >= span[0] && d.span[1] <= span[1])
}

export function worstSeverity(
  diagnostics: readonly Diagnostic[],
): 'error' | 'warning' | 'info' | null {
  if (diagnostics.some((d) => d.severity === 'error')) return 'error'
  if (diagnostics.some((d) => d.severity === 'warning')) return 'warning'
  if (diagnostics.some((d) => d.severity === 'info')) return 'info'
  return null
}
