import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { stateLabel } from '../../core/ast.ts'
import type { TargetNode as TargetNodeModel } from '../../graph/model.ts'
import { propsDoNo, type Level2NodeData } from './node-data.ts'
import './Level2Node.css'

export type TargetNodeType = Node<Level2NodeData, 'target'>

export function TargetNode({ data }: NodeProps<TargetNodeType>) {
  const node = data.node as TargetNodeModel
  const set = (patch: Record<string, unknown>) => data.onEdit(node.id, patch)

  const options = [
    { value: 'SX', label: '↺ Ficar aqui' },
    ...data.context.stateSet.states.map((s) => ({
      value: String(s.index),
      label: `▶ Ir para «${stateLabel(s)}»`,
    })),
  ]

  // `state: null` é um destino especial que este catálogo não modela (STOP,
  // ABORT, FLUSH, KILL… combinados) — mostra o texto original em vez do
  // dropdown, do mesmo jeito que um gatilho ou ação crus.
  if (node.state === null) {
    return (
      <div {...propsDoNo(data)} data-kind="target">
        <Handle type="target" position={Position.Left} />
        <div className="l2-node-head">
          <span>🧩</span>
          <span>Destino especial</span>
        </div>
        <div className="l2-node-body">
          <span className="l2-node-raw-tag">código original</span>
          <pre className="l2-node-raw">{node.raw}</pre>
        </div>
      </div>
    )
  }

  const value = node.state === 'SX' ? 'SX' : String(node.state)

  return (
    <div {...propsDoNo(data)} data-kind="target">
      <Handle type="target" position={Position.Left} />
      <div className="l2-node-head">
        <span>{node.state === 'SX' ? '↺' : '▶'}</span>
        <span>Destino</span>
      </div>
      <div className="l2-node-body">
        <select
          className="param-field-input nodrag"
          value={value}
          onChange={(e) => {
            const v = e.target.value
            set({ state: v === 'SX' ? 'SX' : Number(v) })
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
