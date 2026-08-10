import { describe, expect, it } from 'vitest'
import { evalExpression, type Ref } from './expr.ts'

function resolverDe(vars: Record<string, number[]>, consts: Record<string, number> = {}) {
  return (ref: Ref): number => {
    if (ref.type === 'constant') return consts[ref.name] ?? 0
    return vars[ref.name]?.[ref.index] ?? 0
  }
}

describe('evalExpression', () => {
  it('avalia um número simples', () => {
    expect(evalExpression('5', resolverDe({}))).toBe(5)
    expect(evalExpression('0.05', resolverDe({}))).toBe(0.05)
  })

  it('avalia menos unário', () => {
    expect(evalExpression('-987.987', resolverDe({}))).toBeCloseTo(-987.987)
  })

  it('lê uma variável simples e um elemento de array', () => {
    const r = resolverDe({ A: [7], B: [0, 0, 42] })
    expect(evalExpression('A', r)).toBe(7)
    expect(evalExpression('B(2)', r)).toBe(42)
  })

  it('lê uma constante', () => {
    expect(evalExpression('^Razao', resolverDe({}, { Razao: 5 }))).toBe(5)
  })

  it('multiplica dois operandos', () => {
    const r = resolverDe({ B: [0, 0, 0, 4], A: [0, 0, 0, 3] })
    expect(evalExpression('B(3) * A(3)', r)).toBe(12)
  })

  it('soma variável e número', () => {
    const r = resolverDe({ B: [0, 0, 100] })
    expect(evalExpression('B(2) + .6', r)).toBeCloseTo(100.6)
  })

  it('divide', () => {
    const r = resolverDe({ B: [0, 6000] })
    expect(evalExpression('B(1)/6000', r)).toBeCloseTo(1)
  })

  it('resolve índice aninhado, D(B(17))', () => {
    const r = resolverDe({ B: Array(18).fill(0).map((_, i) => (i === 17 ? 3 : 0)), D: [0, 0, 0, 99] })
    expect(evalExpression('D(B(17))', r)).toBe(99)
  })

  it('respeita precedência: * antes de +', () => {
    const r = resolverDe({})
    expect(evalExpression('2 + 3 * 4', r)).toBe(14)
  })

  it('devolve null para o que não reconhece', () => {
    expect(evalExpression('', resolverDe({}))).toBeNull()
    expect(evalExpression('RANDD B(3) = M', resolverDe({}))).toBeNull()
  })
})
