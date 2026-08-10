import { describe, expect, it } from 'vitest'
import { MANUAL } from './manual-conteudo.ts'

/** Todo texto do manual, de qualquer tipo de bloco, com um rótulo para o erro. */
function textos(): { onde: string; texto: string }[] {
  const saida: { onde: string; texto: string }[] = []
  for (const secao of MANUAL) {
    saida.push({ onde: `${secao.id}/título`, texto: secao.titulo })
    secao.blocos.forEach((bloco, i) => {
      const onde = `${secao.id}/bloco ${i}`
      switch (bloco.kind) {
        case 'texto':
        case 'nota':
          saida.push({ onde, texto: bloco.texto })
          break
        case 'passos':
        case 'lista':
          bloco.itens.forEach((item, j) => saida.push({ onde: `${onde}[${j}]`, texto: item }))
          break
        case 'tabela':
          for (const celula of bloco.cabecalho) saida.push({ onde: `${onde}/th`, texto: celula })
          for (const linha of bloco.linhas) {
            for (const celula of linha) saida.push({ onde: `${onde}/td`, texto: celula })
          }
          break
        case 'codigo':
          break // bloco de código é literal, sem marcação
      }
    })
  }
  return saida
}

describe('conteúdo do manual', () => {
  it('tem seções com id único e nenhuma vazia', () => {
    const ids = MANUAL.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const secao of MANUAL) {
      expect(secao.blocos.length, secao.id).toBeGreaterThan(0)
      expect(secao.icone, secao.id).not.toBe('')
    }
  })

  it('fecha toda marcação de código e de negrito', () => {
    // Um backtick ou `**` sozinho apareceria cru na tela, porque `formatar`
    // divide por pares.
    for (const { onde, texto } of textos()) {
      expect((texto.match(/`/g) ?? []).length % 2, `${onde}: backtick sem par`).toBe(0)
      expect((texto.match(/\*\*/g) ?? []).length % 2, `${onde}: ** sem par`).toBe(0)
    }
  })

  it('não deixa marcação vazia nem espaço colado errado', () => {
    for (const { onde, texto } of textos()) {
      expect(texto, `${onde}: código vazio`).not.toContain('``')
      expect(texto, `${onde}: negrito vazio`).not.toContain('****')
      expect(texto.trim(), `${onde}: sobra espaço nas pontas`).toBe(texto)
    }
  })

  it('dá a toda tabela o mesmo número de colunas do cabeçalho', () => {
    for (const secao of MANUAL) {
      for (const bloco of secao.blocos) {
        if (bloco.kind !== 'tabela') continue
        expect(bloco.cabecalho.length, `${secao.id}: cabeçalho vazio`).toBeGreaterThan(0)
        for (const linha of bloco.linhas) {
          expect(linha.length, `${secao.id}: linha fora do formato`).toBe(bloco.cabecalho.length)
        }
      }
    }
  })
})
