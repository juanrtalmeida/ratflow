import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Program, StateSet, Target } from '../../core/ast.ts'
import type { Diagnostic } from '../../core/validate/types.ts'
import { EMPTY_PROFILE, type HardwareProfile } from '../../vocab/profile.ts'
import { exportarCanvasPng, exportarCanvasSvg } from '../export.ts'
import { buildProtocolGraph, type ProtocolEdgeData } from './protocol-graph.ts'
import { StateNode, type StateNodeType } from './StateNode.tsx'
import { TransitionEdge, type TransitionEdgeType } from './TransitionEdge.tsx'
import './ProtocolCanvas.css'

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }

export interface ProtocolCanvasHandle {
  exportarPng: (nomeArquivo: string) => Promise<void>
  exportarSvg: (nomeArquivo: string) => Promise<void>
}

export interface ProtocolCanvasProps {
  readonly stateSet: StateSet
  readonly program: Program
  readonly profile?: HardwareProfile
  readonly diagnostics?: readonly Diagnostic[]
  /** Chamado quando um estado é solto em nova posição — persiste como `\@pos:`. */
  readonly onMoveState?: (stateIndex: number, pos: { x: number; y: number }) => void
  /** Duplo clique num estado: abre o nível 2 (lógica em nós). */
  readonly onOpenState?: (stateIndex: number) => void
  /** Duplo clique no vazio do canvas: cria um estado ali. */
  readonly onCreateState?: (pos: { x: number; y: number }) => void
  readonly onRenameState?: (stateIndex: number) => void
  readonly onDeleteState?: (stateIndex: number) => void
  /** Arrastar a ponta de uma seta para outro nó: religa a transição. */
  readonly onRetargetTransition?: (target: Target, newState: number | 'SX') => void
  /** Clique (simples) num estado: espelha para o editor de código. */
  readonly onSelectState?: (stateIndex: number) => void
  /** Estado a destacar porque o cursor do editor de código está nele. */
  readonly highlightedState?: number | null
  /** Estado ativo agora no simulador — pulsa. */
  readonly activeState?: number | null
}

/**
 * Canvas de nível 1: um nó por estado, uma aresta por transição. A posição dos
 * nós vem de `\@pos:` no `.MPC` (ou do dagre quando algum estado não tem
 * anotação); arrastar um nó não move um objeto solto — persiste no texto pelo
 * `onMoveState`, e o próximo render reflete de volta a posição gravada.
 */
export const ProtocolCanvas = forwardRef<ProtocolCanvasHandle, ProtocolCanvasProps>(
  function ProtocolCanvas(
    {
      stateSet,
      program,
      profile = EMPTY_PROFILE,
      diagnostics = [],
      onMoveState,
      onOpenState,
      onCreateState,
      onRenameState,
      onDeleteState,
      onRetargetTransition,
      onSelectState,
      highlightedState = null,
      activeState = null,
    },
    ref,
  ) {
  const graph = useMemo(
    () => buildProtocolGraph(stateSet, program, profile, diagnostics),
    [stateSet, program, profile, diagnostics],
  )

  const initialNodes = useMemo<StateNodeType[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'state',
        position: n.position,
        data: {
          ...n.data,
          onRename: (i: number) => onRenameState?.(i),
          onDelete: (i: number) => onDeleteState?.(i),
          highlighted: n.data.stateIndex === highlightedState,
          active: n.data.stateIndex === activeState,
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, onRenameState, onDeleteState, highlightedState, activeState],
  )
  const initialEdges = useMemo<TransitionEdgeType[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        type: 'transition',
        source: e.source,
        target: e.target,
        data: e.data,
        reconnectable: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-muted)' },
      })),
    [graph],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // O texto `.MPC` é a fonte da verdade: sempre que o programa é reanalisado
  // (inclusive depois de uma edição de posição), o canvas se realinha com ele.
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes])
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges])

  const rfInstance = useRef<ReactFlowInstance<StateNodeType, TransitionEdgeType> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      async exportarPng(nomeArquivo) {
        if (!rfInstance.current || !containerRef.current) return
        await exportarCanvasPng(rfInstance.current, containerRef.current, nomeArquivo)
      },
      async exportarSvg(nomeArquivo) {
        if (!rfInstance.current || !containerRef.current) return
        await exportarCanvasSvg(rfInstance.current, containerRef.current, nomeArquivo)
      },
    }),
    [],
  )

  const handleReconnect = (oldEdge: Edge, connection: Connection) => {
    const data = oldEdge.data as ProtocolEdgeData | undefined
    if (!data || !onRetargetTransition) return
    const newState = connection.target === connection.source ? 'SX' : Number(connection.target)
    onRetargetTransition(data.astTarget, newState)
  }

  const handlePaneDoubleClick = (event: React.MouseEvent) => {
    if (!onCreateState || !rfInstance.current) return
    const target = event.target as HTMLElement
    if (!target.classList.contains('react-flow__pane')) return
    const pos = rfInstance.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    onCreateState(pos)
  }

  return (
    <div className="protocol-canvas" ref={containerRef} onDoubleClick={handlePaneDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_event, node) => onMoveState?.(Number(node.id), node.position)}
        onNodeDoubleClick={(_event, node) => onOpenState?.(Number(node.id))}
        onNodeClick={(_event, node) => onSelectState?.(Number(node.id))}
        onReconnect={handleReconnect}
        edgesReconnectable
        onInit={(instance) => {
          rfInstance.current = instance
        }}
        zoomOnDoubleClick={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
  },
)
