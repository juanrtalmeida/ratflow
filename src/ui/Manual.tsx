import { useEffect, useMemo, useRef, useState } from 'react'
import { buscar, faixasQueCasam, realcar, type ResultadoBusca } from './manual-busca.ts'
import type { ManualBloco, ManualSecao } from './manual-conteudo.ts'
import { GUIAS, type Guia, irPara } from './rota.ts'
import './Manual.css'

export interface ManualProps {
  readonly guia: Guia
  readonly secoes: readonly ManualSecao[]
  /** Seção pedida pela URL (`#/manual/atalhos`): rola até ela ao abrir. */
  readonly secaoAlvo?: string
  /** Termo buscado, também vindo da URL: fica destacado no texto. */
  readonly termoAlvo?: string
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
 * Os guias vivem na mesma casca e trocam sem sair da página: abas no topo,
 * atalhos numéricos, e um rodapé que leva ao próximo. O conteúdo de cada um
 * mora no seu `*-conteudo.ts` e a lista está em `GUIAS` (`rota.ts`); aqui só a
 * apresentação — um componente para todos, porque o que muda entre eles é o
 * texto, não o comportamento.
 *
 * A busca do cabeçalho atravessa todos os guias de uma vez (`manual-busca.ts`)
 * e leva direto à seção, porque quem procura uma resposta não sabe em qual
 * deles ela está.
 */
export function Manual({ guia, secoes, secaoAlvo, termoAlvo }: ManualProps) {
  const [ativa, setAtiva] = useState(secaoAlvo ?? secoes[0]!.id)
  const corpoRef = useRef<HTMLDivElement>(null)
  const secaoRefs = useRef<Record<string, HTMLElement | null>>({})
  const buscaRef = useRef<HTMLInputElement>(null)

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

  // Esc volta ao editor; os números trocam de guia e `/` cai na busca, sem
  // tirar a mão do teclado. Só quando o foco não está num campo de texto,
  // senão engoliria a digitação.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        buscaRef.current?.focus()
        buscaRef.current?.select()
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo?.tagName ?? '')) return
      if (e.key === '/') {
        e.preventDefault()
        return buscaRef.current?.focus()
      }
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

  // A seção que veio na URL. Roda no primeiro render (link colado, recarregar)
  // e de novo quando um resultado de busca aponta para outra seção do mesmo
  // guia — aí o componente não remonta, só o `hash` muda.
  useEffect(() => {
    if (!secaoAlvo) return
    const alvo = secaoRefs.current[secaoAlvo]
    if (!alvo) return
    setAtiva(secaoAlvo)
    alvo.scrollIntoView({ block: 'start' })
  }, [secaoAlvo])

  // Destaca no texto inteiro o termo que trouxe a pessoa até aqui. Chegar na
  // seção certa ainda deixa uma tela de texto para varrer com o olho; o
  // destaque diz em qual parágrafo está a palavra.
  useEffect(() => {
    if (!termoAlvo) return
    return realcarNaPagina(corpoRef.current, termoAlvo)
  }, [termoAlvo, secoes])

  return (
    <div className="manual-page">
      <div className="manual-shell">
        <header className="manual-header">
          <button className="manual-voltar" type="button" onClick={() => irPara('editor')}>
            <span aria-hidden="true">←</span> Editor
            <kbd>Esc</kbd>
          </button>

          <Busca inputRef={buscaRef} />

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
                  // Escolher uma seção à mão encerra a busca anterior — o
                  // destaque de um termo que já não se procura vira ruído.
                  limparRealce()
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

/** Nome do realce no registro do navegador; casa com `::highlight()` no CSS. */
const REALCE = 'manual-realce'

/**
 * Pinta o termo buscado em toda a página, via **CSS Custom Highlight API**:
 * `Range`s registrados em `CSS.highlights` e estilizados por
 * `::highlight(manual-realce)`.
 *
 * Sem tocar no DOM — é o que permite destacar sem passar a consulta por todos
 * os blocos e sem envolver texto em `<mark>`, que quebraria a formatação de
 * `formatar()` e faria a página inteira renderizar de novo a cada busca.
 *
 * Devolve a função que apaga o realce, para o `useEffect` usar na limpeza. Em
 * navegador sem a API, não faz nada: o resultado da busca já levou a pessoa à
 * seção certa, o destaque é o adicional.
 */
function realcarNaPagina(raiz: HTMLElement | null, termo: string): () => void {
  if (!raiz || typeof Highlight === 'undefined') return () => {}

  const faixas: Range[] = []
  const passeio = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  for (let no = passeio.nextNode(); no; no = passeio.nextNode()) {
    for (const [ini, fim] of faixasQueCasam(no.nodeValue ?? '', termo)) {
      const faixa = document.createRange()
      faixa.setStart(no, ini)
      faixa.setEnd(no, fim)
      faixas.push(faixa)
    }
  }
  if (faixas.length > 0) CSS.highlights.set(REALCE, new Highlight(...faixas))
  return limparRealce
}

function limparRealce(): void {
  CSS.highlights?.delete(REALCE)
}

/**
 * Caixa de busca do cabeçalho. Percorre todos os guias e navega para o
 * resultado escolhido — teclado inteiro: `Ctrl`+`K` ou `/` para chegar aqui,
 * setas para escolher, `Enter` para ir, `Esc` para limpar.
 *
 * Sem debounce: o índice tem dezenas de seções e a busca é um `indexOf` por
 * seção, então esperar o usuário parar de digitar só atrasaria o resultado.
 */
function Busca({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [consulta, setConsulta] = useState('')
  const [foco, setFoco] = useState(false)
  const [sel, setSel] = useState(0)

  const resultados = useMemo(() => buscar(consulta), [consulta])
  const aberto = foco && consulta.trim() !== ''

  const ir = (r: ResultadoBusca) => {
    setConsulta('')
    setFoco(false)
    inputRef.current?.blur()
    irPara(r.rota, r.secaoId, consulta.trim())
  }

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation() // senão o `Esc` global sairia da página junto
      if (consulta) return setConsulta('')
      return inputRef.current?.blur()
    }
    if (resultados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => (i + 1) % resultados.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => (i - 1 + resultados.length) % resultados.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const escolhido = resultados[sel] ?? resultados[0]
      if (escolhido) ir(escolhido)
    }
  }

  return (
    <div className="manual-busca">
      <span className="manual-busca-lupa" aria-hidden="true">
        ⌕
      </span>
      <input
        ref={inputRef}
        type="search"
        className="manual-busca-campo"
        placeholder="Buscar na documentação…"
        aria-label="Buscar na documentação"
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value)
          setSel(0)
        }}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onKeyDown={aoTeclar}
      />
      {!consulta && <kbd className="manual-busca-tecla">Ctrl K</kbd>}

      {aberto && (
        <div className="manual-busca-resultados" role="listbox">
          {resultados.length === 0 ? (
            <p className="manual-busca-vazio">Nada encontrado para “{consulta}”.</p>
          ) : (
            resultados.map((r, i) => (
              <button
                key={`${r.rota}/${r.secaoId}`}
                type="button"
                role="option"
                aria-selected={i === sel}
                className={`manual-busca-item${i === sel ? ' manual-busca-item--sel' : ''}`}
                // O clique tem que ganhar do `blur`, que fecharia a lista antes.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSel(i)}
                onClick={() => ir(r)}
              >
                <span className="manual-busca-item-topo">
                  <span aria-hidden="true">{r.icone}</span>
                  <span className="manual-busca-item-titulo">{grifar(r.titulo, consulta)}</span>
                  <span className="manual-busca-item-guia">{r.guia}</span>
                </span>
                <span className="manual-busca-item-trecho">{grifar(r.trecho, consulta)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Grifa no texto os pedaços que casam com a consulta. */
function grifar(texto: string, consulta: string) {
  return realcar(texto, consulta).map((parte, i) =>
    parte.marca ? <mark key={i}>{parte.texto}</mark> : <span key={i}>{parte.texto}</span>,
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
