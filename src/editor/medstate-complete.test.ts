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
function completar(sufixo: string) {
  const doc = DOC + sufixo
  const state = EditorState.create({ doc })
  const result = fonte(new CompletionContext(state, doc.length, false))
  if (result instanceof Promise) throw new Error('fonte deve ser sincrona')
  return {
    from: result?.from,
    labels: (result?.options ?? []).map((o) => o.label),
  }
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
    expect(completar('  #').labels).toEqual(['START', 'R', 'K', 'Z'])
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
    expect(completar('  ').labels).toEqual([])
  })
})
