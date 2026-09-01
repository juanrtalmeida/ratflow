import { App } from './App.tsx'
import { GLOSSARIO } from './glossario-conteudo.ts'
import { LINGUAGEM } from './linguagem-conteudo.ts'
import { Manual } from './Manual.tsx'
import { MANUAL, type ManualSecao } from './manual-conteudo.ts'
import { GUIAS, type RotaGuia, useRota } from './rota.ts'

/** O texto de cada guia. Os rótulos e a ordem vivem em `GUIAS` (`rota.ts`). */
const SECOES: Record<RotaGuia, readonly ManualSecao[]> = {
  manual: MANUAL,
  linguagem: LINGUAGEM,
  glossario: GLOSSARIO,
}

/**
 * As rotas do app. O editor está sempre montado — as páginas de documentação
 * ocupam a tela por cima dele, e não são uma troca de tela: desmontar o editor
 * para ler o manual faria o canvas se remontar na volta e poderia perder uma
 * edição que o autosave (que só grava depois de uma pausa) ainda não tinha
 * gravado.
 */
export function Raiz() {
  const rota = useRota()
  const guia = GUIAS.find((g) => g.rota === rota)

  return (
    <>
      <App />
      {/* `key` por guia: trocar de guia começa a leitura do topo, com o sumário
          apontando a primeira seção, em vez de herdar a rolagem do anterior. */}
      {guia && <Manual key={guia.rota} guia={guia} secoes={SECOES[guia.rota]} />}
    </>
  )
}
