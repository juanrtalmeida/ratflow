import { App } from './App.tsx'
import { Manual } from './Manual.tsx'
import { useRota } from './rota.ts'

/**
 * As rotas do app. O editor está sempre montado — o manual é uma página que
 * ocupa a tela por cima dele, e não uma troca de tela: desmontar o editor para
 * ler o manual faria o canvas se remontar na volta e poderia perder uma edição
 * que o autosave (que só grava depois de uma pausa) ainda não tinha gravado.
 */
export function Raiz() {
  const rota = useRota()

  return (
    <>
      <App />
      {rota === 'manual' && <Manual />}
    </>
  )
}
