import { useEffect, useRef, useState } from 'react'
import type { ManualBloco, ManualSecao } from './manual-conteudo.ts'
import { irPara } from './rota.ts'
import './Manual.css'

export interface ManualProps {
  /** Vai no `<h1>` e no título da aba. */
  readonly titulo: string
  readonly secoes: readonly ManualSecao[]
}

/**
 * Página de documentação: sumário à esquerda, texto à direita. É uma
 * **página** com rota própria (`#/manual`, `#/linguagem`), não um modal — tem
 * URL, entra no histórico, sobrevive a um recarregar e não fecha por clique
 * acidental fora.
 *
 * O editor continua montado por trás: navegar para cá e voltar não remonta o
 * canvas nem o editor de código, e portanto não corre o risco de perder uma
 * edição que o autosave ainda não gravou.
 *
 * O conteúdo mora em `manual-conteudo.ts` e `linguagem-conteudo.ts`; aqui só a
 * apresentação — um componente para as duas páginas, porque o que muda entre
 * elas é o texto, não o comportamento.
 */
export function Manual({ titulo, secoes }: ManualProps) {
  const [ativa, setAtiva] = useState(secoes[0]!.id)
  const corpoRef = useRef<HTMLDivElement>(null)
  const secaoRefs = useRef<Record<string, HTMLElement | null>>({})

  // Título da aba enquanto a página está aberta — é o que faz um marcador de
  // favoritos e o histórico do navegador dizerem o que é.
  useEffect(() => {
    const anterior = document.title
    document.title = `${titulo} · RatFlow`
    return () => {
      document.title = anterior
    }
  }, [titulo])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') irPara('editor')
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  // Marca no sumário a seção que está sendo lida. `IntersectionObserver` em vez
  // de `scroll` porque não precisa de cálculo de posição nenhum.
  useEffect(() => {
    const alvos = Object.values(secaoRefs.current).filter((el): el is HTMLElement => el !== null)
    const observer = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting)
        if (visivel) setAtiva(visivel.target.id)
      },
      { root: corpoRef.current, rootMargin: '-10% 0px -80% 0px' },
    )
    for (const alvo of alvos) observer.observe(alvo)
    return () => observer.disconnect()
  }, [secoes])

  return (
    <div className="manual-page">
      <div className="manual-shell">
        <header className="manual-header">
          <a
            className="manual-voltar"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              irPara('editor')
            }}
          >
            ← Voltar ao editor
          </a>
          <h1>{titulo}</h1>
        </header>

        <div className="manual-corpo">
          <nav className="manual-sumario" aria-label="Seções desta página">
            {secoes.map((secao) => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                className={`manual-sumario-item${secao.id === ativa ? ' manual-sumario-item--ativa' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  secaoRefs.current[secao.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {secao.icone && <span aria-hidden="true">{secao.icone}</span>}
                {secao.titulo}
              </a>
            ))}
          </nav>

          <article className="manual-texto" ref={corpoRef}>
            {secoes.map((secao) => (
              <section
                key={secao.id}
                id={secao.id}
                ref={(el) => {
                  secaoRefs.current[secao.id] = el
                }}
              >
                <h3>
                  {secao.icone && <span aria-hidden="true">{secao.icone} </span>}
                  {secao.titulo}
                </h3>
                {secao.blocos.map((bloco, i) => (
                  <Bloco key={i} bloco={bloco} />
                ))}
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  )
}

function Bloco({ bloco }: { bloco: ManualBloco }) {
  switch (bloco.kind) {
    case 'texto':
      return <p>{formatar(bloco.texto)}</p>
    case 'passos':
      return (
        <ol>
          {bloco.itens.map((item, i) => (
            <li key={i}>{formatar(item)}</li>
          ))}
        </ol>
      )
    case 'lista':
      return (
        <ul>
          {bloco.itens.map((item, i) => (
            <li key={i}>{formatar(item)}</li>
          ))}
        </ul>
      )
    case 'tabela':
      return (
        <div className="manual-tabela-rolagem">
          <table>
            <thead>
              <tr>
                {bloco.cabecalho.map((celula) => (
                  <th key={celula}>{formatar(celula)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, i) => (
                <tr key={i}>
                  {linha.map((celula, j) => (
                    <td key={j}>{formatar(celula)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'codigo':
      return <pre className="manual-codigo">{bloco.texto}</pre>
    case 'nota':
      return <p className="manual-nota">{formatar(bloco.texto)}</p>
  }
}

/**
 * Duas marcações e nada mais: `código` e **negrito**. Um parser de markdown
 * completo seria muito mais código do que o texto precisa — e este é o único
 * lugar que consome esta convenção.
 */
function formatar(texto: string) {
  return texto.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((parte, i) => {
    if (parte.startsWith('`') && parte.endsWith('`')) {
      return <code key={i}>{parte.slice(1, -1)}</code>
    }
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>
    }
    return parte
  })
}
