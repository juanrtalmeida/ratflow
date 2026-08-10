import type { Program, State, StateSet, Statement, Target, VarAliasBlock } from './ast.ts'
import { detectNewline, printStateHeader, printStateSetHeader } from './printer.ts'
import type { TextEdit } from './edit.ts'
import type { Span } from './tokens.ts'
import { compileRule, CompileError } from '../graph/compile.ts'
import { foldablePulse, printPulseState } from '../graph/macros.ts'
import type { NodeId, RuleGraph, RuleNode } from '../graph/model.ts'
import { transitionRule } from '../graph/mutate.ts'

/**
 * Gestos do canvas que viram `TextEdit`. Cada função recebe o nó da AST que vai
 * mudar e devolve edições cirúrgicas — nunca reimprime o arquivo inteiro, para
 * que comentários e formatação de terceiros sobrevivam.
 *
 * Toda mutação que insere texto novo lê `detectNewline(text)` para casar com o
 * estilo do arquivo (muitos `.MPC` de laboratório são CRLF), e nunca decide
 * indentação por conta própria quando existe uma âncora no próprio arquivo
 * para copiar.
 */

/** Registra onde um estado foi arrastado no canvas, como `\@pos:` no cabeçalho. */
export function setStatePosition(
  state: State,
  pos: { x: number; y: number },
): TextEdit[] {
  const newText = printStateHeader(state.index, { ...state.meta, pos })
  return [{ span: state.headerSpan, newText, label: 'mover estado' }]
}

/** Renomeia um estado, reescrevendo só o comentário `\@nome:` do cabeçalho. */
export function renameState(state: State, nome: string): TextEdit[] {
  const newText = printStateHeader(state.index, { ...state.meta, nome })
  return [{ span: state.headerSpan, newText, label: 'renomear estado' }]
}

/**
 * Remove um estado inteiro. `state.span` já cobre do cabeçalho até a linha
 * anterior ao próximo cabeçalho (ver parser.ts), então a remoção não deixa
 * lixo nem come conteúdo do vizinho.
 *
 * Transições de outros estados que apontavam para este ficam sem alvo — isso
 * vira diagnóstico (`alvo-inexistente`) na próxima validação, não corrupção:
 * o arquivo continua um `.MPC` válido, só com um aviso para o autor resolver.
 */
export function deleteState(state: State): TextEdit[] {
  return [{ span: state.span, newText: '', label: 'excluir estado' }]
}

/** Religa uma transição existente para outro estado — só troca o texto depois de `--->`. */
export function retargetTransition(target: Target, newState: number | 'SX'): TextEdit[] {
  const newText = newState === 'SX' ? 'SX' : `S${newState}`
  return [{ span: target.span, newText, label: 'religar transição' }]
}

function nextIndex(indices: readonly number[]): number {
  return indices.length === 0 ? 1 : Math.max(...indices) + 1
}

export interface CreateStateResult {
  readonly edits: TextEdit[]
  readonly index: number
}

/** Cria um estado vazio no fim de um processo — sem regras ainda, pronto para ganhar lógica no canvas. */
export function createState(
  stateSet: StateSet,
  text: string,
  opts: { nome?: string; papel?: string; pos?: { x: number; y: number } } = {},
): CreateStateResult {
  const index = nextIndex(stateSet.states.map((s) => s.index))
  const newline = detectNewline(text)
  const at = stateSet.span[1]
  const newText = `${newline}${printStateHeader(index, opts)}${newline}`
  return { edits: [{ span: [at, at], newText, label: 'criar estado' }], index }
}

export interface CreateProcessResult {
  readonly edits: TextEdit[]
  readonly index: number
}

/** Cria um processo novo (`S.S.n`) com um `S1` inicial que já tem `#START`. */
export function createProcess(
  program: Program,
  text: string,
  opts: { nome?: string } = {},
): CreateProcessResult {
  const index = nextIndex(program.stateSets.map((s) => s.index))
  const newline = detectNewline(text)
  const at = program.span[1]
  const newText =
    `${newline}${printStateSetHeader(index, opts)}${newline}` +
    `${printStateHeader(1)}${newline}` +
    `  #START: ---> SX${newline}`
  return { edits: [{ span: [at, at], newText, label: 'novo processo' }], index }
}

/**
 * Insere `conteudo` no preâmbulo, depois do último item que já existe — ou,
 * se o preâmbulo estiver vazio, logo antes do primeiro `S.S.`. Só o segundo
 * caso precisa de quebra de linha própria depois: no primeiro, a quebra que
 * já separava o último item do resto do arquivo continua fazendo esse papel.
 */
function insertIntoPreamble(program: Program, newline: string, conteudo: string): TextEdit {
  const last = program.preamble[program.preamble.length - 1]
  if (last) {
    return { span: [last.span[1], last.span[1]], newText: `${newline}${conteudo}` }
  }
  const at = program.stateSets[0]?.span[0] ?? program.span[1]
  return { span: [at, at], newText: `${conteudo}${newline}${newline}` }
}

/** Cadastra um dispositivo novo como constante nativa (`^Nome = porta`) no preâmbulo. */
export function createDevice(
  program: Program,
  text: string,
  nome: string,
  porta: number,
): TextEdit[] {
  const newline = detectNewline(text)
  const edit = insertIntoPreamble(program, newline, `^${nome} = ${porta}`)
  return [{ ...edit, label: 'criar dispositivo' }]
}

/**
 * Dá (ou troca) o apelido amigável de uma variável A–Z, via `VAR_ALIAS`.
 * Atualiza a entrada se a variável já tem apelido; insere uma linha nova no
 * bloco existente se não tem; cria o bloco do zero se o arquivo ainda não
 * tem nenhum `VAR_ALIAS`.
 */
export function setCounterAlias(
  program: Program,
  text: string,
  variable: string,
  alias: string,
): TextEdit[] {
  const newline = detectNewline(text)
  const bloco = program.preamble.find(
    (item): item is VarAliasBlock => item.kind === 'VarAliasBlock',
  )

  if (bloco) {
    const existente = bloco.aliases.find((a) => a.variable === variable)
    if (existente) {
      return [
        { span: existente.span, newText: `${alias} = ${variable}`, label: 'renomear contador' },
      ]
    }
    const ultimo = bloco.aliases[bloco.aliases.length - 1]
    const at = ultimo ? ultimo.span[1] : bloco.span[0] + bloco.raw.indexOf(newline) + newline.length
    return [
      { span: [at, at], newText: `${newline}  ${alias} = ${variable}`, label: 'renomear contador' },
    ]
  }

  const conteudo = `VAR_ALIAS${newline}  ${alias} = ${variable}${newline}END`
  return [{ ...insertIntoPreamble(program, newline, conteudo), label: 'renomear contador' }]
}

/** O texto do início da linha até `offset`, para preservar o recuo original. */
function indentBefore(text: string, offset: number): string {
  return text.slice(inicioDaLinha(text, offset), offset)
}

/** Início da linha física que contém `offset`. */
function inicioDaLinha(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1
}

/** Fim da linha física que contém `offset`, antes do `\r\n` ou `\n`. */
function fimDaLinha(text: string, offset: number): number {
  const nl = text.indexOf('\n', offset)
  if (nl < 0) return text.length
  return nl > 0 && text[nl - 1] === '\r' ? nl - 1 : nl
}

/**
 * Recuo e quebra de linha a copiar do arquivo ao escrever uma regra. Sem
 * `statement` de referência — um estado que só tem cabeçalho — cai no padrão do
 * printer. É o que faz `setRule` e `insertStatement` formatarem igual.
 */
function ruleStyle(text: string, statement: Statement | undefined) {
  const newline = detectNewline(text)
  const indent = statement ? indentBefore(text, statement.span[0]) : '  '
  const rotulado = statement?.segments.find((s) => s.labelSpan !== null)
  const labelIndent = rotulado ? indentBefore(text, rotulado.labelSpan![0]) : indent + '     '
  return { indent, labelIndent, newline }
}

/**
 * Recompila uma regra editada no nível 2 e substitui a linha de transição
 * inteira. O recuo (da regra e dos rótulos) é lido do próprio arquivo, não
 * imposto por um padrão — assim um `.MPC` que usa tabs, ou 4 espaços, não é
 * reformatado por uma edição que só devia mudar um campo.
 */
export function setRule(text: string, statement: Statement, graph: RuleGraph): TextEdit[] {
  const newText = compileRule(graph, ruleStyle(text, statement))
  const span: Span = [inicioDaLinha(text, statement.span[0]), statement.span[1]]
  return [{ span, newText, label: 'editar regra' }]
}

/**
 * Acrescenta uma regra ao fim de um estado.
 *
 * A âncora é o **fim da linha física da última regra** — não `state.span[1]`,
 * que o parser estende até o começo da linha do próximo cabeçalho e portanto já
 * engoliu a linha em branco separadora e o comentário `\@nome:` que anota o
 * estado seguinte; e nem `statement.span[1]` puro, que exclui comentário de fim
 * de linha e empurraria o `\ nota` do autor para dentro da regra nova.
 *
 * Num estado que só tem cabeçalho, a âncora é o fim da linha do cabeçalho: é o
 * único pedaço desse estado que existe no arquivo.
 */
export function insertStatement(text: string, state: State, graph: RuleGraph): TextEdit[] {
  const style = ruleStyle(text, state.statements[0])
  const ultima = state.statements[state.statements.length - 1]
  const at = fimDaLinha(text, ultima ? ultima.span[1] : state.headerSpan[1])
  return [
    { span: [at, at], newText: style.newline + compileRule(graph, style), label: 'nova regra' },
  ]
}

/**
 * Remove uma regra inteira, linhas físicas e quebra de linha incluídas — uma
 * regra com segmentos rotulados ocupa várias linhas, e `statement.span` para no
 * último token significativo.
 *
 * Apagar a última regra deixa o estado só com o cabeçalho: continua um `.MPC`
 * válido e vira o aviso `estado-sem-saida`, do mesmo jeito que `deleteState`
 * deixa alvos órfãos em vez de sair corrigindo o arquivo por conta própria.
 */
export function deleteStatement(text: string, statement: Statement): TextEdit[] {
  const nl = text.indexOf('\n', statement.span[1])
  return [
    {
      span: [inicioDaLinha(text, statement.span[0]), nl < 0 ? text.length : nl + 1],
      newText: '',
      label: 'excluir regra',
    },
  ]
}

/**
 * O gesto de puxar um fio de um estado a outro no nível 1: uma regra nova, com
 * gatilho de tempo (ver `transitionRule`). A aresta nasce rotulada "depois de
 * 5 segundos" — visivelmente provisória, e editável no nível 2.
 */
export function createTransition(
  text: string,
  state: State,
  destino: number | 'SX',
  duracao = '5',
): TextEdit[] {
  return insertStatement(text, state, transitionRule(destino, duracao))
}

/**
 * Escreve "ligar por um tempo": o `ON` fica na regra, e o desligamento vai para
 * um estado auxiliar novo que espera a duração, faz `OFF` e segue para onde a
 * regra já ia. Um lote, uma transação, um desfazer.
 *
 * Não existe um comando único no MedState para isso, e o nó "pulsar" compila só
 * o `ON` (ver `compileAction`) — sem este par de edições o dispositivo ficaria
 * ligado para sempre, que é o tipo de erro silencioso que estraga um
 * experimento.
 */
export function expandPulse(
  text: string,
  stateSet: StateSet,
  state: State,
  statement: Statement | undefined,
  graph: RuleGraph,
  pulseNodeId: NodeId,
): CreateStateResult {
  const pulso = graph.nodes[pulseNodeId]
  if (!pulso || pulso.kind !== 'action' || pulso.spec !== 'pulsar') {
    throw new CompileError('Este nó não é um "ligar por um tempo".', pulseNodeId)
  }
  const dispositivo = pulso.params.dispositivo
  const duracao = pulso.params.duracao
  if (!dispositivo || !duracao) {
    throw new CompileError('Falta escolher o dispositivo e o tempo do pulso.', pulseNodeId)
  }
  if (pulso.params.unidade === 'min') {
    // `printPulseState` escreve o gatilho do auxiliar em segundos. Um pulso em
    // minutos não é um pulso — melhor pedir a troca do que converter o número
    // por trás do usuário.
    throw new CompileError('Um pulso é curto: escolha segundos, não minutos.', pulseNodeId)
  }

  // O auxiliar herda o destino da corrente do pulso, então é preciso achar onde
  // ela termina.
  let atual: RuleNode | null = pulso
  while (atual && atual.kind === 'action') {
    atual = atual.next === null ? null : (graph.nodes[atual.next] ?? null)
  }
  if (atual?.kind === 'decision') {
    throw new CompileError(
      'Ponha o "ligar por um tempo" depois da decisão: o desligamento precisa de um destino único.',
      pulseNodeId,
    )
  }
  if (atual?.kind !== 'target') {
    throw new CompileError(
      'Ligue este caminho a um destino antes: é para lá que o pulso volta depois de desligar.',
      pulseNodeId,
    )
  }
  if (atual.state === null) {
    throw new CompileError('O destino desta regra não é um estado — o pulso não sabe para onde voltar.', atual.id)
  }

  const index = nextIndex(stateSet.states.map((s) => s.index))
  // `SX` no auxiliar seria um laço infinito de `OFF`; voltar ao próprio estado
  // é o equivalente honesto (com a diferença, real, de reiniciar os
  // temporizadores dele — o que o usuário vê no canvas como uma seta de volta).
  const destino = atual.state === 'SX' ? state.index : atual.state

  const desviado: RuleGraph = {
    ...graph,
    nodes: { ...graph.nodes, [atual.id]: { ...atual, state: index } },
  }

  const newline = detectNewline(text)
  const auxiliar = printPulseState(
    { index, macro: { dispositivo, duracao }, destino },
    ruleStyle(text, statement).indent,
    newline,
  )
  const at = stateSet.span[1]

  const regra =
    statement === undefined
      ? insertStatement(text, state, desviado)
      : setRule(text, statement, desviado)
  const auxEdit: TextEdit = {
    span: [at, at],
    newText: `${newline}${auxiliar}${newline}`,
    label: 'ligar por um tempo',
  }

  // As duas âncoras coincidem quando este é o último estado do processo e o
  // arquivo não termina em quebra de linha. Duas inserções puras no mesmo
  // offset têm ordem indefinida e o lote as recusa — então viram uma só.
  const ultima = regra[regra.length - 1]!
  if (regra.length === 1 && ultima.span[0] === at && ultima.span[1] === at) {
    return {
      edits: [{ ...ultima, newText: ultima.newText + auxEdit.newText }],
      index,
    }
  }

  return { edits: [...regra, auxEdit], index }
}

/**
 * Desfaz um pulso: apaga o estado auxiliar e devolve quem apontava para ele ao
 * destino que vinha depois do `OFF`. `null` quando o estado não é (ou não é
 * mais) um auxiliar íntegro — aí quem decide é o usuário, não o editor.
 */
export function deletePulseState(stateSet: StateSet, aux: State): TextEdit[] | null {
  if (!foldablePulse(aux)) return null

  const destino = aux.statements[0]?.segments[0]?.target?.state
  // `SX` aponta para o próprio auxiliar, que está sendo apagado: sem destino
  // para onde religar, não há como desfazer sozinho.
  if (destino === undefined || destino === null || destino === 'SX') return null

  const religacoes = stateSet.states
    .filter((s) => s.index !== aux.index)
    .flatMap((s) => s.statements)
    .flatMap((s) => s.segments)
    .map((seg) => seg.target)
    .filter((t): t is Target => t?.state === aux.index)
    .flatMap((t) => retargetTransition(t, destino))

  return [...religacoes, ...deleteState(aux)]
}

/**
 * Solta um estado no meio de uma transição existente: `Sa ---> Sb` vira
 * `Sa ---> Snovo ---> Sb`. São três edições num lote só — criar o estado,
 * desviar a transição de origem para ele, e dar a ele a regra que segue para o
 * destino antigo. Sem essa terceira parte o estado novo seria um beco sem saída.
 */
export function insertStateInTransition(
  text: string,
  stateSet: StateSet,
  target: Target,
  opts: { papel?: string } = {},
): CreateStateResult {
  const destinoAntigo = target.state
  const criado = createState(stateSet, text, opts)

  // A regra do estado novo é escrita junto com o cabeçalho dele, na mesma
  // inserção: um estado que ainda não existe no texto não tem `State` para
  // servir de âncora a `insertStatement`, e duas inserções no mesmo offset
  // seriam recusadas pelo lote.
  const style = ruleStyle(text, undefined)
  const regra = compileRule(
    transitionRule(destinoAntigo === null ? 'SX' : destinoAntigo),
    style,
  )
  const comRegra = criado.edits.map((edit) => ({
    ...edit,
    newText: edit.newText + regra + style.newline,
  }))

  return {
    edits: [...comRegra, ...retargetTransition(target, criado.index)],
    index: criado.index,
  }
}
