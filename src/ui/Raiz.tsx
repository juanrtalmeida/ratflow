import { App } from './App.tsx'
import { LINGUAGEM } from './linguagem-conteudo.ts'
import { Manual } from './Manual.tsx'
import { MANUAL } from './manual-conteudo.ts'
import { useRota } from './rota.ts'

/**
 * As rotas do app. O editor está sempre montado — as páginas de documentação
 * ocupam a tela por cima dele, e não são uma troca de tela: desmontar o editor
 * para ler o manual faria o canvas se remontar na volta e poderia perder uma
 * edição que o autosave (que só grava depois de uma pausa) ainda não tinha
 * gravado.
 */
export function Raiz() {
  const rota = useRota()

  return (
    <>
      <App />
      {rota === 'manual' && <Manual titulo="Manual do RatFlow" secoes={MANUAL} />}
      {rota === 'linguagem' && <Manual titulo="A linguagem MED-PC" secoes={LINGUAGEM} />}
    </>
  )
}
