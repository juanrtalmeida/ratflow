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

// Largo o bastante para a seta (e, numa decisão, os rótulos "sim"/"não" que
// saem para a direita do card) não ficar espremida contra a coluna seguinte.
const COL_WIDTH = 340
// Alto o bastante para o nó de decisão (três campos empilhados) não colidir
// com a linha vizinha — é o card mais alto que qualquer regra produz hoje.
const ROW_HEIGHT = 220

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
