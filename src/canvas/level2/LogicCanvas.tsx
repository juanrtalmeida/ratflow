import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'
import type { Program, State, StateSet } from '../../core/ast.ts'
import type { TextEdit } from '../../core/edit.ts'
import { setRule } from '../../core/mutations.ts'
import { buildIndex } from '../../core/validate/index.ts'
import { CompileError } from '../../graph/compile.ts'
import { decompileStatement } from '../../graph/decompile.ts'
import { walkGraph, type RuleGraph, type RuleNode } from '../../graph/model.ts'
import { createNarrator } from '../../vocab/narrate.ts'
import { EMPTY_PROFILE, type HardwareProfile } from '../../vocab/profile.ts'
import { ActionNode, type ActionNodeType } from './ActionNode.tsx'
import {
  DECISION_HANDLE_FALSE,
  DECISION_HANDLE_TRUE,
  DecisionNode,
  type DecisionNodeType,
} from './DecisionNode.tsx'
import type { EditableContext } from './editable-context.ts'
import type { Level2NodeData } from './node-data.ts'
import { layoutRuleGraph } from './rule-graph-layout.ts'
import { TargetNode, type TargetNodeType } from './TargetNode.tsx'
import { TriggerNode, type TriggerNodeType } from './TriggerNode.tsx'
import './LogicCanvas.css'

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  decision: DecisionNode,
  target: TargetNode,
}

type L2Node = TriggerNodeType | ActionNodeType | DecisionNodeType | TargetNodeType

const RULE_GAP = 80

export interface LogicCanvasProps {
  readonly text: string
  readonly program: Program
  readonly stateSet: StateSet
  readonly state: State
  readonly profile?: HardwareProfile
  readonly onApplyEdits: (edits: readonly TextEdit[]) => void
  /** Clique numa regra da lista: espelha para o editor de código. */
  readonly onSelectStatement?: (statementIndex: number) => void
  readonly highlightedStatement?: number | null
}

/**
 * Canvas de nível 2: a lógica dentro de um estado, em nós. Cada regra
 * (statement) do estado vira uma faixa própria, empilhada verticalmente — não
 * há uma junção entre elas, porque no MedState cada uma compila para uma
 * linha de transição independente.
 *
 * Editar um campo não guarda estado local: recompila a regra tocada na hora
 * e escreve no texto, igual ao arrastar do nível 1. O próximo render deriva
 * o grafo de novo a partir do texto reanalisado — o mesmo princípio de "o
 * texto é a verdade" dos dois níveis.
 */
export function LogicCanvas({
  text,
  program,
  stateSet,
  state,
  profile = EMPTY_PROFILE,
  onApplyEdits,
  onSelectStatement,
  highlightedStatement = null,
}: LogicCanvasProps) {
  const context: EditableContext = useMemo(
    () => ({ profile, index: buildIndex(program), stateSet }),
    [profile, program, stateSet],
  )
  const narrator = useMemo(() => createNarrator(program, profile), [program, profile])

  const rules = useMemo(
    () => state.statements.map((statement) => ({ statement, ...decompileStatement(statement) })),
    [state],
  )

  const handleEdit = (statementIndex: number, nodeId: string, patch: Record<string, unknown>) => {
    const { statement, graph } = rules[statementIndex]!
    const alvo = graph.nodes[nodeId]
    if (!alvo) return
    const patchedNode = { ...alvo, ...patch } as RuleNode
    const patchedGraph: RuleGraph = {
      ...graph,
      nodes: { ...graph.nodes, [nodeId]: patchedNode },
    }
    try {
      onApplyEdits(setRule(text, statement, patchedGraph))
    } catch (error) {
      if (!(error instanceof CompileError)) throw error
      // Campo incompleto (ex.: comparação sem os dois lados) — não persiste
      // ainda, mas também não trava a edição em andamento.
    }
  }

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: L2Node[] = []
    const edges: Edge[] = []
    let yOffset = 0

    rules.forEach(({ graph }, statementIndex) => {
      const layout = layoutRuleGraph(graph)
      const prefixed = (id: string) => `${statementIndex}:${id}`
      const onEdit = (nodeId: string, patch: Record<string, unknown>) =>
        handleEdit(statementIndex, nodeId, patch)

      for (const node of walkGraph(graph)) {
        const pos = layout.positions.get(node.id) ?? { x: 0, y: 0 }
        const displayNode =
          node.kind === 'trigger' && graph.rawStatement !== undefined
            ? { ...node, raw: graph.rawStatement }
            : node

        const data: Level2NodeData = { node: displayNode, context, onEdit }
        nodes.push({
          id: prefixed(node.id),
          type: node.kind,
          position: { x: pos.x, y: pos.y + yOffset },
          data,
        } as L2Node)

        if (node.kind === 'trigger' || node.kind === 'action') {
          if (node.next) {
            edges.push({
              id: `${prefixed(node.id)}->${prefixed(node.next)}`,
              source: prefixed(node.id),
              target: prefixed(node.next),
              markerEnd: { type: MarkerType.ArrowClosed },
            })
          }
        } else if (node.kind === 'decision') {
          if (node.whenTrue) {
            edges.push({
              id: `${prefixed(node.id)}->${prefixed(node.whenTrue)}:sim`,
              source: prefixed(node.id),
              sourceHandle: DECISION_HANDLE_TRUE,
              target: prefixed(node.whenTrue),
              style: { stroke: 'var(--role-reward)' },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--role-reward)' },
            })
          }
          if (node.whenFalse) {
            edges.push({
              id: `${prefixed(node.id)}->${prefixed(node.whenFalse)}:nao`,
              source: prefixed(node.id),
              sourceHandle: DECISION_HANDLE_FALSE,
              target: prefixed(node.whenFalse),
              style: { stroke: 'var(--error)' },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--error)' },
            })
          }
        }
      }

      yOffset += layout.height + RULE_GAP
    })

    return { initialNodes: nodes, initialEdges: edges }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, context])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Cada edição (mesmo num campo de outro nó) recompila a regra tocada e
  // reconstrói o grafo inteiro do zero — sem isso, um arrasto manual some a
  // cada campo editado. Os ids são estáveis entre recomputações (a mesma
  // estrutura de segmentos sempre numera os nós na mesma ordem, ver
  // `createIdFactory`), então basta herdar a posição do nó anterior com o
  // mesmo id; só um nó realmente novo cai no layout automático.
  useEffect(() => {
    setNodes((current) => {
      const posicaoAnterior = new Map(current.map((n) => [n.id, n.position]))
      return initialNodes.map((n) => {
        const pos = posicaoAnterior.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
    })
  }, [initialNodes, setNodes])
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges])

  return (
    <div className="logic-canvas">
      <div className="logic-canvas-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <aside className="logic-canvas-code">
        <h3>O que cada regra faz</h3>
        {state.statements.length === 0 && <p className="logic-canvas-vazio">Nenhuma regra ainda.</p>}
        <ol>
          {state.statements.map((statement, i) => (
            <li
              key={i}
              className={i === highlightedStatement ? 'logic-canvas-regra--destacada' : undefined}
              onClick={() => onSelectStatement?.(i)}
            >
              {narrator.statement(statement, stateSet)}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
