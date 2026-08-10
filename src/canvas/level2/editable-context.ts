import type { StateSet } from '../../core/ast.ts'
import type { ProgramIndex } from '../../core/validate/types.ts'
import type { CounterInfo } from '../../vocab/counters.ts'
import type { HardwareProfile } from '../../vocab/profile.ts'

/**
 * O que os campos editáveis do nível 2 precisam para preencher listas
 * suspensas em vez de texto livre: dispositivos do perfil, apelidos de
 * contador do `VAR_ALIAS`, e os estados de destino possíveis no processo
 * atual. Montado uma vez por `LogicCanvas` e repassado a cada nó.
 */
export interface EditableContext {
  readonly profile: HardwareProfile
  readonly index: ProgramIndex
  readonly stateSet: StateSet
  /**
   * Contadores inferidos do arquivo — inclui as posições de array nomeadas em
   * comentário (`\ B(5) = LEFTLEVER RESPONSES`), que é como os programas reais
   * documentam os seus, já que `VAR_ALIAS` não aceita elemento de array.
   */
  readonly counters: readonly CounterInfo[]
}
