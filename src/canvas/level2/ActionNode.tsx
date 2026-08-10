import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { RAW_SPEC, type ActionNode as ActionNodeModel } from '../../graph/model.ts'
import { actionSpec } from '../../vocab/catalog.ts'
import { DurationField, ParamField } from './ParamField.tsx'
import { propsDoNo, type Level2NodeData } from './node-data.ts'
import './Level2Node.css'

export type ActionNodeType = Node<Level2NodeData, 'action'>

export function ActionNode({ data }: NodeProps<ActionNodeType>) {
  const node = data.node as ActionNodeModel
  const spec = node.spec === RAW_SPEC ? undefined : actionSpec(node.spec)

  const set = (patch: Record<string, unknown>) => data.onEdit(node.id, patch)
  const setParam = (id: string, value: string) =>
    set({ params: { ...node.params, [id]: value } })

  return (
    <div {...propsDoNo(data)} data-kind="action">
      <Handle type="target" position={Position.Left} />
      <div className="l2-node-head">
        <span>{spec?.icon ?? '🧩'}</span>
        <span>{spec?.label ?? 'Ação avançada'}</span>
      </div>
      <div className="l2-node-body">
        {!spec && (
          <>
            <span className="l2-node-raw-tag">código original</span>
            <pre className="l2-node-raw">{node.raw}</pre>
          </>
        )}
        {spec?.params.map((p) =>
          p.type === 'duracao' ? (
            <DurationField
              key={p.id}
              amountLabel={p.label}
              amount={node.params[p.id] ?? ''}
              unit={node.params.unidade ?? 's'}
              onChangeAmount={(v) => setParam(p.id, v)}
              onChangeUnit={(v) => setParam('unidade', v)}
            />
          ) : (
            <ParamField
              key={p.id}
              spec={p}
              value={node.params[p.id] ?? ''}
              onChange={(v) => setParam(p.id, v)}
              context={data.context}
            />
          ),
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
