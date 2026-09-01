# MED-PC Studio

Editor visual de nós para programas **MedState Notation** (`.MPC`) do MED-PC (Med Associates).
Lê, edita e cria arquivos `.MPC` arrastando e ligando nós em um canvas, em vocabulário de
laboratório — sem escrever código. Roda **inteiramente no navegador e offline**, sem servidor.

## Como funciona

O canvas tem dois níveis:

- **Nível 1 — o protocolo.** Cada nó é um estado; cada seta, uma transição. Uma aba por processo
  paralelo (`S.S.n`).
- **Nível 2 — a lógica.** Duplo clique num estado abre o grafo da sua lógica: nós de **gatilho**
  (uma resposta, um tempo), **ação** (ligar dispositivo, somar contador), **decisão** (comparação
  com duas saídas, sim/não) e **destino** (ir para outro estado, ou ficar).

O **arquivo `.MPC` é a fonte da verdade**. O canvas é uma projeção da árvore sintática, e cada gesto
vira uma edição cirúrgica no texto — comentários, espaçamento e ordem originais são preservados, de
modo que um arquivo escrito por outra pessoa abre e volta a fechar sem ser estragado.

Nomes amigáveis não vivem num banco à parte: são gravados no próprio arquivo com idiomas nativos do
MedState (`^Constante` para dispositivos, `VAR_ALIAS` para contadores, comentários `\@nome:` para
estados). O `.MPC` continua legível no Bloco de Notas.

O próprio app traz duas páginas de documentação, em ☰ → Ajuda, servidas pelo mesmo componente
(`src/ui/Manual.tsx`) a partir de conteúdo em forma de dados:

- **Manual** (`#/manual`, `src/ui/manual-conteudo.ts`) — a ferramenta: o que existe, como usar, os
  atalhos e os limites conhecidos;
- **A linguagem MED-PC** (`#/linguagem`, `src/ui/linguagem-conteudo.ts`) — a linguagem: como um
  programa MedState roda, a sintaxe com exemplo de cada uso, os padrões dos arquivos de laboratório
  e as armadilhas comuns.

## Desenvolvimento

```bash
npm install
npm run dev          # servidor de desenvolvimento
npm test             # testes em modo watch
npm run test:run     # testes uma vez
npm run lint         # oxlint
npm run build        # checagem de tipos + build de produção
```

### Estrutura

| Pasta | Papel |
| --- | --- |
| `src/core/` | TypeScript puro: lexer, parser, AST, edições de texto, validação, simulador |
| `src/graph/` | Compilador e descompilador entre o grafo de nós e o código MedState |
| `src/vocab/` | Perfil de hardware, catálogo de ações e narrador (AST → português) |
| `src/canvas/` | Canvas de nível 1 e 2 (React Flow) |
| `src/editor/` | Editor de código CodeMirror (segunda visão) |
| `src/project/` | Persistência: IndexedDB e File System Access API |
| `src/ui/` | Casca da aplicação, glossário, onboarding |
| `fixtures/` | Arquivos `.MPC` reais usados como especificação executável dos testes |

`src/core/` e `src/graph/` não importam React — é ali que mora a lógica de linguagem, testável
isoladamente.

## Fixtures

Os testes de round-trip rodam contra os arquivos em `fixtures/`. Coloque ali `.MPC` reais e
variados (FR, VI, PR, com `IF`/`@label`, com `LIST`/`RANDD`, de MED-PC IV e de V): a suíte exige que
abrir e salvar devolva o arquivo **byte a byte idêntico**.
