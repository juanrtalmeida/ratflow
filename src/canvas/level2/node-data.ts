import type { RuleNode } from '../../graph/model.ts'
import type { EditableContext } from './editable-context.ts'

/**
 * Dado que cada nó do React Flow carrega. `onEdit` sobe até o `LogicCanvas`,
 * que recompila só aquela regra e grava a edição no texto — o mesmo caminho
 * de "arrastar persiste" da Parte 5, agora para campos em vez de posição.
 */
export interface Level2NodeData extends Record<string, unknown> {
  readonly node: RuleNode
  readonly context: EditableContext
  readonly onEdit: (nodeId: string, patch: Record<string, unknown>) => void
}
