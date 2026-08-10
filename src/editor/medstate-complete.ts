import {
  autocompletion,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { tokenize } from '../core/lexer.ts'
import { isTrivia, type Token, type TokenKind } from '../core/tokens.ts'
import { ajudaPalavra, COMANDOS } from './command-help.ts'

/**
 * Autocomplete e snippets do MedState. O contexto é decidido pelo que vem antes
 * do cursor:
 *
 * | onde | oferece |
 * | --- | --- |
 * | dentro de um comentário | `\@nome:`, `\@papel:` (as quatro opções), `\@pos:` |
 * | começo de linha | processo, estado, `VAR_ALIAS`, regras prontas, comandos |
 * | `#` no começo de linha | regras prontas com gatilho, e os gatilhos sozinhos |
 * | `^` / `@` | constantes e rótulos que o arquivo já tem |
 * | `--->` | os estados do arquivo, e `SX` |
 * | palavra no meio da linha | comandos |
 *
 * Os nomes vêm de tokenizar o próprio documento com `core/lexer.ts` — mesmo
 * princípio do realce e do hover. Não é só reuso: comentários chegam como
 * tokens `comment`, e é o que separa uma anotação do editor de um `@rótulo` de
 * decisão, coisa que uma regex sobre o texto cru confundiria.
 *
 * Os snippets usam `snippetCompletion`, então os campos `${...}` são navegáveis
 * com Tab. Campos com o mesmo nome andam juntos: no snippet de decisão,
 * renomear `@Sim` no `IF` renomeia o segmento rotulado no mesmo gesto.
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

/**
 * O cursor está dentro de um comentário? É o que separa "estou escrevendo
 * MedState" de "estou escrevendo uma anotação do editor" — e o lexer já sabe a
 * diferença, então não há regra própria aqui. `pos <= end` inclui o fim do
 * comentário, que é onde o cursor fica ao digitar no fim da linha.
 */
function dentroDeComentario(text: string, pos: number): boolean {
  return tokenize(text).some((t) => t.kind === 'comment' && pos >= t.start && pos <= t.end)
}

// ------------------------------------------------------------- snippets

/**
 * Anotações do editor, que viajam no `.MPC` como comentário e são invisíveis
 * para o MED-PC. São idiomas nossos: ninguém adivinha `\@papel: reforco`, então
 * só existem de verdade se o editor os oferecer.
 */
const PAPEIS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'espera', label: 'espera — o programa aguarda uma resposta ou um tempo' },
  { id: 'reforco', label: 'reforço — entrega pelota, água, som' },
  { id: 'timeout', label: 'intervalo — pausa entre tentativas' },
  { id: 'fim', label: 'fim — encerra a sessão' },
]

const SNIPPETS_METADADO: readonly Completion[] = [
  snippetCompletion('nome: ${nome amigável}', {
    label: 'nome:',
    type: 'property',
    detail: 'nome amigável do estado ou processo',
    info: 'Aparece no canvas em vez de S1, S2… O MED-PC ignora, é um comentário.',
  }),
  ...PAPEIS.map((papel) =>
    snippetCompletion(`papel: ${papel.id}`, {
      label: `papel: ${papel.id}`,
      type: 'enum',
      detail: papel.label,
      info: 'Dá cor e ícone ao estado no canvas de nível 1.',
    }),
  ),
  snippetCompletion('pos: ${x},${y}', {
    label: 'pos:',
    type: 'property',
    detail: 'posição do nó no canvas',
    info: 'Normalmente escrito por você arrastando o estado; só edite à mão se quiser alinhar.',
  }),
]

/**
 * Estruturas que exigem saber a sintaxe de cabeça. Ofertadas só no começo de
 * uma linha, que é o único lugar onde uma estrutura pode começar — no meio de
 * uma linha, o que faz sentido é um comando.
 */
const SNIPPETS_ESTRUTURA: readonly Completion[] = [
  snippetCompletion('S.S.${n}, \\@nome: ${nome do processo}\nS1, \\@nome: ${primeiro estado}\n\t#START: ---> SX', {
    label: 'S.S.',
    type: 'class',
    detail: 'processo novo, com o primeiro estado',
    info: 'Cada processo (S.S.n) roda em paralelo aos outros e tem o seu próprio #START.',
  }),
  snippetCompletion('S${n}, \\@nome: ${nome} \\@papel: espera', {
    label: 'S',
    type: 'class',
    detail: 'estado novo, já com nome e papel',
  }),
  snippetCompletion('VAR_ALIAS\n\t${Respostas} = ${A}\nEND', {
    label: 'VAR_ALIAS',
    type: 'keyword',
    detail: 'bloco de apelidos de contador',
    info: 'Dá um nome amigável a uma variável de uma letra. Não aceita posição de array — para `B(5)`, use um comentário `\\ B(5) = nome`.',
  }),
]

const SNIPPETS_REGRA: readonly Completion[] = [
  snippetCompletion('#START: SET ${A} = 0 ---> S${destino}', {
    label: '#START:',
    type: 'text',
    detail: 'início da sessão: zera um contador e segue',
  }),
  snippetCompletion('#R^${Dispositivo}: ADD ${A} ---> SX', {
    label: '#R^',
    type: 'text',
    detail: 'contar uma resposta e ficar no estado',
  }),
  snippetCompletion('${tempo}": ---> S${destino}', {
    label: 'tempo":',
    type: 'text',
    detail: 'depois de N segundos, ir para outro estado',
  }),
  snippetCompletion(
    'IF ${A} >= ${valor} [@${Sim}, @${Nao}]\n\t@${Sim}: ---> S${destino}\n\t@${Nao}: ---> SX',
    {
      label: 'IF …[@Sim, @Nao]',
      type: 'text',
      detail: 'decisão com os dois caminhos já escritos',
      info: 'Os dois rótulos são um único campo cada: renomeie no `IF` e o segmento acompanha.',
    },
  ),
]

/** Os snippets de regra que começam por `#`, para o caso do `#` no início da linha. */
const SNIPPETS_REGRA_HASH = SNIPPETS_REGRA.filter((s) => s.label.startsWith('#'))

/** Gatilhos com o `#` no rótulo — só quando o `#` já digitado entra na substituição. */
const OPCOES_GATILHO_HASH: readonly Completion[] = OPCOES_GATILHO.map((o) => ({
  ...o,
  label: `#${o.label}`,
}))

/** Exportada para o teste — a única fonte de completions do editor. */
export function fonte(context: CompletionContext): CompletionResult | null {
  const validFor = /^\w*$/
  const doc = context.state.doc.toString()

  // Dentro de um comentário só cabem as anotações do editor. Vem antes de tudo
  // porque `\@nome` casaria o ramo do sigilo `@` e ofereceria rótulos de `IF`.
  if (dentroDeComentario(doc, context.pos)) {
    const marca = context.matchBefore(/@[\w:]*$/)
    const palavra = context.matchBefore(/[\w:]*$/)!
    if (!marca && palavra.from === context.pos && !context.explicit) return null
    return {
      from: marca ? marca.from + 1 : palavra.from,
      options: SNIPPETS_METADADO,
      validFor: /^[\w:]*$/,
    }
  }

  // `#` no começo de uma linha é o início de uma regra, então ali vale oferecer
  // as regras prontas junto dos gatilhos. Neste caso o `from` inclui o próprio
  // `#`, porque os snippets já o escrevem.
  const hashNoInicio = context.matchBefore(/^[ \t]*#\w*$/)
  if (hashNoInicio) {
    const from = context.pos - (/#\w*$/.exec(hashNoInicio.text)?.[0].length ?? 1)
    return { from, options: [...SNIPPETS_REGRA_HASH, ...OPCOES_GATILHO_HASH], validFor: /^#?\w*$/ }
  }

  const sigilo = context.matchBefore(/[\^@#]\w*$/)
  if (sigilo) {
    const from = sigilo.from + 1
    if (sigilo.text[0] === '#') return { from, options: OPCOES_GATILHO, validFor }
    const kind = sigilo.text[0] === '^' ? 'caret' : 'at'
    return { from, options: apósSigilo(significativos(doc), kind), validFor }
  }

  const palavra = context.matchBefore(/\w*$/)!

  if (context.matchBefore(/--+>\s*\w*$/)) {
    const options = [...estados(significativos(doc)), OPCAO_SX]
    return { from: palavra.from, options, validFor }
  }

  // Começo de linha: cabe uma estrutura ou uma regra inteira, além dos
  // comandos. No meio de uma linha, só comando faz sentido.
  const inicioDeLinha = context.matchBefore(/^[ \t]*\w*$/) !== null
  const options = inicioDeLinha
    ? [...SNIPPETS_ESTRUTURA, ...SNIPPETS_REGRA, ...OPCOES_COMANDO]
    : OPCOES_COMANDO

  if (palavra.from === context.pos && !context.explicit) return null
  return { from: palavra.from, options, validFor }
}

export function medstateComplete() {
  return autocompletion({ override: [fonte] })
}
