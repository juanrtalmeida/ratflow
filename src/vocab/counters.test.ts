import { describe, expect, it } from 'vitest'
import { loadFixtures } from '../core/__fixtures.ts'
import { parseProgram } from '../core/parser.ts'
import { suggestCounters } from './counters.ts'

const fixtures = loadFixtures()

function contadores(text: string) {
  return suggestCounters(parseProgram(text))
}

describe('suggestCounters', () => {
  it('lê o nome de cada posição de array documentada em comentário', () => {
    const autoshaping = fixtures.find((f) => f.name === 'autoshaping-real.MPC')!
    const lista = contadores(autoshaping.text)

    const b5 = lista.find((c) => c.operando === 'B(5)')!
    expect(b5.nome).toBe('LEFTLEVER RESPONSES')
    expect(b5.variable).toBe('B')
    expect(b5.index).toBe(5)

    expect(lista.find((c) => c.operando === 'B(9)')?.nome).toBe('REINFORCERS LEFT')
    expect(lista.find((c) => c.operando === 'A(8)')?.nome).toBe(
      'MAX NUMBER OF REINFORCERS PER SESSION',
    )
  })

  it('marca quem o programa escreve, separando de quem ele só lê', () => {
    const autoshaping = fixtures.find((f) => f.name === 'autoshaping-real.MPC')!
    const lista = contadores(autoshaping.text)

    // `A(8)` é parâmetro da caixa de diálogo: o programa compara, nunca escreve.
    expect(lista.find((c) => c.operando === 'A(8)')?.escrito).toBe(false)
    // `B(17)` é índice do array de tempo real, incrementado a cada registro.
    expect(lista.find((c) => c.operando === 'B(17)')?.escrito).toBe(true)
  })

  it('usa o apelido do VAR_ALIAS para a variável inteira', () => {
    const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!
    const lista = contadores(fr5.text)

    expect(lista.find((c) => c.operando === 'A')?.nome).toBe('Respostas')
    expect(lista.find((c) => c.operando === 'B')?.nome).toBe('Reforcos')
  })

  it('índice não literal conta para a variável, não para uma posição inventada', () => {
    // `SET D(B(17)) = …`: a posição depende de outra variável em tempo de
    // execução, então o que se sabe é que `D` é usado — não `D(alguma coisa)`.
    //
    // O `B(17)` de dentro não entra: o parser guarda índice aninhado como texto
    // cru, não como operando (ver GRAMMAR.md §5.1). Nos arquivos reais isso não
    // esconde nada, porque um índice é sempre incrementado em algum `ADD` à
    // parte — que é onde ele é detectado.
    const text = 'S.S.1,\nS1,\n  #START: SET D(B(17)) = 1; ADD B(17) ---> SX\n'
    const lista = contadores(text)

    expect(lista.map((c) => c.operando)).toContain('D')
    expect(lista.some((c) => c.variable === 'D' && c.index !== null)).toBe(false)
    expect(lista.find((c) => c.operando === 'B(17)')?.escrito).toBe(true)
  })

  it('não confunde outras linhas de comentário com definição de contador', () => {
    const text =
      '\\ .1 = LEFT RESPONSES\n' +
      '\\ SHOW 1, READY, B(0)\n' +
      '\\    1 = MAGAZINE TRAINING\n' +
      '\\ B(4) = VT DIPPERS\n' +
      'S.S.1,\nS1,\n  #START: ---> SX\n'
    const lista = contadores(text)

    expect(lista.map((c) => c.operando)).toEqual(['B(4)'])
    expect(lista[0]!.nome).toBe('VT DIPPERS')
    expect(lista[0]!.usado).toBe(false)
  })

  it.each(fixtures)('$name: encontra contadores sem inventar nome', ({ text }) => {
    for (const counter of contadores(text)) {
      expect(counter.operando).toMatch(/^[A-Z](\(\d+\))?$/)
      if (counter.nome !== null) expect(counter.nome.trim()).toBe(counter.nome)
    }
  })
})
