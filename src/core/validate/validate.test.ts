import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parser.ts'
import { buildIndex, validate, worstSeverity } from './index.ts'
import { loadFixtures } from '../__fixtures.ts'

const fixtures = loadFixtures()

/** Códigos dos diagnósticos de um trecho de programa. */
function codes(text: string, dialect?: 'IV' | 'V'): string[] {
  return validate(parseProgram(text), { dialect }).map((d) => d.code)
}

function programaMinimo(corpo: string, preambulo = ''): string {
  return `${preambulo}\nS.S.1,\n${corpo}\n`
}

describe('regras estruturais', () => {
  it('acusa seta para estado inexistente', () => {
    const bom = programaMinimo('S1,\n  #START: ---> S2\nS2,\n  5": ---> S1')
    const ruim = programaMinimo('S1,\n  #START: ---> S9\nS2,\n  5": ---> S1')
    expect(codes(bom)).not.toContain('alvo-inexistente')
    expect(codes(ruim)).toContain('alvo-inexistente')
  })

  it('explica o alvo inexistente em linguagem simples', () => {
    const [erro] = validate(
      parseProgram(programaMinimo('S1,\n  #START: ---> S9')),
    ).filter((d) => d.code === 'alvo-inexistente')
    expect(erro!.plain).toContain('S9')
    expect(erro!.why).toContain('trava')
    expect(erro!.fix).toBeTruthy()
  })

  it('acusa estado que nada alcança', () => {
    const bom = programaMinimo('S1,\n  #START: ---> S2\nS2,\n  5": ---> S1')
    const ruim = programaMinimo(
      'S1,\n  #START: ---> S1\nS2,\n  5": ---> S1\nS3,\n  5": ---> S1',
    )
    expect(codes(bom)).not.toContain('estado-inalcancavel')
    expect(codes(ruim)).toContain('estado-inalcancavel')
  })

  it('acusa processo que nunca começa', () => {
    const bom = programaMinimo('S1,\n  #START: ---> S2\nS2,\n  5": ---> S1')
    const ruim = programaMinimo('S1,\n  5": ---> S2\nS2,\n  5": ---> S1')
    expect(codes(bom)).not.toContain('processo-sem-start')
    expect(codes(ruim)).toContain('processo-sem-start')
  })

  it('acusa estado sem saída, inclusive quando só volta para si mesmo', () => {
    const semSaida = programaMinimo('S1,\n  #START: ---> S2\nS2,\n  5": ---> SX')
    expect(codes(semSaida)).toContain('estado-sem-saida')

    const ficaEmSi = programaMinimo('S1,\n  #START: ---> S2\nS2,\n  5": ---> S2')
    expect(codes(ficaEmSi)).toContain('estado-sem-saida')
  })

  it('acusa decisão que aponta para caminho não escrito', () => {
    const bom = programaMinimo(
      'S1,\n  #START: IF A >= 5 [@Sim, @Nao]\n       @Sim: ---> S2\n       @Nao: ---> SX\nS2,\n  5": ---> S1',
    )
    const ruim = programaMinimo(
      'S1,\n  #START: IF A >= 5 [@Sim, @Nao]\n       @Sim: ---> S2\nS2,\n  5": ---> S1',
    )
    expect(codes(bom)).not.toContain('rotulo-inexistente')
    expect(codes(ruim)).toContain('rotulo-inexistente')
  })

  it('acusa caminho escrito que nenhuma decisão usa', () => {
    const ruim = programaMinimo(
      'S1,\n  #START: ---> S2\n       @Sobrando: ---> S2\nS2,\n  5": ---> S1',
    )
    expect(codes(ruim)).toContain('rotulo-sem-uso')
  })
})

describe('regras de dados', () => {
  it('acusa array usado sem DIM', () => {
    const bom = programaMinimo(
      'S1,\n  #START: SET C(1) = 5 ---> S2\nS2,\n  5": ---> S1',
      'DIM C = 100\n',
    )
    const ruim = programaMinimo(
      'S1,\n  #START: SET C(1) = 5 ---> S2\nS2,\n  5": ---> S1',
    )
    expect(codes(bom)).not.toContain('array-sem-dim')
    expect(codes(ruim)).toContain('array-sem-dim')
  })

  it('acusa índice além do tamanho declarado', () => {
    const ruim = programaMinimo(
      'S1,\n  #START: SET C(500) = 5 ---> S2\nS2,\n  5": ---> S1',
      'DIM C = 100\n',
    )
    expect(codes(ruim)).toContain('indice-fora-do-dim')
  })

  it('acusa constante usada sem definição, no comando e no gatilho', () => {
    const bom = programaMinimo(
      'S1,\n  #R^Alavanca: ON ^Luz ---> S2\nS2,\n  5": ---> S1',
      '^Alavanca = 1\n^Luz = 4\n',
    )
    expect(codes(bom)).not.toContain('constante-indefinida')

    const semLuz = programaMinimo(
      'S1,\n  #R^Alavanca: ON ^Luz ---> S2\nS2,\n  5": ---> S1',
      '^Alavanca = 1\n',
    )
    expect(codes(semLuz)).toContain('constante-indefinida')

    const semAlavanca = programaMinimo(
      'S1,\n  #R^Alavanca: ---> S2\nS2,\n  5": ---> S1',
    )
    expect(codes(semAlavanca)).toContain('constante-indefinida')
  })

  it('avisa quando uma variável de disco nunca recebe valor', () => {
    const escrita = programaMinimo(
      'S1,\n  #START: ADD A ---> S2\nS2,\n  5": ---> S1',
      'DISKVARS = A\n',
    )
    const vazia = programaMinimo(
      'S1,\n  #START: ADD A ---> S2\nS2,\n  5": ---> S1',
      'DISKVARS = A, B\n',
    )
    expect(codes(escrita)).not.toContain('diskvar-nunca-escrita')
    expect(codes(vazia)).toContain('diskvar-nunca-escrita')
  })

  it('resolve apelidos ao checar as variáveis de disco', () => {
    const comApelido = programaMinimo(
      'S1,\n  #START: ADD A ---> S2\nS2,\n  5": ---> S1',
      'VAR_ALIAS\n  Respostas = A\nEND\nDISKVARS = Respostas\n',
    )
    expect(codes(comApelido)).not.toContain('diskvar-nunca-escrita')
  })
})

describe('regras de hardware', () => {
  it('avisa sobre porta ligada e nunca desligada', () => {
    const bom = programaMinimo(
      'S1,\n  #START: ON ^Luz ---> S2\nS2,\n  5": OFF ^Luz ---> S1',
      '^Luz = 4\n',
    )
    const ruim = programaMinimo(
      'S1,\n  #START: ON ^Luz ---> S2\nS2,\n  5": ---> S1',
      '^Luz = 4\n',
    )
    expect(codes(bom)).not.toContain('porta-nunca-desligada')
    expect(codes(ruim)).toContain('porta-nunca-desligada')
  })

  it('avisa quando dois processos comandam a mesma porta', () => {
    const texto = [
      '^Luz = 4',
      'S.S.1,',
      'S1,',
      '  #START: ON ^Luz ---> S2',
      'S2,',
      '  5": ---> S1',
      'S.S.2,',
      'S1,',
      '  #START: OFF ^Luz ---> S2',
      'S2,',
      '  5": ---> S1',
    ].join('\n')
    expect(codes(texto)).toContain('porta-em-dois-processos')
  })
})

describe('regras de dialeto', () => {
  const comDiskColumns = programaMinimo(
    'S1,\n  #START: ---> S2\nS2,\n  5": ---> S1',
    'DISKCOLUMNS = A, B\n',
  )

  it('aceita DISKCOLUMNS no MED-PC V e recusa no IV', () => {
    expect(codes(comDiskColumns, 'V')).not.toContain('diretiva-nao-suportada')
    expect(codes(comDiskColumns, 'IV')).toContain('diretiva-nao-suportada')
  })

  it('acusa sinal Z fora do intervalo', () => {
    const bom = programaMinimo('S1,\n  #START: Z1 ---> S2\nS2,\n  5": ---> S1')
    const ruim = programaMinimo('S1,\n  #START: Z99 ---> S2\nS2,\n  5": ---> S1')
    expect(codes(bom)).not.toContain('sinal-fora-do-limite')
    expect(codes(ruim)).toContain('sinal-fora-do-limite')
  })

  it('avisa sobre nome de constante longo demais para o MED-PC IV', () => {
    const nomeLongo = programaMinimo(
      'S1,\n  #START: ---> S2\nS2,\n  5": ---> S1',
      '^ConstanteComNomeExageradamenteLongo = 1\n',
    )
    expect(codes(nomeLongo, 'IV')).toContain('identificador-longo')
    expect(codes(nomeLongo, 'V')).toContain('identificador-longo')

    const nomeCurto = programaMinimo(
      'S1,\n  #START: ---> S2\nS2,\n  5": ---> S1',
      '^Luz = 1\n',
    )
    expect(codes(nomeCurto, 'IV')).not.toContain('identificador-longo')
  })
})

describe('buildIndex', () => {
  it('resolve constantes, dims, listas e apelidos nas duas direções', () => {
    const program = parseProgram(
      fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!.text,
    )
    const index = buildIndex(program)

    expect(index.constants.get('Razao')?.value).toBe('5')
    expect(index.dims.get('C')).toBe(2000)
    expect(index.lists.has('D')).toBe(true)
    expect(index.aliases.get('Respostas')).toBe('A')
    expect(index.aliasOf.get('A')).toBe('Respostas')
    expect(index.diskVars).toEqual(['A', 'B', 'C'])
    expect(index.written).toEqual(new Set(['A', 'B']))
  })
})

describe('sobre as fixtures', () => {
  const sinteticas = fixtures.filter((f) => !f.name.includes('real'))
  it.each(sinteticas)('$name: nenhum erro de sintaxe', ({ text }) => {
    const erros = validate(parseProgram(text)).filter((d) => d.severity === 'error')
    expect(erros).toEqual([])
  })

  // Os `-real.MPC` são arquivos de laboratório de verdade, com bugs de
  // verdade — um rótulo com erro de digitação, um alvo que ficou de um
  // copiar-e-colar. O validador acusar isso é o comportamento CORRETO, não um
  // defeito do parser. A lista abaixo documenta o que já foi conferido à mão
  // em cada arquivo, para que uma mudança futura que altere essa lista seja
  // examinada — em vez de silenciosamente aceita ou silenciosamente barrada.
  const errosConhecidos: Record<string, readonly string[]> = {
    'autoshaping-real.MPC': [
      'processo-sem-start', // S.S.1 (BOX TEST) não tem #START — depende de ser o primeiro processo
      'rotulo-inexistente', // @DURRINGREINFORCEMENT no IF, mas o segmento definido é @DURINGREINFORCEMENT
      'rotulo-inexistente',
    ],
    'demanda-razao-progressiva-real.MPC': [
      'processo-sem-start',
      'rotulo-inexistente',
      'rotulo-inexistente',
    ],
    'dmc-pilot-real.MPC': [
      'processo-sem-start',
      'rotulo-inexistente', // @COMPONENT1 no IF, segmento definido é @COMP1
      'rotulo-inexistente', // @COMPONENT 4/5 (com espaço) não batem com @COMPONENT4/5 do IF — 4 ocorrências
      'rotulo-inexistente',
      'rotulo-inexistente',
      'rotulo-inexistente',
      'rotulo-inexistente',
      'alvo-inexistente', // ---> S11 num S.S. que só vai até S5 — sobra de copiar-e-colar
    ],
    'razao-progressiva-teste-real.MPC': [
      'processo-sem-start',
      'rotulo-inexistente',
      'rotulo-inexistente',
    ],
  }

  const reais = fixtures.filter((f) => f.name.includes('real'))
  it.each(reais)('$name: só os erros já conferidos no arquivo original', ({ name, text }) => {
    const erros = validate(parseProgram(text))
      .filter((d) => d.severity === 'error')
      .map((d) => d.code)
      .sort()
    expect(erros).toEqual([...errosConhecidos[name]!].sort())
  })

  it('encontra no FR5 os achados que esperamos de um protocolo real', () => {
    const program = parseProgram(
      fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!.text,
    )
    const found = validate(program).map((d) => d.code)

    // C está no DISKVARS mas o protocolo nunca grava nada nela.
    expect(found).toContain('diskvar-nunca-escrita')
    // A luz da casa é ligada pela Tarefa e desligada pela Sessão.
    expect(found).toContain('porta-em-dois-processos')
    // O estado final «Fim» não leva a lugar nenhum — de propósito.
    expect(found).toContain('estado-sem-saida')
  })

  it('ordena os diagnósticos pela posição no arquivo', () => {
    const program = parseProgram(
      fixtures.find((f) => f.name === 'vi30-legado.MPC')!.text,
    )
    const posicoes = validate(program).map((d) => d.span[0])
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
  })
})

describe('worstSeverity', () => {
  it('escolhe a severidade mais grave da lista', () => {
    const base = { span: [0, 1] as const, code: 'x', plain: 'x' }
    expect(worstSeverity([])).toBeNull()
    expect(worstSeverity([{ ...base, severity: 'info' }])).toBe('info')
    expect(
      worstSeverity([
        { ...base, severity: 'warning' },
        { ...base, severity: 'error' },
      ]),
    ).toBe('error')
  })
})
