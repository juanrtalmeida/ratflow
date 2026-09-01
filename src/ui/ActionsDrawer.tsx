import { useEffect } from 'react'
import './ActionsDrawer.css'

export interface ActionsDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly fileName: string | null
  readonly lastSavedAt: number | null
  readonly canExport: boolean
  readonly onNew: () => void
  readonly onOpen: () => void
  readonly onTemplates: () => void
  readonly onSave: () => void
  readonly onSaveAs: () => void
  readonly onExportPng: () => void
  readonly onExportSvg: () => void
  readonly onProtocolSheet: () => void
  readonly onManual: () => void
  readonly onLinguagem: () => void
  readonly onGlossary: () => void
  readonly onTour: () => void
}

/**
 * Todas as ações que não são o canvas em si — arquivo, modelos, exportação,
 * ajuda — moram aqui, fora do fluxo principal. Antes eram uma segunda barra
 * inteira acima do canvas; numa tela de laptop isso é ~40px que fazem falta
 * para ver o protocolo. Cada clique num item fecha a drawer: é uma ação de
 * uma vez só, não um painel para deixar aberto trabalhando.
 */
export function ActionsDrawer({
  open,
  onClose,
  fileName,
  lastSavedAt,
  canExport,
  onNew,
  onOpen,
  onTemplates,
  onSave,
  onSaveAs,
  onExportPng,
  onExportSvg,
  onProtocolSheet,
  onManual,
  onLinguagem,
  onGlossary,
  onTour,
}: ActionsDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const run = (action: () => void) => () => {
    action()
    onClose()
  }

  return (
    <div className="actions-drawer-backdrop" onClick={onClose}>
      <aside className="actions-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="actions-drawer-head">
          <h2>Ações</h2>
          <button type="button" className="actions-drawer-fechar" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        <div className="actions-drawer-arquivo">
          <span className="actions-drawer-nome">{fileName ?? 'sem título'}</span>
          {lastSavedAt && (
            <span className="actions-drawer-autosave">
              salvo automaticamente às{' '}
              {new Date(lastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <section className="actions-drawer-secao">
          <h3>Arquivo</h3>
          <button type="button" onClick={run(onNew)}>
            📄 Novo
          </button>
          <button type="button" onClick={run(onOpen)}>
            📂 Abrir
          </button>
          <button type="button" onClick={run(onSave)}>
            💾 Salvar
          </button>
          <button type="button" onClick={run(onSaveAs)}>
            💾 Salvar como
          </button>
        </section>

        <section className="actions-drawer-secao">
          <h3>Modelos</h3>
          <button type="button" onClick={run(onTemplates)}>
            🗂 Modelos prontos
          </button>
        </section>

        <section className="actions-drawer-secao">
          <h3>Exportar</h3>
          {canExport && (
            <>
              <button type="button" onClick={run(onExportPng)} title="Exportar o canvas como imagem">
                🖼 Canvas em PNG
              </button>
              <button type="button" onClick={run(onExportSvg)} title="Exportar o canvas como vetor">
                🖼 Canvas em SVG
              </button>
            </>
          )}
          <button type="button" onClick={run(onProtocolSheet)}>
            📋 Folha de protocolo
          </button>
        </section>

        <section className="actions-drawer-secao">
          <h3>Ajuda</h3>
          <button type="button" onClick={run(onManual)}>
            📖 Manual — todas as funções
          </button>
          <button type="button" onClick={run(onLinguagem)}>
            📘 A linguagem MED-PC — sintaxe e padrões
          </button>
          <button type="button" onClick={run(onGlossary)}>
            ❓ Glossário
          </button>
          <button type="button" onClick={run(onTour)}>
            🎓 Tour de primeiros passos
          </button>
        </section>
      </aside>
    </div>
  )
}
