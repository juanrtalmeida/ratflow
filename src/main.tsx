import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './ui/App.tsx'
import { Manual } from './ui/Manual.tsx'
import { useRota } from './ui/rota.ts'

/**
 * As rotas do app. O editor está sempre montado — o manual é uma página que
 * ocupa a tela por cima dele, e não uma troca de tela: desmontar o editor para
 * ler o manual faria o canvas se remontar na volta e poderia perder uma edição
 * que o autosave (que só grava depois de uma pausa) ainda não tinha gravado.
 */
function Raiz() {
  const rota = useRota()

  return (
    <>
      <App />
      {rota === 'manual' && <Manual />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
