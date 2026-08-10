import type { Snapshot } from '../core/simulate/machine.ts'
import type { HardwareProfile } from '../vocab/profile.ts'
import './VirtualBox.css'

export interface VirtualBoxProps {
  readonly profile: HardwareProfile
  readonly snapshot: Snapshot
  /** Clicar num dispositivo de entrada — a resposta do "sujeito" na caixa real. */
  readonly onRespond: (constante: string) => void
}

/**
 * A câmara operante desenhada com os dispositivos do perfil de hardware.
 * Dispositivo de entrada é botão (clicar dispara a resposta); de saída é
 * indicador (acende quando a porta está ligada na simulação). É o controle
 * principal do simulador — quem não programa testa o protocolo apertando
 * botões, não lendo `#R^Alavanca`.
 */
export function VirtualBox({ profile, snapshot, onRespond }: VirtualBoxProps) {
  if (profile.devices.length === 0) {
    return (
      <p className="virtual-box-vazia">
        Nenhum dispositivo detectado neste perfil ainda — a caixa virtual fica vazia até o arquivo
        ter constantes de porta reconhecidas.
      </p>
    )
  }

  return (
    <div className="virtual-box">
      {profile.devices.map((device) => {
        const ligado = snapshot.ports.has(device.constante)
        const entrada = device.kind === 'entrada'
        return (
          <button
            key={device.constante}
            type="button"
            className={`virtual-box-device virtual-box-device--${device.kind}${ligado ? ' virtual-box-device--ligado' : ''}`}
            disabled={!entrada}
            onClick={() => entrada && onRespond(device.constante)}
            title={entrada ? `Responder em ${device.label}` : device.label}
          >
            <span className="virtual-box-device-icone">{device.icon}</span>
            <span className="virtual-box-device-nome">{device.label}</span>
          </button>
        )
      })}
    </div>
  )
}
