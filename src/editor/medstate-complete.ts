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
 * | começo de linha | atalhos `def…`, processo, estado, `VAR_ALIAS`, regras prontas, comandos |
 * | `#` no começo de linha | regras prontas com gatilho, e os gatilhos sozinhos |
 * | `^` / `@` | constantes e rótulos que o arquivo já tem |
 * | `--->` | os estados do arquivo, e `SX` |
 * | palavra no meio da linha | comandos e os atalhos de anotação (`defname`…) |
 *
 * A família `def…` (`defstate`, `defname`, `defpulse`, …) é o caminho para
 * quem não tem a sintaxe na cabeça: digitar `def` lista tudo o que o editor
 * sabe escrever. Cada atalho reaproveita o corpo do snippet equivalente, então
 * os dois caminhos nunca divergem.
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
 * Corpos compartilhados entre o snippet achado pelo nome da sintaxe (`S.S.`,
 * `IF`) e o seu atalho `def…` (`defprocess`, `defif`). Escritos uma vez só
 * porque são a mesma coisa oferecida por dois caminhos — quem já sabe a
 * sintaxe digita a sintaxe, quem não sabe digita `def` e lê a lista.
 */
const CORPO_PROCESSO =
  'S.S.${n}, \\@nome: ${nome do processo}\nS1, \\@nome: ${primeiro estado}\n\t#START: ---> SX'
const CORPO_ESTADO = 'S${n}, \\@nome: ${nome} \\@papel: ${espera}'
const CORPO_VAR_ALIAS = 'VAR_ALIAS\n\t${Respostas} = ${A}\nEND'
const CORPO_START = '#START: SET ${A} = 0 ---> S${destino}'
const CORPO_RESPOSTA = '#R^${Dispositivo}: ADD ${A} ---> SX'
const CORPO_TEMPO = '${tempo}": ---> S${destino}'
const CORPO_IF =
  'IF ${A} >= ${valor} [@${Sim}, @${Nao}]\n\t@${Sim}: ---> S${destino}\n\t@${Nao}: ---> SX'

/**
 * Estruturas que exigem saber a sintaxe de cabeça. Ofertadas só no começo de
 * uma linha, que é o único lugar onde uma estrutura pode começar — no meio de
 * uma linha, o que faz sentido é um comando.
 */
const SNIPPETS_ESTRUTURA: readonly Completion[] = [
  snippetCompletion(CORPO_PROCESSO, {
    label: 'S.S.',
    type: 'class',
    detail: 'processo novo, com o primeiro estado',
    info: 'Cada processo (S.S.n) roda em paralelo aos outros e tem o seu próprio #START.',
  }),
  snippetCompletion(CORPO_ESTADO, {
    label: 'S',
    type: 'class',
    detail: 'estado novo, já com nome e papel',
  }),
  snippetCompletion(CORPO_VAR_ALIAS, {
    label: 'VAR_ALIAS',
    type: 'keyword',
    detail: 'bloco de apelidos de contador',
    info: 'Dá um nome amigável a uma variável de uma letra. Não aceita posição de array — para `B(5)`, use um comentário `\\ B(5) = nome`.',
  }),
]

const SNIPPETS_REGRA: readonly Completion[] = [
  snippetCompletion(CORPO_START, {
    label: '#START:',
    type: 'text',
    detail: 'início da sessão: zera um contador e segue',
  }),
  snippetCompletion(CORPO_RESPOSTA, {
    label: '#R^',
    type: 'text',
    detail: 'contar uma resposta e ficar no estado',
  }),
  snippetCompletion(CORPO_TEMPO, {
    label: 'tempo":',
    type: 'text',
    detail: 'depois de N segundos, ir para outro estado',
  }),
  snippetCompletion(CORPO_IF, {
    label: 'IF …[@Sim, @Nao]',
    type: 'text',
    detail: 'decisão com os dois caminhos já escritos',
    info: 'Os dois rótulos são um único campo cada: renomeie no `IF` e o segmento acompanha.',
  }),
]

// ------------------------------------------------------- atalhos `def…`

/**
 * A família `def…`: um nome curto e previsível para cada coisa que se escreve
 * com frequência. Digitar `def` abre a lista inteira — é a forma de descobrir
 * o que existe sem decorar a sintaxe do MedState nem sair do editor.
 *
 * Os que escrevem **anotação** (`defname`, `defpapel`, `defpos`) vêm separados
 * porque são os únicos que fazem sentido no meio de uma linha: o lugar natural
 * de um `\@nome:` é o fim do cabeçalho de um estado. Os outros começam linha.
 */
const SNIPPETS_DEF_ANOTACAO: readonly Completion[] = [
  snippetCompletion('\\@nome: ${nome amigável}', {
    label: 'defname',
    type: 'property',
    detail: '\\@nome: … — nome amigável do estado ou processo',
    info: 'Aparece no canvas em vez de S1, S2… O MED-PC ignora, é um comentário.',
  }),
  snippetCompletion('\\@papel: ${espera}', {
    label: 'defpapel',
    type: 'property',
    detail: '\\@papel: … — espera, reforco, timeout ou fim',
    info: 'Dá cor e ícone ao estado no canvas de nível 1.',
  }),
  snippetCompletion('\\@pos: ${x},${y}', {
    label: 'defpos',
    type: 'property',
    detail: '\\@pos: x,y — posição do nó no canvas',
    info: 'Normalmente escrito por você arrastando o estado; só edite à mão para alinhar.',
  }),
]

const SNIPPETS_DEF: readonly Completion[] = [
  // estruturas
  snippetCompletion(CORPO_ESTADO, {
    label: 'defstate',
    type: 'class',
    detail: 'Sn, \\@nome: … \\@papel: … — cabeçalho de estado completo',
  }),
  snippetCompletion(CORPO_PROCESSO, {
    label: 'defprocess',
    type: 'class',
    detail: 'S.S.n — processo novo, com o primeiro estado',
  }),
  snippetCompletion(CORPO_VAR_ALIAS, {
    label: 'defalias',
    type: 'keyword',
    detail: 'VAR_ALIAS … END — apelidos de contador',
  }),
  snippetCompletion('^${Nome} = ${1}', {
    label: 'defconst',
    type: 'constant',
    detail: '^Nome = valor — constante de porta ou de parâmetro',
  }),
  snippetCompletion('DIM ${B} = ${19}', {
    label: 'defdim',
    type: 'keyword',
    detail: 'DIM B = 19 — transforma a variável num array',
  }),
  snippetCompletion('LIST ${Intervalos} = ${10, 20, 30, 40, 50}', {
    label: 'deflist',
    type: 'keyword',
    detail: 'LIST … — valores para sortear com RANDD/RANDI',
  }),
  snippetCompletion('DISKVARS = ${A, B}', {
    label: 'defdisk',
    type: 'keyword',
    detail: 'DISKVARS — o que vai para o arquivo de dados',
    info: 'O que não está aqui não é gravado no fim da sessão.',
  }),

  // regras
  snippetCompletion(CORPO_START, {
    label: 'defstart',
    type: 'text',
    detail: '#START: … — a regra que roda uma vez, no início',
  }),
  snippetCompletion(CORPO_RESPOSTA, {
    label: 'defresp',
    type: 'text',
    detail: '#R^Porta: ADD … — contar uma resposta sem sair do estado',
  }),
  snippetCompletion(CORPO_TEMPO, {
    label: 'deftimer',
    type: 'text',
    detail: 'N": ---> Sn — esperar e ir para outro estado',
  }),
  snippetCompletion(CORPO_IF, {
    label: 'defif',
    type: 'text',
    detail: 'IF … [@Sim, @Nao] — decisão com os dois ramos escritos',
  }),
  snippetCompletion('#Z${1}: ---> S${destino}', {
    label: 'defsignal',
    type: 'text',
    detail: '#Zn: … — receber um sinal de outro processo',
  }),
  snippetCompletion('Z${1}', {
    label: 'defsend',
    type: 'text',
    detail: 'Zn — emitir um sinal para os outros processos',
  }),
  snippetCompletion('SHOW ${1}, ${RESPOSTAS}, ${A}', {
    label: 'defshow',
    type: 'text',
    detail: 'SHOW posição, rótulo, valor — mostrar no painel do MED-PC',
  }),
  snippetCompletion('RANDD ${C} = ${Intervalos}', {
    label: 'defrand',
    type: 'text',
    detail: 'RANDD — sortear da LIST sem repetir até esgotar',
  }),

  // padrões de vários estados
  snippetCompletion(
    'S${n}, \\@nome: ${Reforço} \\@papel: reforco\n\t.01": ON ^${Pelota} ---> S${seguinte}\nS${seguinte}, \\@nome: ${Pulso} \\@papel: reforco\n\t${0.05}": OFF ^${Pelota} ---> S${destino}',
    {
      label: 'defpulse',
      type: 'text',
      detail: 'pulso: dois estados que ligam e desligam um dispositivo',
      info: 'Não existe "ligue por 50 ms" no MedState — um pulso é sempre um par de estados.',
    },
  ),
  snippetCompletion(
    '#R^${Alavanca}: ADD ${A}; IF ${A} >= ^${Razao} [@${Reforco}, @${Continua}]\n\t@${Reforco}: SET ${A} = 0 ---> S${destino}\n\t@${Continua}: ---> SX',
    {
      label: 'defcount',
      type: 'text',
      detail: 'razão fixa: conta, testa a meta e zera',
      info: 'O teste vem depois do ADD — com ^Razao = 5, o reforço sai na quinta resposta.',
    },
  ),
  snippetCompletion(
    'S${n}, \\@nome: ${Intervalo} \\@papel: timeout\n\t.01": OFF ^${LuzCasa} ---> S${seguinte}\nS${seguinte}, \\@nome: ${Volta} \\@papel: espera\n\t^${ITI}": ON ^${LuzCasa} ---> S${destino}',
    {
      label: 'defiti',
      type: 'text',
      detail: 'intervalo entre tentativas: apaga, espera, acende',
    },
  ),
  snippetCompletion(
    'S.S.${12}, \\@nome: ${Relógio da sessão}\nS1, \\@nome: ${Início} \\@papel: espera\n\t#START: ---> S2\nS2, \\@nome: ${Contando} \\@papel: espera\n\t.01": ADD ${B(1)};\n\t\tSHOW ${6}, TEMPO, ${B(1)}/6000;\n\t\tIF ${B(1)} < ${A(2)} [@${Segue}, @${Para}]\n\t\t\t@${Segue}: ---> SX\n\t\t\t@${Para}: ---> STOPABORTFLUSH',
    {
      label: 'defclock',
      type: 'text',
      detail: 'processo do relógio da sessão, com critério de parada',
      info: 'O temporizador de estado sempre reinicia ao entrar — medir a sessão inteira precisa de um processo só para isso.',
    },
  ),
  snippetCompletion(
    'S.S.${1}, \\@nome: ${Teste da caixa}\nS1, \\@nome: ${Acende tudo} \\@papel: espera\n\t.01": ON ^${LuzCasa}, ^${LuzAlavanca} ---> S2\nS2, \\@nome: ${Espera resposta} \\@papel: espera\n\t#R^${Alavanca}: ON ^${Dispensador} ---> S3\nS3, \\@nome: ${Pulso} \\@papel: reforco\n\t1": OFF ^${Dispensador}, ^${LuzAlavanca}, ^${LuzCasa};\n\t\tADD ${B(0)}; SHOW 1, PRONTO, ${B(0)} ---> S4\nS4, \\@nome: ${Pronto} \\@papel: fim\n\t1": ---> SX',
    {
      label: 'defbox',
      type: 'text',
      detail: 'teste de caixa: confere a fiação antes de começar a sessão',
      info: 'Custa dez linhas e evita perder um sujeito por um cabo solto.',
    },
  ),
]

/**
 * Tudo o que pode abrir uma linha, na ordem em que aparece no popup: os
 * atalhos primeiro, porque são o caminho de quem não decorou a sintaxe.
 */
const SNIPPETS_DE_LINHA: readonly Completion[] = [
  ...SNIPPETS_DEF,
  ...SNIPPETS_DEF_ANOTACAO,
  ...SNIPPETS_ESTRUTURA,
  ...SNIPPETS_REGRA,
]

/**
 * Comandos que um snippet de linha já cobre pelo mesmo rótulo — `VAR_ALIAS` é
 * o caso: o snippet escreve o bloco inteiro, a entrada de comando só repetia o
 * nome logo abaixo. Duas linhas idênticas no popup não ajudam ninguém a
 * escolher.
 */
const ROTULOS_DE_LINHA = new Set(SNIPPETS_DE_LINHA.map((s) => s.label))
const COMANDOS_FORA_DE_LINHA = OPCOES_COMANDO.filter((o) => !ROTULOS_DE_LINHA.has(o.label))

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
    ? [...SNIPPETS_DE_LINHA, ...COMANDOS_FORA_DE_LINHA]
    : [...SNIPPETS_DEF_ANOTACAO, ...OPCOES_COMANDO]

  if (palavra.from === context.pos && !context.explicit) return null
  return { from: palavra.from, options, validFor }
}

export function medstateComplete() {
  return autocompletion({ override: [fonte] })
}
