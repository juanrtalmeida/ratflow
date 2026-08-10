import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { tokenize } from '../core/lexer.ts'
import { isTrivia, type Token, type TokenKind } from '../core/tokens.ts'
import { ajudaPalavra, COMANDOS } from './command-help.ts'

/**
 * Autocomplete do MedState. Quatro contextos, decididos pelo que vem antes do
 * cursor: `^` sugere constantes, `@` rótulos, `#` gatilhos, `--->` destinos, e
 * uma palavra solta sugere comandos.
 *
 * Os nomes vêm de tokenizar o próprio documento com `core/lexer.ts` — mesmo
 * princípio do realce e do hover. Não é só reuso: comentários chegam como
 * tokens `comment`, então os metadados do editor (`\@nome:`, `\@pos:`) não
 * entram na lista de rótulos, o que uma regex sobre o texto cru incluiria.
 */

const OPCOES_COMANDO: readonly Completion[] = Object.entries(COMANDOS).map(([label, ajuda]) => ({
  label,
  type: 'keyword',
  info: ajuda.texto,
}))

const OPCOES_GATILHO: readonly Completion[] = ['START', 'R', 'K', 'Z'].map((label) => ({
  label,
  type: 'keyword',
  info: ajudaPalavra(label, true)?.texto,
}))

const OPCAO_SX: Completion = { label: 'SX', type: 'keyword', info: COMANDOS.SX!.texto }

/** Idents colados num sigilo (`^Nome`, `@Rotulo`) — definições e usos, sem distinguir. */
function apósSigilo(tokens: readonly Token[], sigilo: TokenKind): Completion[] {
  const nomes = new Set<string>()
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i]!.kind === sigilo && tokens[i + 1]!.kind === 'ident') nomes.add(tokens[i + 1]!.text)
  }
  return [...nomes].map((label) => ({ label, type: sigilo === 'caret' ? 'constant' : 'property' }))
}

/**
 * Nomes de estado: pega tanto os cabeçalhos `S1,` quanto os destinos já
 * escritos. `S1` é um ident único para o lexer (`[A-Za-z_][A-Za-z0-9_]*`), e o
 * `S.S.1` do cabeçalho de processo sai como `S . S . 1` — três tokens, nenhum
 * casando a regex, então não polui a lista.
 *
 * ponytail: lista global, não só os estados do processo sob o cursor —
 * filtrar por `S.S.n` exige rastrear o bloco atual; fazer se virar ruído.
 */
function estados(tokens: readonly Token[]): Completion[] {
  const nomes = new Set<string>()
  for (const t of tokens) {
    if (t.kind === 'ident' && /^S\d+$/i.test(t.text)) nomes.add(t.text)
  }
  return [...nomes].map((label) => ({ label, type: 'variable' }))
}

function significativos(text: string): Token[] {
  return tokenize(text).filter((t) => !isTrivia(t))
}

/** Exportada para o teste — a única fonte de completions do editor. */
export function fonte(context: CompletionContext): CompletionResult | null {
  const validFor = /^\w*$/

  const sigilo = context.matchBefore(/[\^@#]\w*$/)
  if (sigilo) {
    const from = sigilo.from + 1
    if (sigilo.text[0] === '#') return { from, options: OPCOES_GATILHO, validFor }
    const kind = sigilo.text[0] === '^' ? 'caret' : 'at'
    return { from, options: apósSigilo(significativos(context.state.doc.toString()), kind), validFor }
  }

  const palavra = context.matchBefore(/\w*$/)!

  if (context.matchBefore(/--+>\s*\w*$/)) {
    const options = [...estados(significativos(context.state.doc.toString())), OPCAO_SX]
    return { from: palavra.from, options, validFor }
  }

  if (palavra.from === context.pos && !context.explicit) return null
  return { from: palavra.from, options: OPCOES_COMANDO, validFor }
}

export function medstateComplete() {
  return autocompletion({ override: [fonte] })
}
