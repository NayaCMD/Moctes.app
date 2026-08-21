# Baseline de performance e escala

Este laboratorio mede o renderer e a fila local que existem hoje, antes de
introduzir virtualizacao, Web Workers ou Canvas/WebGL. Os cenarios usam seed
fixa; portanto, contagem, tipo, posicao e conteudo dos elementos sao
reproduziveis.

## Como executar

Na raiz do repositorio:

```bash
npm run perf:lab --workspace=frontend
```

Abra `http://127.0.0.1:5173/?performance-lab=1`, escolha `large` ou `extreme`
e execute a medicao. A rota:

- usa o `DocumentPage`, os stores Zustand e a fila IndexedDB reais;
- desativa `StrictMode` somente no laboratorio para aproximar o renderer de
  producao;
- usa storage em memoria para o store de documentos, sem sobrescrever o
  caderno local do usuario;
- isola as operacoes IndexedDB por um scope unico e remove esse scope ao
  terminar;
- permite baixar o relatorio completo em JSON.

Os testes deterministas dos geradores e dos medidores rodam com:

```bash
npm run test --workspace=frontend -- --run src/performance
```

## Cenarios

| Perfil  | Paginas | Elementos | Ativos no DOM | Imagens | Fila offline | Conflitos |
| ------- | ------: | --------: | ------------: | ------: | -----------: | --------: |
| large   |     300 |     5.484 |           700 |   1.648 |          500 |       250 |
| extreme |     500 |    12.178 |         1.200 |   4.163 |        1.500 |     1.000 |

"Ativos no DOM" corresponde aos elementos da pagina ativa. As demais paginas
permanecem no estado, mas a interface atual nao as monta simultaneamente.

## Baseline de 13/08/2026

Ambiente: Windows 10, Chromium 151, viewport 1280 x 720, DPR 1, Vite em modo de
desenvolvimento. Os relatorios brutos estao em
[`large.chromium-windows.json`](./large.chromium-windows.json) e
[`extreme.chromium-windows.json`](./extreme.chromium-windows.json).

| Metrica                                    |     large |  extreme |
| ------------------------------------------ | --------: | -------: |
| Abertura ate o paint                       |  106,1 ms | 169,3 ms |
| FPS medio no drag                          |     27,63 |    16,42 |
| p95 de frame no drag                       |   49,9 ms |  83,3 ms |
| FPS medio no resize                        |     29,60 |    15,68 |
| p95 de frame no resize                     |   54,2 ms |  91,8 ms |
| Estado Zustand serializado                 |   2,21 MB |  4,89 MB |
| Heap usado, delta amostrado                | 110,33 MB | 63,28 MB |
| Enfileirar IndexedDB                       |  157,3 ms | 428,7 ms |
| Drenar IndexedDB, sem rede                 |  149,6 ms | 445,7 ms |
| Renders de `PageElementRenderer` no drag   |    31.500 |   33.600 |
| Renders de `PageElementRenderer` no resize |    32.900 |   31.200 |

O heap e influenciado pelo garbage collector: a leitura e uma amostra, nao um
valor retido definitivo. A sincronizacao usa transporte deterministico com
latencia zero e mede IndexedDB, serializacao e remocao da fila; ela nao mede
rede, API NestJS ou PostgreSQL.

## Decisao tecnica baseada nas medicoes

O gargalo prioritario e a propagacao do preview de interacao. Cada
`updatePreview` altera o objeto `interaction` do editor; todos os
`ElementFrame` inscritos nesse objeto renderizam novamente. Com 700 elementos,
um gesto de 1,5 segundo produziu mais de 31 mil renders; com 1.200 elementos,
cada frame ainda percorre todos os elementos e o FPS cai para aproximadamente 16.

Decisao atual:

1. Nao migrar para Canvas/WebGL. A abertura do DOM ainda e curta; o custo
   observado vem de renders React evitaveis, nao de uma limitacao demonstrada
   dos primitives HTML/SVG.
2. Nao mover o editor para Web Worker. Geracao, transicoes de conflito e fila
   local nao dominam o tempo de interacao. Workers tambem nao eliminariam o
   trabalho React no main thread.
3. Nao virtualizar paginas. O produto ja monta somente a pagina ou spread
   ativo. Virtualizacao de elementos visiveis pode ser reavaliada depois, mas
   nao deve ser a primeira intervencao porque selecao, hit-testing e elementos
   parcialmente visiveis elevam a complexidade.
4. Primeiro isolar o preview ao elemento selecionado: usar seletores Zustand
   estreitos por `elementId`, impedir que `DocumentPage` refaca o map completo
   a cada frame e memoizar elementos cujas props nao mudaram. Depois repetir os
   mesmos dois cenarios.

Uma segunda rodada deve ser comparada pela mediana de pelo menos tres execucoes
na mesma maquina. O criterio de sucesso da primeira otimizacao e reduzir os
renders de `PageElementRenderer` durante um gesto de `elementos x frames` para
uma ordem proxima de `frames`, manter abertura e tamanho do estado sem regressao
material e elevar o perfil `large` para pelo menos 50 FPS no mesmo ambiente.

## Revalidacao apos estabilizacao em 20/08/2026

Ambiente: Windows 10, Headless Chromium 151, viewport 1440 x 900, DPR 1 e Vite
em desenvolvimento. A instrumentacao foi mantida; imagens sinteticas passaram
a ser totalmente locais para que falhas de URL assinada nao contaminem o
renderer. Os seletores de interacao agora observam apenas o elemento ativo e o
renderer de cada elemento foi memoizado.

| Metrica                                    |    large |  extreme |
| ------------------------------------------ | -------: | -------: |
| Abertura ate o paint                       | 457,8 ms | 576,3 ms |
| FPS medio no drag                          |    59,36 |    45,71 |
| p95 de frame no drag                       |  16,7 ms |  33,4 ms |
| FPS medio no resize                        |    59,20 |    46,27 |
| p95 de frame no resize                     |  16,7 ms |  50,0 ms |
| Estado Zustand serializado                 |  2,20 MB |  4,84 MB |
| Enfileirar IndexedDB                       | 173,6 ms | 853,6 ms |
| Drenar IndexedDB, sem rede                 | 160,6 ms | 628,6 ms |
| Renders de `PageElementRenderer` no drag   |        1 |        1 |
| Renders de `PageElementRenderer` no resize |        1 |        1 |

O perfil `large` atingiu o criterio de 50 FPS e deixou de rerenderizar centenas
de elementos por frame. O perfil `extreme` tambem saiu de aproximadamente 16
FPS para 45-46 FPS. Portanto, esta medicao ainda nao justifica Canvas/WebGL ou
Web Workers. Virtualizacao de elementos pode voltar a ser avaliada se paginas
reais ultrapassarem de forma recorrente os 1.200 elementos ativos usados no
cenario extremo. A abertura ficou mais lenta nesta rodada e deve permanecer
monitorada; as execucoes usaram viewports diferentes, portanto esse numero nao
deve ser tratado como comparacao isolada de regressao.
