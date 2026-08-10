import { tokenize } from './lexer.ts'
import { isTrivia, type Span, type Token, type TokenKind } from './tokens.ts'
import type {
  Command,
  CommandDetail,
  CommentNode,
  Condition,
  ConstantDef,
  DimDecl,
  DiskDirective,
  ListDecl,
  MetaAnnotations,
  Operand,
  ParseDiagnostic,
  PreambleItem,
  Program,
  RawPreamble,
  Segment,
  State,
  StateSet,
  Statement,
  Target,
  Trigger,
  TriggerDetail,
  VarAlias,
  VarAliasBlock,
} from './ast.ts'

// ---------------------------------------------------------------- utilidades

interface LogicalLine {
  readonly tokens: readonly Token[]
  /** Tokens significativos: sem espaços, comentários nem quebra de linha. */
  readonly sig: readonly Token[]
  readonly comments: readonly Token[]
  readonly start: number
  readonly end: number
}

function toLines(tokens: readonly Token[], textLength: number): LogicalLine[] {
  const lines: LogicalLine[] = []
  let current: Token[] = []

  const flush = (fallbackPos: number) => {
    const start = current[0]?.start ?? fallbackPos
    const end = current[current.length - 1]?.end ?? fallbackPos
    lines.push({
      tokens: current,
      sig: current.filter((t) => !isTrivia(t)),
      comments: current.filter((t) => t.kind === 'comment'),
      start,
      end,
    })
    current = []
  }

  for (const token of tokens) {
    current.push(token)
    if (token.kind === 'newline') flush(token.end)
  }
  if (current.length > 0) flush(textLength)

  return lines
}

/** Recorta o span dos tokens significativos, ignorando trivia nas pontas. */
function trimSpan(tokens: readonly Token[], fallback: number): Span {
  const sig = tokens.filter((t) => !isTrivia(t))
  if (sig.length === 0) return [fallback, fallback]
  return [sig[0]!.start, sig[sig.length - 1]!.end]
}

/**
 * Como `trimSpan`, mas mantém comentários de anotação (`\@nome:`, `\@pos:`…).
 * É o span de cabeçalho que as mutações do canvas reescrevem: precisa cobrir o
 * comentário inteiro, senão a reescrita duplica a anotação em vez de trocá-la.
 */
function trimSpanKeepingComments(tokens: readonly Token[], fallback: number): Span {
  const sig = tokens.filter((t) => t.kind !== 'whitespace' && t.kind !== 'newline')
  if (sig.length === 0) return [fallback, fallback]
  return [sig[0]!.start, sig[sig.length - 1]!.end]
}

function rawOf(text: string, span: Span): string {
  return text.slice(span[0], span[1])
}

/** Divide por um separador, ignorando ocorrências dentro de `(` ou `[`. */
function splitTopLevel(
  tokens: readonly Token[],
  kind: TokenKind,
): Token[][] {
  const parts: Token[][] = []
  let depth = 0
  let current: Token[] = []

  for (const token of tokens) {
    if (token.kind === 'lparen' || token.kind === 'lbracket') depth++
    else if (token.kind === 'rparen' || token.kind === 'rbracket') depth--
    else if (depth === 0 && token.kind === kind) {
      parts.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  parts.push(current)
  return parts
}

/** Índice do primeiro token do tipo dado fora de parênteses/colchetes. */
function indexOfTopLevel(tokens: readonly Token[], kind: TokenKind): number {
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    // O teste vem antes do ajuste de profundidade para que procurar por
    // `lbracket` encontre o próprio abre-colchete de nível zero.
    if (depth === 0 && token.kind === kind) return i
    if (token.kind === 'lparen' || token.kind === 'lbracket') depth++
    else if (token.kind === 'rparen' || token.kind === 'rbracket') depth--
  }
  return -1
}

function keywordOf(token: Token | undefined): string {
  return token?.kind === 'ident' ? token.text.toUpperCase() : ''
}

// ------------------------------------------------------------- anotações

// Um mesmo comentário pode trazer várias anotações — o valor de cada uma vai
// até a próxima barra invertida: `\@nome: Espera \@papel: espera \@pos: 20,40`.
const META_RE = /\\\s*@(\w+)\s*:\s*([^\\]*)/g

function parseMeta(commentText: string): MetaAnnotations {
  let meta: MetaAnnotations = {}

  for (const match of commentText.matchAll(META_RE)) {
    const key = match[1]!.toLowerCase()
    const value = match[2]!.trim()

    if (key === 'nome') meta = { ...meta, nome: value }
    else if (key === 'papel') meta = { ...meta, papel: value }
    else if (key === 'macro') meta = { ...meta, macro: value }
    else if (key === 'pos') {
      const coords = /^(-?[\d.]+)\s*,\s*(-?[\d.]+)$/.exec(value)
      if (coords) {
        meta = { ...meta, pos: { x: Number(coords[1]), y: Number(coords[2]) } }
      }
    }
  }

  return meta
}

function mergeMeta(comments: readonly Token[]): MetaAnnotations {
  let meta: MetaAnnotations = {}
  for (const comment of comments) {
    meta = { ...meta, ...parseMeta(comment.text) }
  }
  return meta
}

// -------------------------------------------------------------- operandos

function parseOperand(text: string, tokens: readonly Token[]): Operand {
  const span = trimSpan(tokens, tokens[0]?.start ?? 0)
  const raw = rawOf(text, span)
  const sig = tokens.filter((t) => !isTrivia(t))
  const base = { kind: 'Operand' as const, span, raw }

  if (sig.length === 0) return { ...base, type: 'unknown', name: '' }

  if (sig[0]!.kind === 'caret' && sig[1]?.kind === 'ident') {
    return { ...base, type: 'constant', name: sig[1]!.text }
  }

  if (sig[0]!.kind === 'number' && sig.length === 1) {
    return { ...base, type: 'number', name: sig[0]!.text }
  }

  // `.01` sem zero à esquerda — extremamente comum em arquivos reais
  // (`.01": ON^HOUSELIGHT ...`). O léxico só junta o ponto a um número
  // quando já vinha consumindo dígitos antes dele, então aqui o ponto chega
  // como token próprio, seguido do número. `name` fica com o texto exato
  // (".01", não "0.01") para reimprimir idêntico — `Number(".01")` já
  // avalia certo em JS, então nada que lê `name` como número precisa mudar.
  if (sig[0]!.kind === 'dot' && sig[1]?.kind === 'number' && sig.length === 2) {
    return { ...base, type: 'number', name: raw }
  }

  if (sig[0]!.kind === 'ident') {
    // `A(I)` — elemento de array. O índice fica como texto para suportar
    // expressões que ainda não modelamos, inclusive índices aninhados como
    // `D(B(17))`. Por isso é o parêntese de FECHAMENTO CORRESPONDENTE que
    // importa, não o primeiro que aparecer.
    if (sig[1]?.kind === 'lparen') {
      let depth = 0
      let close = -1
      for (let i = 1; i < sig.length; i++) {
        if (sig[i]!.kind === 'lparen') depth++
        else if (sig[i]!.kind === 'rparen') {
          depth--
          if (depth === 0) {
            close = i
            break
          }
        }
      }
      const inner = close > 2 ? sig.slice(2, close) : []
      const index = inner.length > 0 ? rawOf(text, trimSpan(inner, 0)) : ''
      return { ...base, type: 'element', name: sig[0]!.text, index }
    }
    if (sig.length === 1) {
      return { ...base, type: 'variable', name: sig[0]!.text }
    }
  }

  return { ...base, type: 'unknown', name: raw }
}

// ---------------------------------------------------------------- gatilhos

const SIGNAL_RE = /^Z(\d+)$/i

function parseTriggerDetail(
  text: string,
  sig: readonly Token[],
): TriggerDetail | null {
  if (sig.length === 0) return null

  // `#START`, `#R1`, `#R^Alavanca`, `#Z3`
  if (sig[0]!.kind === 'hash') {
    const head = sig[1]
    if (head?.kind !== 'ident') return null
    const name = head.text

    if (name.toUpperCase() === 'START' && sig.length === 2) {
      return { kind: 'start' }
    }

    const signal = SIGNAL_RE.exec(name)
    if (signal && sig.length === 2) {
      return { kind: 'signal', number: Number(signal[1]) }
    }

    // `#R1` — canal e número colados no mesmo identificador. O operando cobre
    // apenas os dígitos, para que o span aponte para a porta e não para o canal.
    const inline = /^([A-Za-z]+?)(\d+)$/.exec(name)
    if (inline && sig.length === 2) {
      const digitsStart = head.start + inline[1]!.length
      return {
        kind: 'response',
        channel: inline[1]!.toUpperCase(),
        port: {
          kind: 'Operand',
          span: [digitsStart, head.end],
          raw: inline[2]!,
          type: 'number',
          name: inline[2]!,
        },
      }
    }

    // `#R^Alavanca` — canal seguido de constante.
    if (sig[2]?.kind === 'caret' && sig[3]?.kind === 'ident' && sig.length === 4) {
      return {
        kind: 'response',
        channel: name.toUpperCase(),
        port: parseOperand(text, sig.slice(2)),
      }
    }
    return null
  }

  // Tempo: `5"`, `0.05"`, `^Tempo'`, `A"`
  const last = sig[sig.length - 1]!
  if (last.kind === 'quote' || last.kind === 'apostrophe') {
    const amountTokens = sig.slice(0, -1)
    if (amountTokens.length === 0) return null
    const amount = parseOperand(text, amountTokens)
    if (amount.type === 'unknown') return null
    return { kind: 'time', amount, unit: last.kind === 'quote' ? 's' : 'min' }
  }

  return null
}

function parseTrigger(text: string, tokens: readonly Token[]): Trigger {
  const span = trimSpan(tokens, tokens[0]?.start ?? 0)
  const sig = tokens.filter((t) => !isTrivia(t))
  return {
    kind: 'Trigger',
    span,
    raw: rawOf(text, span),
    parsed: parseTriggerDetail(text, sig),
  }
}

// ---------------------------------------------------------------- comandos

const COMPARISON_OPS = new Set(['=', '<', '>', '<=', '>=', '<>'])

function parseCondition(text: string, tokens: readonly Token[]): Condition {
  const span = trimSpan(tokens, tokens[0]?.start ?? 0)
  const raw = rawOf(text, span)
  const sig = tokens.filter((t) => !isTrivia(t))

  const opIndex = sig.findIndex(
    (t) =>
      (t.kind === 'op' || t.kind === 'equals') && COMPARISON_OPS.has(t.text),
  )
  if (opIndex <= 0 || opIndex === sig.length - 1) {
    return { kind: 'Condition', span, raw, left: null, operator: null, right: null }
  }

  return {
    kind: 'Condition',
    span,
    raw,
    left: parseOperand(text, sig.slice(0, opIndex)),
    operator: sig[opIndex]!.text,
    right: parseOperand(text, sig.slice(opIndex + 1)),
  }
}

function parseCommandDetail(
  text: string,
  sig: readonly Token[],
): CommandDetail | null {
  if (sig.length === 0) return null

  const head = keywordOf(sig[0])
  const rest = sig.slice(1)

  if (head === 'ON' || head === 'OFF' || head === 'LOCKON' || head === 'LOCKOFF') {
    const ports = splitTopLevel(rest, 'comma')
      .filter((part) => part.some((t) => !isTrivia(t)))
      .map((part) => parseOperand(text, part))
    if (ports.length === 0) return null
    return { kind: 'port', op: head, ports }
  }

  if (head === 'ADD' || head === 'SUB') {
    if (rest.length === 0) return null
    return { kind: 'counter', op: head, target: parseOperand(text, rest) }
  }

  if (head === 'SET') {
    const assignments = splitTopLevel(rest, 'comma')
      .map((part) => {
        const eq = indexOfTopLevel(part, 'equals')
        if (eq <= 0) return null
        const valueTokens = part.slice(eq + 1)
        const valueSpan = trimSpan(valueTokens, part[eq]!.end)
        return {
          target: parseOperand(text, part.slice(0, eq)),
          value: rawOf(text, valueSpan),
          valueSpan,
        }
      })
      .filter((a) => a !== null)
    if (assignments.length === 0) return null
    return { kind: 'set', assignments }
  }

  if (head === 'SHOW') {
    const fields = splitTopLevel(rest, 'comma')
    const items: {
      slot: string
      label: string
      value: Operand
    }[] = []
    // `SHOW` recebe trios: posição, rótulo e valor.
    for (let i = 0; i + 2 < fields.length + 1; i += 3) {
      const slot = fields[i]
      const label = fields[i + 1]
      const value = fields[i + 2]
      if (!slot || !label || !value) break
      items.push({
        slot: rawOf(text, trimSpan(slot, 0)),
        label: rawOf(text, trimSpan(label, 0)),
        value: parseOperand(text, value),
      })
    }
    if (items.length === 0) return null
    return { kind: 'show', items }
  }

  if (head === 'IF') {
    const open = indexOfTopLevel(rest, 'lbracket')
    if (open < 0) return null
    const close = rest.findIndex((t) => t.kind === 'rbracket')
    if (close < open) return null

    const labels = splitTopLevel(rest.slice(open + 1, close), 'comma')
      .map((part) => {
        const inner = part.filter((t) => !isTrivia(t))
        return inner[0]?.kind === 'at' && inner[1]?.kind === 'ident'
          ? inner[1]!.text
          : null
      })
      .filter((l) => l !== null)

    if (labels.length === 0) return null
    return {
      kind: 'if',
      condition: parseCondition(text, rest.slice(0, open)),
      thenLabel: labels[0]!,
      elseLabel: labels[1] ?? null,
    }
  }

  // `Z1` … `Z32` — pulso para outro processo.
  const signal = SIGNAL_RE.exec(sig[0]!.text)
  if (sig[0]!.kind === 'ident' && signal && sig.length === 1) {
    return { kind: 'signal', number: Number(signal[1]) }
  }

  return null
}

function parseCommand(text: string, tokens: readonly Token[]): Command | null {
  const sig = tokens.filter((t) => !isTrivia(t))
  if (sig.length === 0) return null
  const span = trimSpan(tokens, tokens[0]!.start)
  return {
    kind: 'Command',
    span,
    raw: rawOf(text, span),
    parsed: parseCommandDetail(text, sig),
  }
}

// -------------------------------------------------------------- transições

function parseTarget(text: string, tokens: readonly Token[]): Target {
  const span = trimSpan(tokens, tokens[0]?.start ?? 0)
  const raw = rawOf(text, span)
  const sig = tokens.filter((t) => !isTrivia(t))

  if (sig.length === 1 && sig[0]!.kind === 'ident') {
    const name = sig[0]!.text.toUpperCase()
    if (name === 'SX') return { kind: 'Target', span, raw, state: 'SX' }
    const numbered = /^S(\d+)$/.exec(name)
    if (numbered) {
      return { kind: 'Target', span, raw, state: Number(numbered[1]) }
    }
  }
  return { kind: 'Target', span, raw, state: null }
}

/** Um segmento vai até o `--->`; o que vem depois da seta é o destino. */
function parseSegment(
  text: string,
  label: string | null,
  labelSpan: Span | null,
  bodyTokens: readonly Token[],
  fallbackPos: number,
): Segment {
  const arrow = indexOfTopLevel(bodyTokens, 'arrow')
  const commandTokens = arrow < 0 ? bodyTokens : bodyTokens.slice(0, arrow)
  const targetTokens = arrow < 0 ? [] : bodyTokens.slice(arrow + 1)

  const commands = splitTopLevel(commandTokens, 'semicolon')
    .map((part) => parseCommand(text, part))
    .filter((c) => c !== null)

  const target =
    targetTokens.some((t) => !isTrivia(t)) ? parseTarget(text, targetTokens) : null

  const bodySpan = trimSpan(bodyTokens, fallbackPos)
  const start = labelSpan?.[0] ?? bodySpan[0]
  const end = bodySpan[1] > start ? bodySpan[1] : (labelSpan?.[1] ?? start)

  return {
    kind: 'Segment',
    span: [start, end],
    label,
    labelSpan,
    commands,
    target,
  }
}

/**
 * Um statement é `gatilho: comandos ---> destino`, seguido de zero ou mais
 * segmentos rotulados `@Nome: …` que servem de destino aos ramos de um `IF`.
 */
function parseStatement(
  text: string,
  tokens: readonly Token[],
  diagnostics: ParseDiagnostic[],
): Statement | null {
  const span = trimSpan(tokens, tokens[0]?.start ?? 0)
  if (span[0] === span[1]) return null

  const colon = indexOfTopLevel(tokens, 'colon')
  if (colon < 0) {
    diagnostics.push({
      span,
      severity: 'error',
      code: 'statement-sem-gatilho',
      plain:
        'Esta linha não tem dois-pontos separando o gatilho das ações. ' +
        'Toda regra tem a forma "quando isto: faça aquilo".',
    })
    return null
  }

  const trigger = parseTrigger(text, tokens.slice(0, colon))
  const body = tokens.slice(colon + 1)

  // Quebra o corpo nos rótulos `@Nome:` que estejam fora de colchetes —
  // os `@` dentro de `IF … [@A, @B]` são referências, não definições.
  const boundaries: number[] = []
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const token = body[i]!
    if (token.kind === 'lparen' || token.kind === 'lbracket') depth++
    else if (token.kind === 'rparen' || token.kind === 'rbracket') depth--
    else if (
      depth === 0 &&
      token.kind === 'at' &&
      body[i + 1]?.kind === 'ident' &&
      body[i + 2]?.kind === 'colon'
    ) {
      boundaries.push(i)
    }
  }

  const segments: Segment[] = []
  const firstEnd = boundaries[0] ?? body.length
  segments.push(
    parseSegment(text, null, null, body.slice(0, firstEnd), tokens[colon]!.end),
  )

  for (let b = 0; b < boundaries.length; b++) {
    const at = boundaries[b]!
    const nameToken = body[at + 1]!
    const end = boundaries[b + 1] ?? body.length
    segments.push(
      parseSegment(
        text,
        nameToken.text,
        [body[at]!.start, body[at + 2]!.end],
        body.slice(at + 3, end),
        body[at + 2]!.end,
      ),
    )
  }

  return {
    kind: 'Statement',
    span,
    raw: rawOf(text, span),
    trigger,
    segments,
  }
}

// -------------------------------------------------------------- preâmbulo

const DISK_DIRECTIVES = new Set(['DISKVARS', 'DISKCOLUMNS', 'DISKFORMAT'])

function parsePreambleLine(
  text: string,
  line: LogicalLine,
): PreambleItem | null {
  const sig = line.sig
  if (sig.length === 0) return null

  const span = trimSpan(line.tokens, line.start)
  const raw = rawOf(text, span)
  const rawItem: RawPreamble = { kind: 'RawPreamble', span, raw }

  // `^Nome = valor`
  if (sig[0]!.kind === 'caret' && sig[1]?.kind === 'ident') {
    const eq = indexOfTopLevel(sig, 'equals')
    if (eq < 0) return rawItem
    const valueTokens = sig.slice(eq + 1)
    const valueSpan = trimSpan(valueTokens, sig[eq]!.end)
    const def: ConstantDef = {
      kind: 'ConstantDef',
      span,
      raw,
      name: sig[1]!.text,
      nameSpan: [sig[1]!.start, sig[1]!.end],
      value: rawOf(text, valueSpan),
      valueSpan,
    }
    return def
  }

  const head = keywordOf(sig[0])

  if (head === 'DIM' && sig[1]?.kind === 'ident') {
    const eq = indexOfTopLevel(sig, 'equals')
    if (eq < 0) return rawItem
    const sizeTokens = sig.slice(eq + 1)
    const sizeSpan = trimSpan(sizeTokens, sig[eq]!.end)
    const dim: DimDecl = {
      kind: 'DimDecl',
      span,
      raw,
      variable: sig[1]!.text,
      size: rawOf(text, sizeSpan),
      sizeSpan,
    }
    return dim
  }

  if (head === 'LIST' && sig[1]?.kind === 'ident') {
    const eq = indexOfTopLevel(sig, 'equals')
    if (eq < 0) return rawItem
    const values = splitTopLevel(sig.slice(eq + 1), 'comma')
      .map((part) => rawOf(text, trimSpan(part, 0)))
      .filter((v) => v.length > 0)
    const list: ListDecl = {
      kind: 'ListDecl',
      span,
      raw,
      variable: sig[1]!.text,
      values,
    }
    return list
  }

  if (DISK_DIRECTIVES.has(head)) {
    const eq = indexOfTopLevel(sig, 'equals')
    if (eq < 0) return rawItem
    const valueTokens = sig.slice(eq + 1)
    const valuesSpan = trimSpan(valueTokens, sig[eq]!.end)
    const values = splitTopLevel(valueTokens, 'comma')
      .map((part) => rawOf(text, trimSpan(part, 0)))
      .filter((v) => v.length > 0)
    const directive: DiskDirective = {
      kind: 'DiskDirective',
      span,
      raw,
      directive: head,
      values,
      valuesSpan,
    }
    return directive
  }

  return rawItem
}

function parseAliasLine(text: string, line: LogicalLine): VarAlias | null {
  const eq = indexOfTopLevel(line.sig, 'equals')
  if (eq <= 0) return null
  const aliasSpan = trimSpan(line.sig.slice(0, eq), line.start)
  const variableSpan = trimSpan(line.sig.slice(eq + 1), line.sig[eq]!.end)
  return {
    span: trimSpan(line.tokens, line.start),
    alias: rawOf(text, aliasSpan),
    variable: rawOf(text, variableSpan),
  }
}

// ------------------------------------------------------------ classificação

function stateSetIndexOf(sig: readonly Token[]): number | null {
  if (
    sig.length >= 5 &&
    sig[0]!.kind === 'ident' &&
    sig[0]!.text.toUpperCase() === 'S' &&
    sig[1]!.kind === 'dot' &&
    sig[2]!.kind === 'ident' &&
    sig[2]!.text.toUpperCase() === 'S' &&
    sig[3]!.kind === 'dot' &&
    sig[4]!.kind === 'number'
  ) {
    return Number(sig[4]!.text)
  }
  return null
}

function stateIndexOf(sig: readonly Token[]): number | null {
  if (sig.length !== 2 || sig[0]!.kind !== 'ident' || sig[1]!.kind !== 'comma') {
    return null
  }
  const match = /^S(\d+)$/i.exec(sig[0]!.text)
  return match ? Number(match[1]) : null
}

function startsLabelSegment(sig: readonly Token[]): boolean {
  return sig[0]?.kind === 'at'
}

/**
 * Só gatilho e rótulo têm `:` fora de parênteses/colchetes — comandos usam
 * `=`. Uma linha sem dois-pontos de topo nunca começa uma regra nova: é a
 * lista de comandos continuando na linha de baixo, sem repetir o gatilho.
 * Arquivos reais de laboratório fazem isso o tempo todo para caber na tela.
 */
function hasTopLevelColon(sig: readonly Token[]): boolean {
  let depth = 0
  for (const token of sig) {
    if (token.kind === 'lparen' || token.kind === 'lbracket') depth++
    else if (token.kind === 'rparen' || token.kind === 'rbracket') depth--
    else if (depth === 0 && token.kind === 'colon') return true
  }
  return false
}

// -------------------------------------------------------------------- parse

/**
 * Analisa um arquivo `.MPC` inteiro. Nunca lança: entrada malformada produz uma
 * AST parcial mais uma lista de diagnósticos, para que o canvas continue
 * desenhando enquanto se digita.
 */
export function parseProgram(text: string): Program {
  const tokens = tokenize(text)
  const lines = toLines(tokens, text.length)
  const diagnostics: ParseDiagnostic[] = []

  const comments: CommentNode[] = []
  for (const token of tokens) {
    if (token.kind !== 'comment') continue
    comments.push({
      kind: 'Comment',
      span: [token.start, token.end],
      raw: token.text,
      meta: parseMeta(token.text),
    })
  }

  const preamble: PreambleItem[] = []
  const stateSets: StateSet[] = []

  // Metadados anotados em linhas de comentário logo acima de um cabeçalho.
  let pendingMeta: MetaAnnotations = {}

  // Acumuladores da estrutura em construção.
  let setIndex: number | null = null
  let setHeaderSpan: Span = [0, 0]
  let setMeta: MetaAnnotations = {}
  let setStart = 0
  let states: State[] = []

  let stateIndex: number | null = null
  let stateHeaderSpan: Span = [0, 0]
  let stateMeta: MetaAnnotations = {}
  let stateStart = 0
  let statements: Statement[] = []
  let statementTokens: Token[] = []

  const flushStatement = () => {
    if (statementTokens.length === 0) return
    const statement = parseStatement(text, statementTokens, diagnostics)
    if (statement) statements.push(statement)
    statementTokens = []
  }

  const flushState = (end: number) => {
    flushStatement()
    if (stateIndex === null) return
    states.push({
      kind: 'State',
      span: [stateStart, end],
      index: stateIndex,
      headerSpan: stateHeaderSpan,
      statements,
      meta: stateMeta,
    })
    stateIndex = null
    statements = []
  }

  const flushStateSet = (end: number) => {
    flushState(end)
    if (setIndex === null) return
    stateSets.push({
      kind: 'StateSet',
      span: [setStart, end],
      index: setIndex,
      headerSpan: setHeaderSpan,
      states,
      meta: setMeta,
    })
    setIndex = null
    states = []
  }

  let inVarAlias = false
  let aliasStart = 0
  let aliases: VarAlias[] = []

  const flushVarAlias = (end: number) => {
    if (!inVarAlias) return
    const span: Span = [aliasStart, end]
    const block: VarAliasBlock = {
      kind: 'VarAliasBlock',
      span,
      raw: rawOf(text, span),
      aliases,
    }
    preamble.push(block)
    inVarAlias = false
    aliases = []
  }

  for (const line of lines) {
    const sig = line.sig
    const isBlank = sig.length === 0

    // Linha só de comentário: pode anotar o cabeçalho que vem a seguir.
    if (isBlank) {
      if (line.comments.length > 0) {
        pendingMeta = { ...pendingMeta, ...mergeMeta(line.comments) }
      } else {
        pendingMeta = {}
      }
      continue
    }

    const newSetIndex = stateSetIndexOf(sig)
    if (newSetIndex !== null) {
      flushVarAlias(line.start)
      flushStateSet(line.start)
      setIndex = newSetIndex
      setStart = line.start
      setHeaderSpan = trimSpanKeepingComments(line.tokens, line.start)
      setMeta = { ...pendingMeta, ...mergeMeta(line.comments) }
      pendingMeta = {}
      continue
    }

    if (setIndex === null) {
      // Ainda no preâmbulo.
      if (inVarAlias) {
        if (keywordOf(sig[0]) === 'END') {
          flushVarAlias(line.end)
          pendingMeta = {}
          continue
        }
        const alias = parseAliasLine(text, line)
        if (alias) {
          aliases.push(alias)
          pendingMeta = {}
          continue
        }
        flushVarAlias(line.start)
      }

      if (keywordOf(sig[0]) === 'VAR_ALIAS') {
        const inlineAlias =
          indexOfTopLevel(sig, 'equals') > 0
            ? parseAliasLine(text, {
                ...line,
                sig: sig.slice(1),
              })
            : null
        inVarAlias = true
        aliasStart = line.start
        aliases = inlineAlias ? [inlineAlias] : []
        pendingMeta = {}
        continue
      }

      const item = parsePreambleLine(text, line)
      if (item) preamble.push(item)
      pendingMeta = {}
      continue
    }

    // Dentro de um processo.
    const newStateIndex = stateIndexOf(sig)
    if (newStateIndex !== null) {
      flushState(line.start)
      stateIndex = newStateIndex
      stateStart = line.start
      stateHeaderSpan = trimSpanKeepingComments(line.tokens, line.start)
      stateMeta = { ...pendingMeta, ...mergeMeta(line.comments) }
      pendingMeta = {}
      continue
    }

    if (stateIndex === null) {
      diagnostics.push({
        span: trimSpan(line.tokens, line.start),
        severity: 'error',
        code: 'linha-fora-de-estado',
        plain:
          'Esta linha está dentro de um processo mas antes de qualquer estado. ' +
          'Toda regra precisa vir depois de um cabeçalho de estado, como "S1,".',
      })
      pendingMeta = {}
      continue
    }

    // Linha iniciada por `@`, ou sem `:` de topo, continua o statement
    // anterior; só uma linha com gatilho ou rótulo próprios abre um novo.
    // Heurística documentada em GRAMMAR.md.
    if (!startsLabelSegment(sig) && hasTopLevelColon(sig)) flushStatement()
    statementTokens.push(...line.tokens)
    pendingMeta = {}
  }

  flushVarAlias(text.length)
  flushStateSet(text.length)

  return {
    kind: 'Program',
    span: [0, text.length],
    text,
    preamble,
    stateSets,
    comments,
    diagnostics,
  }
}
