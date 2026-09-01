import './OnboardingTour.css'

export interface TourStepInfo {
  readonly titulo: string
  readonly texto: string
  /** Rótulo do botão de ação, quando o passo tem um — `null` quando o passo espera uma ação na própria tela. */
  readonly acao: string | null
}

export const TOUR_STEPS: readonly TourStepInfo[] = [
  {
    titulo: 'Primeiros passos',
    texto:
      'Cinco minutos até o primeiro "entendi": vamos abrir um esquema pronto, rodar o simulador e ' +
      'ver um reforço acontecer.',
    acao: 'Começar',
  },
  {
    titulo: '1. Abra um modelo',
    texto: 'Um esquema de razão fixa: a cada 5 respostas na alavanca, uma pelota.',
    acao: 'Abrir "Razão fixa"',
  },
  {
    titulo: '2. Rode o simulador',
    texto: 'A caixa virtual já vem com os dispositivos do modelo, prontos para clicar.',
    acao: 'Abrir simulador',
  },
  {
    titulo: '3. Aperte a alavanca',
    texto: 'Clique na alavanca 5 vezes na caixa virtual, à direita — a quinta deveria reforçar.',
    acao: null,
  },
  {
    titulo: 'Você reforçou uma resposta! 🎉',
    texto:
      'Um gatilho, uma regra, um destino — é assim que todo esquema funciona por baixo. O botão ' +
      '"Abrir lógica" no card de um estado mostra isso em nós; o resto é vocabulário novo.',
    acao: 'Concluir',
  },
]

export interface OnboardingTourProps {
  readonly step: number
  readonly onAction: () => void
  readonly onSkip: () => void
}

export function OnboardingTour({ step, onAction, onSkip }: OnboardingTourProps) {
  const info = TOUR_STEPS[step]
  if (!info) return null

  return (
    <div className="onboarding-tour">
      <div className="onboarding-tour-progresso">
        {TOUR_STEPS.map((_, i) => (
          <span
            key={i}
            className={`onboarding-tour-passo${i === step ? ' onboarding-tour-passo--atual' : ''}${i < step ? ' onboarding-tour-passo--feito' : ''}`}
          />
        ))}
      </div>
      <h3>{info.titulo}</h3>
      <p>{info.texto}</p>
      <div className="onboarding-tour-rodape">
        <button type="button" className="onboarding-tour-pular" onClick={onSkip}>
          {step === TOUR_STEPS.length - 1 ? 'Fechar' : 'Pular'}
        </button>
        {info.acao && (
          <button type="button" className="onboarding-tour-acao" onClick={onAction}>
            {info.acao}
          </button>
        )}
      </div>
    </div>
  )
}
