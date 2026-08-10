import dagre from '@dagrejs/dagre'
import type { Program, Segment, State, StateSet, Statement, Target } from '../../core/ast.ts'
import { stateLabel } from '../../core/ast.ts'
import type { Diagnostic } from '../../core/validate/types.ts'
import { diagnosticsIn, worstSeverity } from '../../core/validate/index.ts'
import { createNarrator } from '../../vocab/narrate.ts'
import { EMPTY_PROFILE, type HardwareProfile } from '../../vocab/profile.ts'

/**
 * Monta os dados do canvas de nível 1 a partir de um processo (`S.S.n`): nó =
 * estado, aresta = transição. TS puro — sem React — para poder testar o
 * mapeamento AST → grafo sem montar um componente.
 */

export type TransitionKind = 'start' | 'response' | 'time' | 'signal' | 'raw'

/**
 * Ícone de cada `\@papel:` de estado. Mora aqui, e não no `StateNode`, porque
 * a paleta oferece os mesmos papéis e este é o módulo de dados do nível 1 —
 * um componente exportando tabela quebra o hot reload do Vite.
 */
export const PAPEL_ICON: Record<string, string> = {
  espera: '⏳',
  reforco: '🍬',
  timeout: '⏱',
  fim: '🏁',
}

// `extends Record<string, unknown>` é o que satisfaz a restrição de tipo de
// dado de nó/aresta do React Flow — ver ProtocolCanvas.tsx.
export interface ProtocolNodeData extends Record<string, unknown> {
  readonly stateIndex: number
  readonly label: string
  /** `espera` / `reforco` / `timeout` / `fim`, do `\@papel:`. `null` = neutro. */
  readonly papel: string | null
  readonly resumo: string
  readonly severity: 'error' | 'warning' | 'info' | null
  readonly diagnosticCount: number
}

export interface ProtocolNode {
  readonly id: string
  readonly position: { x: number; y: number }
  readonly data: ProtocolNodeData
}

export interface ProtocolEdgeData extends Record<string, unknown> {
  readonly label: string
  readonly kind: TransitionKind
  readonly selfLoop: boolean
  /** A linha reta passaria por cima de outro nó — precisa arquear por fora. */
  readonly arc: boolean
  /** O nó `Target` original — é o que uma religação de aresta reescreve. */
  readonly astTarget: Target
  /** Estado de onde a transição sai (o `Sn` do bloco, não o destino). */
  readonly stateIndex: number
  /** Índice da regra dentro do estado — endereça o `Statement` para apagá-la. */
  readonly statementIndex: number
  /**
   * Quantos segmentos a regra tem. Maior que 1 significa que esta seta é um
   * ramo de um `IF`: apagá-la sozinha deixaria o `IF` apontando para um rótulo
   * inexistente, então quem apaga precisa saber a diferença.
   */
  readonly segmentCount: number
}

export interface ProtocolEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly data: ProtocolEdgeData
}

export interface ProtocolGraph {
  readonly nodes: ProtocolNode[]
  readonly edges: ProtocolEdge[]
  /** Verdadeiro quando algum estado não tinha `\@pos:` e o dagre completou o layout. */
  readonly autoLayout: boolean
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 96

function triggerKind(statement: Statement): TransitionKind {
  return statement.trigger.parsed?.kind ?? 'raw'
}

/**
 * Rótulo de uma aresta: a frase curta do gatilho. Quando o mesmo gatilho leva
 * a dois destinos por causa de um `IF`, uma marca sim/não distingue os dois —
 * a condição em si só aparece no nível 2, para o rótulo do nível 1 caber
 * entre os nós.
 */
function edgeLabel(
  statement: Statement,
  segment: Segment,
  narrator: ReturnType<typeof createNarrator>,
): string {
  const base = narrator.triggerShort(statement.trigger)
  if (segment.label === null) return base

  const decisao = statement.segments[0]?.commands.find(
    (c) => c.parsed?.kind === 'if',
  )
  if (!decisao || decisao.parsed?.kind !== 'if') return base

  const { thenLabel, elseLabel } = decisao.parsed
  if (segment.label === thenLabel) return `${base} · sim`
  if (segment.label === elseLabel) return `${base} · não`
  return base
}

function buildEdges(
  state: State,
  narrator: ReturnType<typeof createNarrator>,
): ProtocolEdge[] {
  const edges: ProtocolEdge[] = []

  state.statements.forEach((statement, statementIndex) => {
    statement.segments.forEach((segment, segmentIndex) => {
      const target = segment.target
      if (!target || target.state === null) return

      const toId = target.state === 'SX' ? String(state.index) : String(target.state)
      edges.push({
        id: `${state.index}:${statementIndex}:${segmentIndex}`,
        source: String(state.index),
        target: toId,
        data: {
          label: edgeLabel(statement, segment, narrator),
          kind: triggerKind(statement),
          selfLoop: target.state === 'SX',
          arc: false,
          astTarget: target,
          stateIndex: state.index,
          statementIndex,
          segmentCount: statement.segments.length,
        },
      })
    })
  })

  return edges
}

function layoutWithDagre(
  nodes: readonly { id: string }[],
  edges: readonly { source: string; target: string; data: { selfLoop: boolean } }[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 96 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const edge of edges) {
    if (!edge.data.selfLoop) g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const pos = g.node(node.id)
    positions.set(node.id, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 })
  }
  return positions
}

export function buildProtocolGraph(
  stateSet: StateSet,
  program: Program,
  profile: HardwareProfile = EMPTY_PROFILE,
  diagnostics: readonly Diagnostic[] = [],
): ProtocolGraph {
  const narrator = createNarrator(program, profile)

  const dataById = new Map<string, ProtocolNodeData>()
  for (const state of stateSet.states) {
    const stateDiagnostics = diagnosticsIn(diagnostics, state.span)
    dataById.set(String(state.index), {
      stateIndex: state.index,
      label: stateLabel(state),
      papel: state.meta.papel ?? null,
      resumo: narrator.state(state),
      severity: worstSeverity(stateDiagnostics),
      diagnosticCount: stateDiagnostics.length,
    })
  }

  const edges = stateSet.states.flatMap((state) => buildEdges(state, narrator))

  // O dagre roda sempre (é barato e determinístico), mas só empresta posição
  // para quem não tem `\@pos:` — usar tudo ou nada aqui reescrevia a posição
  // de um estado recém-arrastado só porque outro estado do mesmo processo
  // (ex.: criado por "novo processo", sem `\@pos:` ainda) não tinha posição
  // própria, fazendo o arrasto "voltar sozinho" no próximo render.
  const autoLayout = stateSet.states.some((state) => !state.meta.pos)
  const dagrePositions = layoutWithDagre(
    stateSet.states.map((s) => ({ id: String(s.index) })),
    edges,
  )

  const nodes: ProtocolNode[] = stateSet.states.map((state) => {
    const id = String(state.index)
    return {
      id,
      position: state.meta.pos ?? dagrePositions.get(id) ?? { x: 0, y: 0 },
      data: dataById.get(id)!,
    }
  })

  return { nodes, edges: markArcedEdges(nodes, edges), autoLayout }
}

/**
 * Uma transição "salta" outro estado (ex.: `S2 ---> S4` pulando `S3`) quando a
 * reta entre origem e destino passaria por cima do card de um terceiro nó. A
 * aresta reta ficaria escondida atrás dele — marcá-la para arquear por cima
 * é o que mantém ela visível.
 */
function markArcedEdges(
  nodes: readonly ProtocolNode[],
  edges: readonly ProtocolEdge[],
): ProtocolEdge[] {
  const positionById = new Map(nodes.map((n) => [n.id, n.position]))

  return edges.map((edge) => {
    if (edge.data.selfLoop) return edge
    const from = positionById.get(edge.source)
    const to = positionById.get(edge.target)
    if (!from || !to || to.x <= from.x) return edge // laços e voltas já arqueiam

    const passesOverAnotherNode = nodes.some((node) => {
      if (node.id === edge.source || node.id === edge.target) return false
      const sameRow = Math.abs(node.position.y - from.y) < NODE_HEIGHT
      const between = node.position.x > from.x && node.position.x < to.x
      return sameRow && between
    })

    return passesOverAnotherNode ? { ...edge, data: { ...edge.data, arc: true } } : edge
  })
}
