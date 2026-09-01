import { describe, expect, it } from 'vitest'
import { GLOSSARIO } from './glossario-conteudo.ts'
import { SECOES } from './guias.ts'
import { buscar, faixasQueCasam, normalizar, realcar } from './manual-busca.ts'
import { GUIAS } from './rota.ts'

describe('normalizar', () => {
  it('tira acento e caixa sem mudar o comprimento', () => {
    const original = 'Ação PADRÃO — três'
    const normal = normalizar(original)
    expect(normal).toBe('acao padrao — tres')
    // É o que garante que o índice achado no texto normalizado recorta o
    // trecho no lugar certo do texto original.
    expect(normal).toHaveLength(original.length)
  })
})

describe('buscar', () => {
  it('não devolve nada para consulta vazia', () => {
    expect(buscar('   ')).toEqual([])
  })

  it('acha ignorando acento e caixa', () => {
    const semAcento = buscar('secao')
    const comAcento = buscar('SEÇÃO')
    expect(semAcento.length).toBeGreaterThan(0)
    expect(comAcento.map((r) => r.secaoId)).toEqual(semAcento.map((r) => r.secaoId))
  })

  it('exige todos os termos na mesma seção', () => {
    const resultados = buscar('zzz nao existe mesmo')
    expect(resultados).toEqual([])
  })

  it('atravessa os guias — um termo só do glossário aparece', () => {
    const termo = GLOSSARIO[0]!.titulo
    const achado = buscar(termo).find((r) => r.secaoId === GLOSSARIO[0]!.id)
    expect(achado?.rota).toBe('glossario')
  })

  it('põe o casamento no título na frente', () => {
    const [primeiro] = buscar('atalhos')
    expect(normalizar(primeiro?.titulo ?? '')).toContain('atalho')
  })

  it('devolve um trecho que contém o termo procurado', () => {
    const [primeiro] = buscar('MED-PC')
    expect(primeiro).toBeDefined()
    expect(normalizar(primeiro!.trecho)).toContain('med-pc')
  })

  it.each(GUIAS.map((g) => g.rota))('acha uma seção do guia %s', (rota) => {
    // Um guia novo que entre em `GUIAS` sem texto — ou sem entrar em `SECOES`
    // — não aparece na busca, e é aqui que isso é pego.
    const alvo = SECOES[rota][0]
    expect(alvo, `${rota} está sem seções`).toBeDefined()
    const achado = buscar(alvo!.titulo, 50).find((r) => r.secaoId === alvo!.id)
    expect(achado?.rota).toBe(rota)
  })

  it('respeita o limite', () => {
    expect(buscar('a', 3)).toHaveLength(3)
  })
})

describe('faixasQueCasam', () => {
  it('devolve as faixas em ordem', () => {
    expect(faixasQueCasam('abc abc', 'abc')).toEqual([
      [0, 3],
      [4, 7],
    ])
  })

  it('funde termos que se encavalam numa faixa só', () => {
    expect(faixasQueCasam('contador', 'cont contador')).toEqual([[0, 8]])
  })

  it('não devolve nada para consulta vazia', () => {
    expect(faixasQueCasam('qualquer texto', '  ')).toEqual([])
  })

  it('casa por índice do texto original, mesmo com acento', () => {
    const texto = 'A ação começa'
    const [faixa] = faixasQueCasam(texto, 'acao')
    expect(faixa).toBeDefined()
    expect(texto.slice(faixa![0], faixa![1])).toBe('ação')
  })
})

describe('realcar', () => {
  it('marca as ocorrências e preserva o texto inteiro', () => {
    const partes = realcar('Estado é ESTADO e estado', 'estado')
    expect(partes.map((p) => p.texto).join('')).toBe('Estado é ESTADO e estado')
    expect(partes.filter((p) => p.marca).map((p) => p.texto)).toEqual([
      'Estado',
      'ESTADO',
      'estado',
    ])
  })

  it('não marca nada quando não há consulta', () => {
    expect(realcar('texto qualquer', '')).toEqual([{ texto: 'texto qualquer', marca: false }])
  })

  it('não duplica texto quando dois termos se sobrepõem', () => {
    const partes = realcar('contador', 'cont contador')
    expect(partes.map((p) => p.texto).join('')).toBe('contador')
  })
})
