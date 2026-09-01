import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Program, State, StateSet, Statement } from '../../core/ast.ts'
import type { TextEdit } from '../../core/edit.ts'
import { deleteStatement, expandPulse, insertStatement, setRule } from '../../core/mutations.ts'
import { buildIndex } from '../../core/validate/index.ts'
import { CompileError } from '../../graph/compile.ts'
import { decompileStatement } from '../../graph/decompile.ts'
import type { NodeId, RuleGraph, RuleNode } from '../../graph/model.ts'
import {
  addNode,
  connect,
  disconnect,
  insertNode,
  nodeFromCatalog,
  removeNode,
  type Porta,
} from '../../graph/mutate.ts'
import { canConnect, validateGraph, type GraphProblem } from '../../graph/validate.ts'
import { suggestCounters } from '../../vocab/counters.ts'
import { createNarrator } from '../../vocab/narrate.ts'
import { EMPTY_PROFILE, type HardwareProfile } from '../../vocab/profile.ts'
import { aceitaBloco, blocoDoEvento, fioNoPonteiro } from '../bloco-arrastado.ts'
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

/** Preferência de painel recolhido, por navegador. */
const EXPLICACAO_CHAVE = 'ratflow.explicacaoRegras'

/**
 * Etiqueta de uma faixa: diz onde uma regra começa. Sem ela, duas regras
 * grandes empilhadas viram um borrão só — e o número casa com a lista "O que
 * cada regra faz", do painel ao lado.
 */
function FaixaLabel({ data }: NodeProps<FaixaNodeType>) {
  return <div className="logic-canvas-faixa">{data.titulo}</div>
}

type FaixaNodeType = Node<{ titulo: string }, 'faixa'>

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  decision: DecisionNode,
  target: TargetNode,
  faixa: FaixaLabel,
}

type L2Node = TriggerNodeType | ActionNodeType | DecisionNodeType | TargetNodeType | FaixaNodeType

/** Respiro entre duas regras — tem que ser maior que a folga entre linhas da mesma regra. */
const RULE_GAP = 200
/** Altura reservada para a etiqueta, acima do primeiro card da faixa. */
const BAND_LABEL_HEIGHT = 46

/** Chave da regra dentro do estado: o índice no texto, ou a regra ainda inexistente. */
type Chave = number | 'nova'

/** Onde o fio nasce — o que uma aresta precisa carregar para poder ser cortada. */
interface L2EdgeData extends Record<string, unknown> {
  readonly chave: Chave
  readonly from: NodeId
  readonly porta: Porta
}

/**
 * Uma regra em edição que ainda não compila: campo vazio, nó solto, ramo
 * cortado. Vive só aqui até fechar — o texto nunca recebe regra incompleta,
 * porque `compileRule` percorre a partir do gatilho e um nó fora do caminho
 * simplesmente desapareceria no próximo reparse.
 */
interface Rascunho {
  readonly chave: Chave
  readonly graph: RuleGraph
  /** Posição dos nós que o layout não sabe colocar (soltos), na faixa da regra. */
  readonly posSolta: Readonly<Record<NodeId, { x: number; y: number }>>
}

interface Regra {
  readonly chave: Chave
  readonly statement: Statement | undefined
  readonly graph: RuleGraph
}

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
 * Toda mutação — campo, bloco novo, fio, exclusão — passa pelo funil `gravar`:
 * recompila a regra tocada e escreve no texto. O que não compila ainda fica no
 * `rascunho`, visível e sinalizado, até o usuário terminar. Fora do rascunho
 * não há estado local: o próximo render deriva tudo do texto reanalisado.
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
    () => ({
      profile,
      index: buildIndex(program),
      stateSet,
      counters: suggestCounters(program),
    }),
    [profile, program, stateSet],
  )
  const narrator = useMemo(() => createNarrator(program, profile), [program, profile])

  // A explicação recolhe. Ela e o painel de código do app disputam o mesmo
  // lado direito da tela, e com os dois abertos não sobra canvas. A escolha
  // mora no `localStorage` porque o `LogicCanvas` é remontado (via `key`) a
  // cada estado aberto — um `useState` sozinho voltaria a abrir toda vez.
  const [explicacaoPreferida, setExplicacaoPreferida] = useState(
    () => localStorage.getItem(EXPLICACAO_CHAVE) !== 'fechada',
  )
  const alternarExplicacao = (abrir: boolean) => {
    setExplicacaoPreferida(abrir)
    localStorage.setItem(EXPLICACAO_CHAVE, abrir ? 'aberta' : 'fechada')
  }

  const doTexto = useMemo(
    () => state.statements.map((statement) => ({ statement, ...decompileStatement(statement) })),
    [state],
  )

  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)

  // O rascunho vale só para o texto que o gerou: uma gravação bem-sucedida ou
  // uma tecla no painel de código o descartam. É isto que impede gravar com um
  // `statement.span` velho por cima de uma edição feita no editor.
  useEffect(() => {
    setRascunho(null)
    setMotivo(null)
  }, [text])

  const rules = useMemo<Regra[]>(() => {
    const base: Regra[] = doTexto.map((r, i) => ({
      chave: i,
      statement: r.statement,
      graph: rascunho?.chave === i ? rascunho.graph : r.graph,
    }))
    if (rascunho?.chave === 'nova') {
      base.push({ chave: 'nova', statement: undefined, graph: rascunho.graph })
    }
    return base
  }, [doTexto, rascunho])

  const grafoDe = (chave: Chave): RuleGraph | null =>
    rules.find((r) => r.chave === chave)?.graph ?? null

  /**
   * Funil único de escrita. Tenta compilar; se a regra ainda não fecha, guarda
   * como rascunho em vez de perder a edição — era o que acontecia antes, com um
   * `catch` vazio que descartava tudo em silêncio.
   */
  const gravar = (
    chave: Chave,
    graph: RuleGraph,
    posSolta: Rascunho['posSolta'] = {},
  ) => {
    setMotivo(null)
    const posicoes = { ...(rascunho?.chave === chave ? rascunho.posSolta : {}), ...posSolta }
    try {
      const statement = doTexto[chave as number]?.statement
      // Um nó "pulsar" só existe enquanto é novo: escrevê-lo cria o estado
      // auxiliar com o `OFF`, e no próximo reparse a regra volta como um `ON`
      // comum apontando para esse estado. Por isso a presença do nó é a única
      // condição — não há como confundir com um pulso já escrito.
      const pulso = Object.values(graph.nodes).find(
        (n) => n.kind === 'action' && n.spec === 'pulsar',
      )
      onApplyEdits(
        pulso
          ? expandPulse(text, stateSet, state, statement, graph, pulso.id).edits
          : statement === undefined
            ? insertStatement(text, state, graph)
            : setRule(text, statement, graph),
      )
      setRascunho(null)
    } catch (error) {
      if (!(error instanceof CompileError)) throw error
      setRascunho({ chave, graph, posSolta: posicoes })
    }
  }

  const handleEdit = (chave: Chave, nodeId: string, patch: Record<string, unknown>) => {
    const graph = grafoDe(chave)
    const alvo = graph?.nodes[nodeId]
    if (!graph || !alvo) return
    gravar(chave, {
      ...graph,
      nodes: { ...graph.nodes, [nodeId]: { ...alvo, ...patch } as RuleNode },
    })
  }

  const { initialNodes, initialEdges, faixas } = useMemo(() => {
    const nodes: L2Node[] = []
    const edges: Edge<L2EdgeData>[] = []
    const faixas: { chave: Chave; y0: number }[] = []
    let yOffset = 0

    for (const { chave, graph } of rules) {
      const layout = layoutRuleGraph(graph)
      const prefixed = (id: string) => juntarId(chave, id)
      const onEdit = (nodeId: string, patch: Record<string, unknown>) =>
        handleEdit(chave, nodeId, patch)

      const problemasPorNo = new Map<NodeId, GraphProblem[]>()
      for (const problema of validateGraph(graph)) {
        if (problema.nodeId === null) continue
        const lista = problemasPorNo.get(problema.nodeId) ?? []
        lista.push(problema)
        problemasPorNo.set(problema.nodeId, lista)
      }

      faixas.push({ chave, y0: yOffset })

      nodes.push({
        id: `faixa:${chave}`,
        type: 'faixa',
        position: { x: 0, y: yOffset - BAND_LABEL_HEIGHT },
        data: {
          titulo: chave === 'nova' ? 'Regra nova (ainda não salva)' : `Regra ${chave + 1}`,
        },
        draggable: false,
        selectable: false,
        deletable: false,
      } as FaixaNodeType)

      // Todos os nós, não só os alcançáveis: um nó que o usuário acabou de
      // soltar e ainda não ligou existe no grafo e precisa aparecer para poder
      // ser ligado.
      for (const node of Object.values(graph.nodes)) {
        const solta = rascunho?.chave === chave ? rascunho.posSolta[node.id] : undefined
        const pos = solta ?? layout.positions.get(node.id) ?? { x: 0, y: 0 }
        const displayNode =
          node.kind === 'trigger' && graph.rawStatement !== undefined
            ? { ...node, raw: graph.rawStatement }
            : node

        const data: Level2NodeData = {
          node: displayNode,
          context,
          onEdit,
          problemas: problemasPorNo.get(node.id),
        }
        nodes.push({
          id: prefixed(node.id),
          type: node.kind,
          position: { x: pos.x, y: pos.y + yOffset },
          data,
        } as L2Node)

        const fio = (to: NodeId, porta: Porta, extra: Partial<Edge<L2EdgeData>> = {}) => {
          edges.push({
            id: `${prefixed(node.id)}->${prefixed(to)}:${porta}`,
            source: prefixed(node.id),
            target: prefixed(to),
            data: { chave, from: node.id, porta },
            markerEnd: { type: MarkerType.ArrowClosed },
            ...extra,
          })
        }

        if (node.kind === 'trigger' || node.kind === 'action') {
          if (node.next) fio(node.next, 'next')
        } else if (node.kind === 'decision') {
          if (node.whenTrue) {
            fio(node.whenTrue, 'whenTrue', {
              sourceHandle: DECISION_HANDLE_TRUE,
              style: { stroke: 'var(--role-reward)' },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--role-reward)' },
            })
          }
          if (node.whenFalse) {
            fio(node.whenFalse, 'whenFalse', {
              sourceHandle: DECISION_HANDLE_FALSE,
              style: { stroke: 'var(--error)' },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--error)' },
            })
          }
        }
      }

      yOffset += layout.height + RULE_GAP
    }

    return { initialNodes: nodes, initialEdges: edges, faixas }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, context, rascunho])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<L2EdgeData>>(initialEdges)

  // Cada edição (mesmo num campo de outro nó) recompila a regra tocada e
  // reconstrói o grafo inteiro do zero — sem isso, um arrasto manual some a
  // cada campo editado. Os ids são estáveis entre recomputações enquanto a
  // estrutura não muda (ver `createIdFactory`), então basta herdar a posição do
  // nó anterior com o mesmo id.
  //
  // Um bloco novo fica onde foi solto enquanto é rascunho e salta para a coluna
  // do fluxograma quando a regra fecha: os ids do nível 2 são renumerados
  // quando a estrutura muda, então uma posição gravada por id apodreceria na
  // primeira inserção. O layout automático manda, de propósito.
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

  const rfInstance = useRef<ReactFlowInstance<Node, Edge<L2EdgeData>> | null>(null)
  const [fioAlvo, setFioAlvo] = useState<string | null>(null)

  useEffect(() => {
    setEdges((atuais) =>
      atuais.map((e) => ({ ...e, className: e.id === fioAlvo ? 'fio-alvo' : undefined })),
    )
  }, [fioAlvo, setEdges])

  const handleDragOver = (event: React.DragEvent) => {
    if (!aceitaBloco(event)) return
    event.preventDefault() // sem isto o `drop` nunca dispara
    event.dataTransfer.dropEffect = 'copy'
    const id = fioNoPonteiro(event)
    if (id !== fioAlvo) setFioAlvo(id)
  }

  const handleDrop = (event: React.DragEvent) => {
    setFioAlvo(null)
    if (!aceitaBloco(event)) return
    event.preventDefault()

    const bloco = blocoDoEvento(event)
    if (!bloco || bloco.kind === 'estado') return

    // Solto sobre um fio: entra no meio da corrente, herdando o que vinha depois.
    const fio = fioNoPonteiro(event)
    if (fio) {
      const data = edges.find((e) => e.id === fio)?.data
      const graph = data && grafoDe(data.chave)
      if (!data || !graph) return
      const resultado = insertNode(graph, data.from, nodeFromCatalog(bloco, graph), data.porta)
      if (!resultado) {
        setMotivo('Não deu para encaixar o bloco nesta seta.')
        return
      }
      gravar(data.chave, resultado)
      return
    }

    // Um gatilho sempre começa uma regra nova: é a única coisa que pode ser a
    // raiz, e uma regra já tem a sua.
    if (bloco.kind === 'trigger') {
      if (rascunho !== null) {
        setMotivo('Termine a regra em edição antes de começar outra.')
        return
      }
      const novo = nodeFromCatalog(bloco, { root: '', nodes: {} })
      gravar('nova', { root: novo.id, nodes: { [novo.id]: novo } })
      return
    }

    // Qualquer outro bloco solto no vazio pertence à faixa onde caiu, e fica
    // solto até ser ligado.
    const pos = rfInstance.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const faixa = pos && faixaEm(faixas, pos.y)
    const graph = faixa && grafoDe(faixa.chave)
    if (!faixa || !graph || !pos) {
      setMotivo('Arraste primeiro um gatilho ("Quando…") para começar uma regra.')
      return
    }
    const novo = nodeFromCatalog(bloco, graph)
    gravar(faixa.chave, addNode(graph, novo), {
      [novo.id]: { x: pos.x, y: pos.y - faixa.y0 },
    })
  }

  const handleConnect = (connection: Connection) => {
    const origem = separarId(connection.source)
    const destino = separarId(connection.target)
    if (origem.chave !== destino.chave) {
      setMotivo('Cada regra é uma linha independente no arquivo — não dá para ligar uma à outra.')
      return
    }
    const graph = grafoDe(origem.chave)
    if (!graph) return

    const check = canConnect(graph, origem.nodeId, destino.nodeId)
    if (!check.ok) {
      setMotivo(check.reason ?? 'Não dá para ligar assim.')
      return
    }
    const porta: Porta =
      connection.sourceHandle === DECISION_HANDLE_FALSE
        ? 'whenFalse'
        : connection.sourceHandle === DECISION_HANDLE_TRUE
          ? 'whenTrue'
          : 'next'
    const resultado = connect(graph, origem.nodeId, destino.nodeId, porta)
    if (resultado) gravar(origem.chave, resultado)
  }

  /**
   * Apagar acontece no texto (ou no rascunho), e devolvemos `false` para o
   * React Flow nunca mexer no estado local: senão o nó desaparece antes da
   * confirmação e o canvas fica fora de sincronia com o arquivo.
   *
   * Um item por gesto. Duas edições no mesmo lote usariam offsets da AST
   * anterior à primeira, e a segunda cairia no lugar errado.
   */
  const handleBeforeDelete = async ({
    nodes: ns,
    edges: es,
  }: {
    nodes: Node[]
    edges: Edge<L2EdgeData>[]
  }) => {
    if (ns.length + es.length > 1) {
      setMotivo('Apague um bloco (ou uma seta) por vez.')
      return false
    }

    const node = ns[0]
    if (node) {
      const { chave, nodeId } = separarId(node.id)
      const graph = grafoDe(chave)
      if (!graph) return false

      if (nodeId === graph.root) {
        // Apagar o gatilho é apagar a regra inteira.
        const statement = doTexto[chave as number]?.statement
        if (!statement) {
          setRascunho(null) // regra que ainda não existe no arquivo: só descartar
        } else if (window.confirm('Excluir esta regra inteira do arquivo?')) {
          onApplyEdits(deleteStatement(text, statement))
        }
        return false
      }
      gravar(chave, removeNode(graph, nodeId))
      return false
    }

    const data = es[0]?.data
    const graph = data && grafoDe(data.chave)
    if (data && graph) gravar(data.chave, disconnect(graph, data.from, data.porta))
    return false
  }

  const pendencias = rascunho ? validateGraph(rascunho.graph) : []

  // Uma regra que ainda não fecha só existe na tela: esconder esse aviso seria
  // esconder a única pista de que o arquivo não mudou. Enquanto houver
  // pendência, o painel fica aberto mesmo que a preferência diga o contrário.
  const precisaAtencao = pendencias.length > 0 || !!motivo
  const explicacaoAberta = explicacaoPreferida || precisaAtencao

  return (
    <div className="logic-canvas">
      <div
        className="logic-canvas-flow"
        onDragOver={handleDragOver}
        onDragLeave={() => setFioAlvo(null)}
        onDrop={handleDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onBeforeDelete={handleBeforeDelete}
          deleteKeyCode={['Delete', 'Backspace']}
          onInit={(instance) => {
            rfInstance.current = instance
          }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {!explicacaoAberta && (
        <aside className="logic-canvas-code logic-canvas-code--fechada">
          <button
            type="button"
            className="logic-canvas-alternar"
            title="Mostrar a explicação das regras"
            aria-label="Mostrar a explicação das regras"
            aria-expanded={false}
            onClick={() => alternarExplicacao(true)}
          >
            ◂
          </button>
        </aside>
      )}

      <aside className="logic-canvas-code" hidden={!explicacaoAberta}>
        <div className="logic-canvas-code-topo">
          <button
            type="button"
            className="logic-canvas-alternar"
            title={
              precisaAtencao
                ? 'Fica aberto enquanto houver regra por terminar'
                : 'Recolher a explicação'
            }
            aria-label="Recolher a explicação das regras"
            aria-expanded
            disabled={precisaAtencao}
            onClick={() => alternarExplicacao(false)}
          >
            ▸
          </button>
        </div>

        {(pendencias.length > 0 || motivo) && (
          <section className="logic-canvas-pendencias">
            <h3>Falta terminar</h3>
            {motivo && <p className="logic-canvas-motivo">{motivo}</p>}
            <ul>
              {pendencias.map((problema, i) => (
                <li key={i}>
                  <strong>{problema.plain}</strong>
                  {problema.fix && <span> {problema.fix}</span>}
                </li>
              ))}
            </ul>
            <p className="logic-canvas-pendencias-nota">
              Enquanto a regra não fecha, ela fica só aqui na tela — o arquivo não muda.
            </p>
          </section>
        )}

        <h3>O que cada regra faz</h3>
        {state.statements.length === 0 && (
          <p className="logic-canvas-vazio">
            Nenhuma regra ainda. Arraste um bloco de "Quando…" da paleta para começar.
          </p>
        )}
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

// ------------------------------------------------------- ids compostos

/** Os ids do React Flow precisam ser únicos entre regras: `0:a1`, `nova:g0`. */
function juntarId(chave: Chave, nodeId: NodeId): string {
  return `${chave}:${nodeId}`
}

function separarId(id: string): { chave: Chave; nodeId: NodeId } {
  const corte = id.indexOf(':')
  const prefixo = id.slice(0, corte)
  return {
    chave: prefixo === 'nova' ? 'nova' : Number(prefixo),
    nodeId: id.slice(corte + 1),
  }
}

/** Em qual faixa (regra) caiu um `y` do canvas. A última faixa vale até o fim. */
function faixaEm(
  faixas: readonly { chave: Chave; y0: number }[],
  y: number,
): { chave: Chave; y0: number } | null {
  let atual: { chave: Chave; y0: number } | null = null
  for (const faixa of faixas) {
    if (y >= faixa.y0 - RULE_GAP / 2) atual = faixa
  }
  return atual
}
