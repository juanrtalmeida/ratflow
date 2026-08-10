/**
 * Perfis de compatibilidade entre as versões do MED-PC.
 *
 * ⚠ Os limites numéricos abaixo são o melhor palpite documentado e precisam ser
 * conferidos contra o manual da sua instalação. Eles vivem nesta tabela
 * declarativa justamente para serem corrigidos num só lugar, sem tocar nas
 * regras de validação.
 */

export type DialectId = 'IV' | 'V'

export interface DialectProfile {
  readonly id: DialectId
  readonly label: string
  /** Quantidade máxima de processos (`S.S.n`) em um programa. */
  readonly maxStateSets: number
  /** Maior número de pulso `Z` disponível. */
  readonly maxSignals: number
  /** Comprimento máximo de nome de constante ou alias. */
  readonly maxIdentifierLength: number
  /** Diretivas de preâmbulo aceitas por esta versão. */
  readonly directives: ReadonlySet<string>
}

export const DIALECTS: Readonly<Record<DialectId, DialectProfile>> = {
  IV: {
    id: 'IV',
    label: 'MED-PC IV',
    maxStateSets: 32,
    maxSignals: 32,
    maxIdentifierLength: 16,
    directives: new Set(['DISKVARS']),
  },
  V: {
    id: 'V',
    label: 'MED-PC V',
    maxStateSets: 32,
    maxSignals: 32,
    maxIdentifierLength: 32,
    directives: new Set(['DISKVARS', 'DISKCOLUMNS', 'DISKFORMAT']),
  },
}

export const DEFAULT_DIALECT: DialectId = 'V'

export function dialectOf(id: DialectId = DEFAULT_DIALECT): DialectProfile {
  return DIALECTS[id]
}
