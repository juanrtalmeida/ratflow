import type { RuleNode } from '../../graph/model.ts'
import type { GraphProblem } from '../../graph/validate.ts'
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
  /**
   * O que falta neste nó para a regra poder ser escrita (campo vazio, nó solto).
   * Vem de `validateGraph`, em linguagem simples, e sai da tela sozinho quando o
   * problema é resolvido.
   */
  readonly problemas?: readonly GraphProblem[]
}

/**
 * `className` e `title` do card de um nó, marcando o que ainda está incompleto.
 * Um helper e não CSS puro porque a mensagem (`title`) e a borda vêm do mesmo
 * dado — os cinco cards usariam a mesma linha de qualquer jeito.
 */
export function propsDoNo(data: Level2NodeData): { className: string; title?: string } {
  const aviso = data.problemas?.length
    ? data.problemas.map((p) => p.plain).join('\n')
    : undefined
  return { className: aviso ? 'l2-node l2-node--incompleto' : 'l2-node', title: aviso }
}
