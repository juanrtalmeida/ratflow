import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { fonte } from './medstate-complete.ts'

const DOC = `^Alavanca = 1
^Luz = 2
\\@nome: Esperando resposta
S.S.1,
S1,
  #START: ON ^Luz ---> S2
S2,
  #R^Alavanca: IF A > 5 [@Reforco, @Segue]
  @Reforco: ADD B ---> S1
  @Segue: ---> SX
`

/** Completa num documento montado como `DOC` + `sufixo`, cursor no fim. */
function completarBruto(sufixo: string, explicit = false) {
  const doc = DOC + sufixo
  const state = EditorState.create({ doc })
  const result = fonte(new CompletionContext(state, doc.length, explicit))
  if (result instanceof Promise) throw new Error('fonte deve ser sincrona')
  return { from: result?.from, options: result?.options ?? [] }
}

function completar(sufixo: string) {
  const { from, options } = completarBruto(sufixo)
  return { from, labels: options.map((o) => o.label) }
}

describe('autocomplete do MedState', () => {
  it('sugere as constantes do arquivo depois de um ^', () => {
    const { labels, from } = completar('  #START: ON ^')
    expect(labels).toEqual(['Alavanca', 'Luz'])
    expect(from).toBe(DOC.length + '  #START: ON ^'.length) // insere depois do sigilo
  })

  it('sugere os rótulos e ignora os metadados em comentário', () => {
    const { labels } = completar('  @')
    expect(labels).toEqual(['Reforco', 'Segue'])
    expect(labels).not.toContain('nome')
  })

  it('sugere os gatilhos depois de um #', () => {
    // `#` no meio de uma linha só acontece em combinação de eventos
    // (`#R1 ! #R2`), e ali o que cabe é o gatilho, não uma regra inteira.
    expect(completar('  #R1 ! #').labels).toEqual(['START', 'R', 'K', 'Z'])
  })

  it('sugere estados e SX depois de uma seta, sem confundir S.S.1', () => {
    const { labels } = completar('  #START: ---> ')
    expect(labels).toEqual(['S1', 'S2', 'SX'])
  })

  it('sugere comandos numa palavra solta', () => {
    const { labels, from } = completar('  #START: O')
    expect(labels).toContain('ON')
    expect(labels).toContain('LOCKOFF')
    expect(from).toBe(DOC.length + '  #START: '.length) // substitui a palavra inteira
  })

  it('não abre nada sozinho em posição vazia', () => {
    // Meio de linha, sem palavra começada: nada a sugerir.
    expect(completar('  #START: ON ^Luz; ').labels).toEqual([])
  })
})

describe('snippets', () => {
  it('dentro de um comentário oferece as anotações do editor, não rótulos de IF', () => {
    const { labels, from } = completar('S7, \\@')

    expect(labels).toContain('nome:')
    expect(labels).toContain('papel: espera')
    expect(labels).toContain('papel: reforco')
    expect(labels).toContain('papel: timeout')
    expect(labels).toContain('papel: fim')
    expect(labels).toContain('pos:')
    // O `@` do comentário não é o `@` de um rótulo de decisão.
    expect(labels).not.toContain('Reforco')
    expect(from).toBe(DOC.length + 'S7, \\@'.length) // insere depois do @
  })

  it('filtra os papéis pelo que já foi digitado', () => {
    // `validFor` deixa o CodeMirror filtrar, então a fonte devolve tudo — o que
    // importa é o `from` apontar para depois do `@` para o filtro casar.
    const { labels, from } = completar('S7, \\@pap')
    expect(labels).toContain('papel: espera')
    expect(from).toBe(DOC.length + 'S7, \\@'.length)
  })

  it('num comentário de texto livre oferece as anotações a pedido (Ctrl-Space)', () => {
    const { options } = completarBruto('\\ nota do autor ', true)
    expect(options.map((o) => o.label)).toContain('nome:')
  })

  it('no começo de uma linha oferece estruturas e regras, além dos comandos', () => {
    // Ctrl-Space numa linha em branco: tudo o que pode começar uma linha.
    const { options } = completarBruto('  ', true)
    const labels = options.map((o) => o.label)

    expect(labels).toContain('S.S.') // processo novo
    expect(labels).toContain('S') // estado novo
    expect(labels).toContain('VAR_ALIAS')
    expect(labels).toContain('#START:')
    expect(labels).toContain('IF …[@Sim, @Nao]')
    expect(labels).toContain('ON') // comandos continuam ali
  })

  it('# no começo da linha traz as regras prontas junto dos gatilhos', () => {
    const { labels, from } = completar('  #')

    expect(labels).toContain('#START:') // snippet de regra completa
    expect(labels).toContain('#R^')
    expect(labels).toContain('#START') // gatilho sozinho, com o # no rótulo
    expect(labels).toContain('#Z')
    // O `#` entra na substituição, senão o snippet escreveria `##START`.
    expect(from).toBe(DOC.length + '  '.length)
  })

  it('# no meio de uma linha continua sendo só gatilho', () => {
    const { labels } = completar('  #R1 ! #R')
    expect(labels).toEqual(['START', 'R', 'K', 'Z'])
  })

  it('digitar a primeira letra já traz o snippet junto do comando', () => {
    // Sem Ctrl-Space: o popup abre com a letra, e o CodeMirror filtra por ela.
    // `S` alcança tanto o estado novo quanto SET/SHOW/SUB.
    const labels = completar('  S').labels
    expect(labels).toContain('S.S.')
    expect(labels).toContain('SET')

    expect(completar('  I').labels).toContain('IF …[@Sim, @Nao]')
    expect(completar('  V').labels).toContain('VAR_ALIAS')
  })

  it('no meio de uma linha não oferece estrutura nem regra', () => {
    const { labels } = completar('  #START: O')

    expect(labels).toContain('ON')
    expect(labels).not.toContain('S.S.')
    expect(labels).not.toContain('#START:')
  })

  it('oferece a família def… no começo de uma linha', () => {
    const labels = completarBruto('  ', true).options.map((o) => o.label)

    expect(labels).toContain('defstate')
    expect(labels).toContain('defname')
    expect(labels).toContain('defprocess')
    expect(labels).toContain('defif')
    expect(labels).toContain('defpulse')
    expect(labels).toContain('defclock')
  })

  it('no meio de uma linha só oferece os atalhos de anotação', () => {
    // O lugar natural de um `\@nome:` é o fim do cabeçalho de um estado; uma
    // estrutura inteira ali dentro não faria sentido.
    const { labels } = completar('S9, def')

    expect(labels).toContain('defname')
    expect(labels).toContain('defpapel')
    expect(labels).toContain('defpos')
    expect(labels).not.toContain('defstate')
    expect(labels).not.toContain('defclock')
  })

  it('não repete rótulo entre os atalhos oferecidos juntos', () => {
    const labels = completarBruto('  ', true).options.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('todo atalho def… escreve código de verdade', () => {
    const defs = completarBruto('  ', true).options.filter((o) => o.label.startsWith('def'))

    // Uma dúzia de atalhos, não dois — se a lista encolher, alguém apagou
    // metade da família sem perceber.
    expect(defs.length).toBeGreaterThan(10)
    for (const def of defs) {
      expect(typeof def.apply, def.label).toBe('function')
      expect(def.detail, def.label).toBeTruthy()
    }
  })

  it('os snippets aplicam texto, não só o rótulo', () => {
    const { options } = completarBruto('  ', true)
    const processo = options.find((o) => o.label === 'S.S.')!
    // `snippetCompletion` põe um `apply` — sem ele o item inseriria só "S.S.".
    expect(typeof processo.apply).toBe('function')
  })
})
