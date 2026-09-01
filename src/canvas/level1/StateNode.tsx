import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { PAPEL_ICON, type ProtocolNodeData } from './protocol-graph.ts'
import './StateNode.css'

/**
 * `ProtocolNodeData` é dado puro (testável sem React). Os callbacks de
 * renomear/excluir só existem no nível do componente — por isso entram aqui,
 * não lá, para não misturar UI com o mapeamento AST → grafo.
 */
export interface StateNodeData extends ProtocolNodeData {
  /** Abre o nível 2 — a lógica deste estado. */
  readonly onOpen: (stateIndex: number) => void
  readonly onRename: (stateIndex: number) => void
  readonly onDelete: (stateIndex: number) => void
  /** O cursor do editor de código está dentro do span deste estado. */
  readonly highlighted?: boolean
  /** O simulador está com este estado ativo agora — pulsa. */
  readonly active?: boolean
}

export type StateNodeType = Node<StateNodeData, 'state'>

const SEVERITY_ICON: Record<string, string> = {
  error: '⛔',
  warning: '⚠',
  info: 'ℹ',
}

export function StateNode({ data, selected }: NodeProps<StateNodeType>) {
  const papel = data.papel ?? ''
  const icon = PAPEL_ICON[papel] ?? '⬤'

  return (
    <div
      className={`state-node${selected ? ' state-node--selected' : ''}${data.highlighted ? ' state-node--highlighted' : ''}${data.active ? ' state-node--active' : ''}`}
      data-papel={papel || undefined}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="state-node-head">
        <span className="state-node-icon">{icon}</span>
        <span className="state-node-nome">{data.label}</span>
        <span className="state-node-indice">S{data.stateIndex}</span>
      </div>

      <p className="state-node-resumo">{data.resumo}</p>

      <div className="state-node-rodape">
        {/* Sempre visível, e não só no hover: abrir a lógica é *a* ação do nó.
            Escondida atrás de um duplo clique, ninguém a encontrava. */}
        <button
          type="button"
          className="state-node-abrir"
          title="Abrir a lógica deste estado (duplo clique ou Enter)"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            data.onOpen(data.stateIndex)
          }}
        >
          Abrir lógica <span aria-hidden="true">›</span>
        </button>

        <span className="state-node-actions">
          <button
            type="button"
            className="state-node-action"
            title="Renomear"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              data.onRename(data.stateIndex)
            }}
          >
            ✏️
          </button>
          <button
            type="button"
            className="state-node-action"
            title="Excluir"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete(data.stateIndex)
            }}
          >
            🗑
          </button>
        </span>
      </div>

      {data.severity && (
        <span className={`state-node-badge state-node-badge--${data.severity}`}>
          {SEVERITY_ICON[data.severity]} {data.diagnosticCount}
        </span>
      )}
    </div>
  )
}
