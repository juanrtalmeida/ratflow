import { useEffect, useMemo, useRef, useState } from 'react'
import type { ManualBloco, ManualSecao } from './manual-conteudo.ts'
import { GUIAS, type Guia, irPara } from './rota.ts'
import './Manual.css'

export interface ManualProps {
  readonly guia: Guia
  readonly secoes: readonly ManualSecao[]
}

/**
 * Página de documentação: abas de guia e sumário à esquerda, texto à direita.
 * É uma **página** com rota própria (`#/manual`, `#/linguagem`), não um modal
 * — tem URL, entra no histórico, sobrevive a um recarregar e não fecha por
 * clique acidental fora.
 *
 * O editor continua montado por trás: navegar para cá e voltar não remonta o
 * canvas nem o editor de código, e portanto não corre o risco de perder uma
 * edição que o autosave ainda não gravou.
 *
 * Os três guias vivem na mesma casca e trocam sem sair da página: abas no topo,
 * atalhos `1`–`3`, e um rodapé que leva ao próximo. O conteúdo mora em
 * `manual-conteudo.ts`, `linguagem-conteudo.ts` e `glossario-conteudo.ts`;
 * aqui só a apresentação — um componente para os três, porque o que muda entre
 * eles é o texto, não o comportamento.
 */
export function Manual({ guia, secoes }: ManualProps) {
  const [ativa, setAtiva] = useState(secoes[0]!.id)
  const corpoRef = useRef<HTMLDivElement>(null)
  const secaoRefs = useRef<Record<string, HTMLElement | null>>({})

  const indiceAtiva = Math.max(
    0,
    secoes.findIndex((s) => s.id === ativa),
  )
  const proximo = useMemo(() => {
    const i = GUIAS.findIndex((g) => g.rota === guia.rota)
    return GUIAS[(i + 1) % GUIAS.length]!
  }, [guia])

  // Título da aba enquanto a página está aberta — é o que faz um marcador de
  // favoritos e o histórico do navegador dizerem o que é.
  useEffect(() => {
    const anterior = document.title
    document.title = `${guia.titulo} · RatFlow`
    return () => {
      document.title = anterior
    }
  }, [guia])

  // Esc volta ao editor; 1–3 trocam de guia sem tirar a mão do teclado. Só
  // quando o foco não está num campo de texto, senão engoliria a digitação.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName ?? '')) return
      if (e.key === 'Escape') return irPara('editor')
      const n = Number(e.key)
      if (n >= 1 && n <= GUIAS.length) irPara(GUIAS[n - 1]!.rota)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  // Marca no sumário a seção que está sendo lida. `IntersectionObserver` em vez
  // de `scroll` porque não precisa de cálculo de posição nenhum; entre várias
  // visíveis ao mesmo tempo, vale a mais alta na tela.
  useEffect(() => {
    const alvos = Object.values(secaoRefs.current).filter((el): el is HTMLElement => el !== null)
    const observer = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visiveis[0]) setAtiva(visiveis[0].target.id)
      },
      { root: corpoRef.current, rootMargin: '-12% 0px -78% 0px' },
    )
    for (const alvo of alvos) observer.observe(alvo)
    return () => observer.disconnect()
  }, [secoes])

  return (
    <div className="manual-page">
      <div className="manual-shell">
        <header className="manual-header">
          <button className="manual-voltar" type="button" onClick={() => irPara('editor')}>
            <span aria-hidden="true">←</span> Editor
            <kbd>Esc</kbd>
          </button>

          <nav className="manual-abas" aria-label="Guias">
            {GUIAS.map((g, i) => (
              <a
                key={g.rota}
                href={`#/${g.rota}`}
                className={`manual-aba${g.rota === guia.rota ? ' manual-aba--ativa' : ''}`}
                aria-current={g.rota === guia.rota ? 'page' : undefined}
                title={`${g.titulo} — atalho ${i + 1}`}
              >
                <span aria-hidden="true">{g.icone}</span>
                {g.rotulo}
              </a>
            ))}
          </nav>
        </header>

        <div className="manual-titulo">
          <h1>{guia.titulo}</h1>
          <p>{guia.descricao}</p>
        </div>

        <div className="manual-corpo">
          <nav className="manual-sumario" aria-label="Seções desta página">
            <div className="manual-sumario-topo">
              <span>Nesta página</span>
              <span className="manual-sumario-contagem">
                {indiceAtiva + 1}/{secoes.length}
              </span>
            </div>
            {secoes.map((secao, i) => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                className={`manual-sumario-item${secao.id === ativa ? ' manual-sumario-item--ativa' : ''}`}
                aria-current={secao.id === ativa ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  setAtiva(secao.id)
                  secaoRefs.current[secao.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <span className="manual-sumario-num" aria-hidden="true">
                  {secao.icone ?? String(i + 1).padStart(2, '0')}
                </span>
                <span className="manual-sumario-rotulo">{secao.titulo}</span>
              </a>
            ))}
          </nav>

          <article className="manual-texto" ref={corpoRef}>
            {secoes.map((secao, i) => (
              <section
                key={secao.id}
                id={secao.id}
                ref={(el) => {
                  secaoRefs.current[secao.id] = el
                }}
              >
                <p className="manual-secao-marca">
                  {secao.icone && <span aria-hidden="true">{secao.icone}</span>}
                  {guia.rotulo} · {String(i + 1).padStart(2, '0')} de{' '}
                  {String(secoes.length).padStart(2, '0')}
                </p>
                <h2>{secao.titulo}</h2>
                {secao.blocos.map((bloco, j) => (
                  <Bloco key={j} bloco={bloco} />
                ))}
              </section>
            ))}

            <a className="manual-proximo" href={`#/${proximo.rota}`}>
              <span className="manual-proximo-rotulo">Próximo guia</span>
              <span className="manual-proximo-titulo">
                <span aria-hidden="true">{proximo.icone}</span> {proximo.titulo}
                <span aria-hidden="true"> →</span>
              </span>
            </a>
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
      return (
        <p className="manual-nota">
          <span aria-hidden="true">⚠</span>
          <span>{formatar(bloco.texto)}</span>
        </p>
      )
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
