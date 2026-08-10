import { describe, expect, it } from 'vitest'
import {
  applyEdits,
  mapOffset,
  OverlappingEditsError,
  type TextEdit,
} from './edit.ts'

describe('applyEdits', () => {
  const text = 'abcdefghij'

  it('devolve o texto intacto quando não há edições', () => {
    expect(applyEdits(text, [])).toBe(text)
  })

  it('substitui um intervalo', () => {
    expect(applyEdits(text, [{ span: [2, 5], newText: 'XY' }])).toBe('abXYfghij')
  })

  it('aplica várias edições sem que uma desloque a outra', () => {
    const result = applyEdits(text, [
      { span: [7, 9], newText: 'ZZZZ' },
      { span: [0, 1], newText: '' },
      { span: [3, 4], newText: '---' },
    ])
    expect(result).toBe('bc---efgZZZZj')
  })

  it('não depende da ordem em que as edições chegam', () => {
    const edits: TextEdit[] = [
      { span: [0, 2], newText: '1' },
      { span: [5, 6], newText: '2' },
      { span: [8, 10], newText: '3' },
    ]
    expect(applyEdits(text, edits)).toBe(applyEdits(text, [...edits].reverse()))
  })

  it('aceita inserção pura no meio do texto', () => {
    expect(applyEdits(text, [{ span: [5, 5], newText: '···' }])).toBe(
      'abcde···fghij',
    )
  })

  it('recusa edições sobrepostas', () => {
    expect(() =>
      applyEdits(text, [
        { span: [2, 6], newText: 'x' },
        { span: [4, 8], newText: 'y' },
      ]),
    ).toThrow(OverlappingEditsError)
  })

  it('recusa duas inserções no mesmo ponto, cuja ordem seria arbitrária', () => {
    expect(() =>
      applyEdits(text, [
        { span: [3, 3], newText: 'a' },
        { span: [3, 3], newText: 'b' },
      ]),
    ).toThrow(OverlappingEditsError)
  })

  it('recusa edição fora dos limites do texto', () => {
    expect(() => applyEdits(text, [{ span: [8, 99], newText: '' }])).toThrow(
      RangeError,
    )
    expect(() => applyEdits(text, [{ span: [5, 2], newText: '' }])).toThrow(
      RangeError,
    )
  })

  it('permite inserir exatamente onde termina outra edição', () => {
    expect(
      applyEdits(text, [
        { span: [2, 4], newText: 'XY' },
        { span: [4, 4], newText: '|' },
      ]),
    ).toBe('abXY|efghij')
  })
})

describe('mapOffset', () => {
  it('desloca offsets que vêm depois das edições', () => {
    const edits: TextEdit[] = [{ span: [2, 5], newText: 'XY' }]
    expect(mapOffset(0, edits)).toBe(0)
    expect(mapOffset(8, edits)).toBe(7)
  })

  it('não move offsets anteriores à edição', () => {
    expect(mapOffset(1, [{ span: [4, 4], newText: 'longo' }])).toBe(1)
  })
})
