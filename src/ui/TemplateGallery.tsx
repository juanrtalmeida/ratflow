import { useState } from 'react'
import { ALL_TEMPLATES, defaultValues, type Template } from '../core/templates/index.ts'
import './TemplateGallery.css'

export interface TemplateGalleryProps {
  readonly onUse: (texto: string) => void
  readonly onClose: () => void
}

/**
 * A galeria de templates. Escolher um mostra a explicação didática e um
 * formulário com os parâmetros declarados — "usar este modelo" substitui o
 * documento aberto pelo `.MPC` gerado, já com nomes e posições prontos para
 * o canvas desenhar.
 */
export function TemplateGallery({ onUse, onClose }: TemplateGalleryProps) {
  const [selecionado, setSelecionado] = useState<Template>(ALL_TEMPLATES[0]!)
  const [valores, setValores] = useState<Record<string, string>>(() =>
    defaultValues(ALL_TEMPLATES[0]!),
  )

  const escolher = (template: Template) => {
    setSelecionado(template)
    setValores(defaultValues(template))
  }

  return (
    <div className="template-gallery-overlay" onClick={onClose}>
      <div className="template-gallery" onClick={(e) => e.stopPropagation()}>
        <header className="template-gallery-header">
          <h2>Biblioteca de templates</h2>
          <button type="button" className="template-gallery-fechar" onClick={onClose} title="Fechar">
            ✕
          </button>
        </header>

        <div className="template-gallery-body">
          <ul className="template-gallery-lista">
            {ALL_TEMPLATES.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className={`template-gallery-item${template.id === selecionado.id ? ' template-gallery-item--ativo' : ''}`}
                  onClick={() => escolher(template)}
                >
                  <span className="template-gallery-item-icone">{template.icone}</span>
                  <span className="template-gallery-item-texto">
                    <strong>{template.label}</strong>
                    <span className="template-gallery-item-resumo">{template.resumo}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="template-gallery-detalhe">
            <h3>
              {selecionado.icone} {selecionado.label}
            </h3>
            <p className="template-gallery-explicacao">{selecionado.explicacao}</p>

            {selecionado.params.length > 0 && (
              <div className="template-gallery-form">
                {selecionado.params.map((param) => (
                  <label key={param.id} className="template-gallery-campo">
                    <span>{param.label}</span>
                    <input
                      type={param.type === 'numero' ? 'number' : 'text'}
                      step="any"
                      value={valores[param.id] ?? ''}
                      onChange={(e) =>
                        setValores((atual) => ({ ...atual, [param.id]: e.target.value }))
                      }
                    />
                    {param.ajuda && <small>{param.ajuda}</small>}
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              className="template-gallery-usar"
              onClick={() => onUse(selecionado.gerar(valores))}
            >
              Usar este modelo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
