/**
 * Todo template desta biblioteca é **um processo só**, de propósito: o que
 * ensina é o mecanismo do esquema de reforço, não como orquestrar processos
 * paralelos — isso a fixture `fr5-sintetico.MPC` já mostra. Consequência
 * prática, para nunca gerar diagnóstico:
 *
 * - nenhum `DISKVARS` (nada declarado que possa ficar "nunca escrito");
 * - todo dispositivo ligado tem um "desligar" em algum ramo (a macro de
 *   pulso: liga, espera, desliga);
 * - todo contador somado também é zerado no `#START`;
 * - todo estado tem pelo menos uma saída para um **número** de estado
 *   diferente do seu — `SX` sozinho não conta, então estados que só de
 *   propósito ficam "esperando" sempre têm uma segunda regra que sai dali.
 */

/** Uma lista de valores espalhados em torno de uma média — para VR/VI/PR. */
export function espalhar(media: number, passo: number, quantidade = 5): number[] {
  const inicio = -Math.floor(quantidade / 2)
  const valores: number[] = []
  for (let i = 0; i < quantidade; i++) {
    const v = media + (inicio + i) * passo
    valores.push(Math.max(passo, Math.round(v * 100) / 100))
  }
  return valores
}

export function formatarLista(valores: readonly number[]): string {
  return valores.join(', ')
}
