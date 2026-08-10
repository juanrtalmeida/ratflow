import { nodeAt, type NodeId, type RuleGraph } from '../../graph/model.ts'

/**
 * Posiciona os nós de uma regra em árvore: coluna = distância do gatilho (a
 * regra só anda para frente, nunca junta), linha = ramo. Uma decisão fica na
 * média da linha dos seus dois ramos, então o "sim" e o "não" se abrem para
 * cima e para baixo dela — o formato de fluxograma que a Parte 6 do plano
 * pede. TS puro, sem depender do React Flow, para poder testar sem montar
 * componente.
 */

export interface RuleLayout {
  readonly positions: ReadonlyMap<NodeId, { x: number; y: number }>
  readonly width: number
  readonly height: number
}

/**
 * Largura de uma coluna. Um card do nível 2 tem ~220px, então o que sobra é o
 * espaço onde a seta aparece — e é ele que faz o fluxo ser legível numa regra
 * comprida (uma corrente de seis `SET` seguidos é rotina em arquivo real).
 */
export const COL_WIDTH = 400
/**
 * Altura de uma linha. Precisa caber o card mais alto que uma regra produz — o
 * nó de decisão e o de "registrar no painel" têm três campos empilhados — mais
 * a folga para a seta do ramo vizinho não passar rente ao card.
 */
export const ROW_HEIGHT = 300

export function layoutRuleGraph(graph: RuleGraph): RuleLayout {
  const col = new Map<NodeId, number>()
  const row = new Map<NodeId, number>()
  let nextRow = 0

  const assignCol = (id: NodeId | null, depth: number): void => {
    if (id === null || col.has(id)) return
    col.set(id, depth)
    const node = nodeAt(graph, id)
    if (!node) return
    if (node.kind === 'decision') {
      assignCol(node.whenTrue, depth + 1)
      assignCol(node.whenFalse, depth + 1)
    } else if (node.kind !== 'target') {
      assignCol(node.next, depth + 1)
    }
  }
  assignCol(graph.root, 0)

  // Um ramo incompleto (decisão sem os dois lados ligados ainda) não tem nó,
  // mas precisa reservar uma linha — senão o ramo que existe fica esmagado
  // contra o outro.
  const assignRow = (id: NodeId | null): number => {
    if (id === null) return nextRow++
    const cached = row.get(id)
    if (cached !== undefined) return cached

    const node = nodeAt(graph, id)
    if (!node) return nextRow++

    let r: number
    if (node.kind === 'decision') {
      const rTrue = assignRow(node.whenTrue)
      const rFalse = assignRow(node.whenFalse)
      r = (rTrue + rFalse) / 2
    } else if (node.kind === 'target') {
      r = nextRow++
    } else {
      r = assignRow(node.next)
    }
    row.set(id, r)
    return r
  }
  assignRow(graph.root)

  const positions = new Map<NodeId, { x: number; y: number }>()
  let maxCol = 0
  let maxRow = 0
  for (const id of Object.keys(graph.nodes)) {
    const c = col.get(id) ?? 0
    const r = row.get(id) ?? 0
    positions.set(id, { x: c * COL_WIDTH, y: r * ROW_HEIGHT })
    maxCol = Math.max(maxCol, c)
    maxRow = Math.max(maxRow, r)
  }

  return {
    positions,
    width: (maxCol + 1) * COL_WIDTH,
    height: (maxRow + 1) * ROW_HEIGHT,
  }
}
