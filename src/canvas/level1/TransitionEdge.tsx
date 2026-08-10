import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { ProtocolEdgeData } from './protocol-graph.ts'
import './TransitionEdge.css'

export type TransitionEdgeType = Edge<ProtocolEdgeData, 'transition'>

const KIND_STYLE: Record<
  ProtocolEdgeData['kind'],
  { stroke: string; dash?: string }
> = {
  start: { stroke: 'var(--accent)' },
  response: { stroke: 'var(--role-wait)' },
  time: { stroke: 'var(--role-timeout)', dash: '7 5' },
  signal: { stroke: '#c026d3', dash: '1 4' },
  raw: { stroke: 'var(--text-muted)', dash: '2 3' },
}

/** Um arco de "queda" fixa: sempre pertinho dos nós, nunca proporcional à distância. */
function archPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  dip: number,
  spread: number,
): [path: string, labelX: number, labelY: number] {
  const midY = Math.max(sourceY, targetY) + dip
  const path =
    `M ${sourceX},${sourceY} C ${sourceX + spread},${midY} ${targetX - spread},${midY} ${targetX},${targetY}`
  return [path, (sourceX + targetX) / 2, midY]
}

/**
 * O bezier padrão do React Flow escala a curvatura pela distância entre os
 * pontos. Isso é ótimo para uma transição normal, mas explode para fora da
 * tela em três casos: um auto-laço (`SX`, mesmo nó nas duas pontas), uma
 * transição "para trás" (ex.: `S4 ---> S2`, voltando a um estado anterior) ou
 * uma transição que salta por cima de outro nó (`S2 ---> S4`, pulando `S3`) —
 * a curva sai arqueando por centenas de pixels e nunca aparece no viewport,
 * ou fica escondida atrás do nó do meio. Nesses casos a "queda" do arco é um
 * valor fixo, não proporcional à distância: o laço e a volta arqueiam por
 * baixo, o salto arqueia por cima, e os três ficam sempre visíveis.
 */
function edgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  data: ProtocolEdgeData,
): [path: string, labelX: number, labelY: number] {
  if (data.selfLoop) return archPath(sourceX, sourceY, targetX, targetY, 64, 36)
  if (targetX < sourceX) return archPath(sourceX, sourceY, targetX, targetY, 88, 40)
  if (data.arc) return archPath(sourceX, sourceY, targetX, targetY, -88, 40)

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.25,
  })
  return [path, labelX, labelY]
}

export function TransitionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<TransitionEdgeType>) {
  if (!data) return null

  const [path, labelX, labelY] = edgePath(sourceX, sourceY, targetX, targetY, data)
  const style = KIND_STYLE[data.kind]

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: 1.75,
          strokeDasharray: style.dash,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="transition-edge-label"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            color: style.stroke,
          }}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
