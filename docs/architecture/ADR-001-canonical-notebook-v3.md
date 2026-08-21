# ADR-001 — Modelo canônico do caderno V3

- Status: aceito
- Data: 2026-08-11

## Contexto

Até o schema V2, uma página era armazenada em `MoctesDocument.pages` e também em `NotebookSection.pages`. O vínculo com a seção ainda aparecia indiretamente em `Page.dividerId`. Cada mutação precisava atualizar múltiplas cópias, criando risco de páginas duplicadas, órfãs ou com conteúdo divergente.

Esse formato também dificulta undo/redo incremental, persistência remota e colaboração, pois uma única ação produz alterações redundantes no documento.

## Decisão

- `MoctesDocument.pages` é a única coleção de páginas.
- `Page.sectionId` identifica a seção proprietária.
- `NotebookSection` contém somente metadados e sua divisória visual.
- `Page.dividerId` existe apenas como campo legado de entrada e é removido durante a migração.
- `document.dividers` é mantido temporariamente como projeção compatível; `sections[].divider` é a representação de domínio utilizada pelo notebook.
- Todo notebook carregado passa por `migrateDocumentToSchemaV3`.

## Consequências

Benefícios:

- uma página e seus elementos possuem uma única fonte de verdade;
- mover uma página altera `sectionId` e ordem, sem copiar conteúdo;
- validação, persistência e comandos ficam mais simples;
- documentos V1/V2 continuam abrindo por migração idempotente.

Custos:

- componentes não podem mais obter contagem por `section.pages`;
- dados persistidos localmente são atualizados para V3 ao carregar;
- `document.dividers` ainda é duplicação temporária e deverá ser removido em uma futura versão de schema, depois que todos os consumidores legados forem eliminados.

## Regras de integridade

- IDs de páginas são únicos no documento.
- Toda página de notebook referencia um `sectionId` existente.
- Toda seção possui uma divisória.
- A ordenação de páginas é determinística pela ordem da seção e da página.
- A migração pode ser executada mais de uma vez sem alterar o resultado.

