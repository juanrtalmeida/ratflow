import type { Program, State, StateSet, Statement, Target, VarAliasBlock } from './ast.ts'
import { detectNewline, printStateHeader, printStateSetHeader } from './printer.ts'
import type { TextEdit } from './edit.ts'
import { compileRule } from '../graph/compile.ts'
import type { RuleGraph } from '../graph/model.ts'

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
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  return text.slice(lineStart, offset)
}

/**
 * Recompila uma regra editada no nível 2 e substitui a linha de transição
 * inteira. O recuo (da regra e dos rótulos) é lido do próprio arquivo, não
 * imposto por um padrão — assim um `.MPC` que usa tabs, ou 4 espaços, não é
 * reformatado por uma edição que só devia mudar um campo.
 */
export function setRule(text: string, statement: Statement, graph: RuleGraph): TextEdit[] {
  const lineStart = text.lastIndexOf('\n', statement.span[0] - 1) + 1
  const indent = indentBefore(text, statement.span[0])

  const rotulado = statement.segments.find((s) => s.labelSpan !== null)
  const labelIndent = rotulado
    ? indentBefore(text, rotulado.labelSpan![0])
    : indent + '     '

  const newText = compileRule(graph, { indent, labelIndent, newline: detectNewline(text) })
  return [{ span: [lineStart, statement.span[1]], newText, label: 'editar regra' }]
}
