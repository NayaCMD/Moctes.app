# ADR-002 — Comandos, histórico incremental e persistência

- Status: aceito
- Data: 2026-08-11

## Contexto

As mutações do editor estavam implementadas diretamente no Zustand. O histórico mantinha até 50 snapshots de todos os documentos, mesmo quando uma ação alterava somente um campo de um elemento. A persistência principal era `localStorage`; o backend não possuía domínio nem endpoints de documentos.

## Decisão

- Zustand passa a coordenar interface e seleção, enquanto comandos do domínio produzem o próximo documento.
- Comandos comuns ficam em `domain/editor/editorCommands.ts` e operações de caderno em `domain/editor/notebookDocumentCommands.ts`.
- Cada comando gera patches e patches inversos por IDs estáveis de documento, página e elemento.
- Undo/redo aplica os patches; as pilhas não guardam mais arrays completos de documentos.
- PostgreSQL é a fonte remota de verdade e `localStorage` continua como cache offline.
- O conteúdo V3 é persistido em JSONB; metadados e versão são relacionais.
- Atualizações usam concorrência otimista por `expectedVersion` e retornam conflito HTTP 409 quando necessário.

## Consequências

- Alterações pequenas ocupam memória proporcional ao que mudou.
- Toda mutação encaminhada pelo store passa a criar seu próprio histórico automaticamente.
- Componentes deixam de conhecer ou capturar snapshots.
- O mesmo limite entre comando e estado prepara autosave e futura colaboração.
- Autenticação e isolamento por workspace foram adicionados posteriormente e estão documentados no ADR-003.
