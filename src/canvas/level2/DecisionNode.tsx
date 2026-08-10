import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { DecisionNode as DecisionNodeModel } from '../../graph/model.ts'
import { ParamField } from './ParamField.tsx'
import type { Level2NodeData } from './node-data.ts'
import './Level2Node.css'

export type DecisionNodeType = Node<Level2NodeData, 'decision'>

/** Ids dos handles de saída — as arestas do grafo se ligam a eles por nome. */
export const DECISION_HANDLE_TRUE = 'sim'
export const DECISION_HANDLE_FALSE = 'nao'

export function DecisionNode({ data }: NodeProps<DecisionNodeType>) {
  const node = data.node as DecisionNodeModel
  const set = (patch: Record<string, unknown>) => data.onEdit(node.id, patch)

  return (
    <div className="l2-node" data-kind="decision">
      <Handle type="target" position={Position.Left} />
      <div className="l2-node-head">
        <span>◆</span>
        <span>Se…</span>
      </div>
      <div className="l2-node-body">
        <div className="l2-node-decision-body">
          <ParamField
            spec={{ id: 'left', label: 'Quando', type: 'contador' }}
            value={node.left}
            onChange={(v) => set({ left: v })}
            context={data.context}
          />
          <ParamField
            spec={{ id: 'operator', label: '', type: 'comparador' }}
            value={node.operator}
            onChange={(v) => set({ operator: v })}
            context={data.context}
          />
          <ParamField
            spec={{ id: 'right', label: 'Valor', type: 'texto' }}
            value={node.right}
            onChange={(v) => set({ right: v })}
            context={data.context}
          />
        </div>
      </div>
      <Handle
        id={DECISION_HANDLE_TRUE}
        type="source"
        position={Position.Right}
        style={{ top: '35%', background: 'var(--role-reward)' }}
      >
        <span className="l2-node-decision-handle-label l2-node-decision-handle-label--true">
          sim
        </span>
      </Handle>
      <Handle
        id={DECISION_HANDLE_FALSE}
        type="source"
        position={Position.Right}
        style={{ top: '75%', background: 'var(--error)' }}
      >
        <span className="l2-node-decision-handle-label l2-node-decision-handle-label--false">
          não
        </span>
      </Handle>
    </div>
  )
}
