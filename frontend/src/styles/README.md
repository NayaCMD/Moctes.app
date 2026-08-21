# Arquitetura de estilos do Moctes

Este diretório é a fronteira da refatoração gradual do CSS. A regra central é
preservar a geometria e o comportamento do editor enquanto o legado é retirado
em recortes pequenos, sempre protegidos pela regressão visual.

## Ordem da cascata

Os estilos entram na aplicação nesta ordem:

1. `index.css`: reset, temas e implementação legada ainda compartilhada pelo
   editor e pelo canvas;
2. `notebook*.css`: geometria e apresentação interna do caderno;
3. `auth.css`, `sync.css` e `collaboration.css`: domínios isolados;
4. `ui-foundations.css`: tipografia, acessibilidade e dimensões comuns de
   formulários, diálogos e painéis;
5. `tokens.css`: contrato semântico e dimensional ativo da interface;
6. `editor-shell.css`: header, menus, sidebar, workspace, controles de página,
   zoom, toolbar e responsividade do shell;
7. `paper-customization.css` e `page-templates.css`: aparência configurável da
   folha e seletor de templates estruturais;
8. `assets.css`: estados e componentes específicos do ciclo de vida de assets;
9. `mobile-editor.css` e `product-areas.css`: adaptações finais de viewport e
   áreas de produto.

Não altere essa ordem sem executar a suíte visual. `tokens.css` vem depois das
fundações de propósito: ele representa os valores efetivos do shell e substitui
as antigas redefinições que dependiam acidentalmente da ordem dos imports.

## Propriedade por arquivo

- `tokens.css`: dimensões do frame, escala tipográfica, controles, espaçamento,
  raios, cores semânticas, sombras, transições e níveis de empilhamento;
- `editor-shell.css`: somente a moldura da aplicação e seus controles;
- `ui-foundations.css`: padrões transversais que não definem a geometria do
  shell;
- `notebook*.css`: capa, divisórias, páginas, abas e animações do caderno;
- `paper-customization.css`, `page-templates.css`: personalização e criação de
  páginas, incluindo suas adaptações mobile;
- `assets.css`, `auth.css`, `sync.css`, `collaboration.css`: componentes de cada
  domínio;
- `index.css`: compatibilidade legada. Novos componentes não devem ser
  adicionados aqui.

Os tokens de tema (`--app-*`, `--ink` e `--primary-*`) permanecem em
`index.css`, pois mudam por `data-theme`. `tokens.css` consome esses valores e
expõe papéis semânticos como `--ui-surface`, `--ui-danger-text` e
`--ui-focus-ring`.

## Breakpoints do shell

O shell usa uma sequência única, em ordem decrescente:

- `1500px`: reduz conteúdo secundário do header;
- `1180px`: compacta ações e prepara a sidebar para sobreposição;
- `1100px`: transforma a biblioteca expandida em overlay;
- `900px`: reduz contexto e status no header;
- `700px`: ativa a moldura mobile;
- altura `760px`: compacta toolbar e header em telas baixas.

Os breakpoints `980px`, `1100px`, `760px` e `620px` de `index.css` ainda são
legado. Eles serão migrados junto com os respectivos componentes, e não por uma
troca global que possa afetar drag, resize ou o tamanho visual da folha.

## Estilos inline

Os estilos inline existentes foram auditados. Eles devem continuar no React
quando carregam estado que muda em tempo de execução, especialmente:

- posição e tamanho de elementos, menus e cursores;
- `transform` e escala do documento;
- progresso de sliders por custom property;
- cores escolhidas pela pessoa usuária;
- previews de drag, áreas de borracha e seleção;
- cores de capa, post-it, comentários e participantes.

Valores estáticos novos devem usar classes. A única ocorrência estática legada
identificada (`pointerEvents` em um template de post-it) fica para a etapa do
canvas, evitando misturar escopos nesta refatoração.

## `!important`

Após a primeira etapa restam 16 ocorrências, contra 23 no início:

- 8 garantem neutralização visual de elementos especiais no legado do canvas;
- 5 garantem redução de movimento, incluindo o spinner de sincronização;
- 2 pertencem ao modal de sincronização e dependem da composição atual dele;
- 1 pertence ao layout de colaboração.

O shell não usa mais `!important` para menu, zoom ou toolbar. As ocorrências
restantes devem ser removidas somente quando o componente proprietário for
migrado, com teste visual e comportamental específico.

## Z-index

Novas camadas do shell devem usar apenas os tokens de `tokens.css`:

`canvas < editor-chrome < sidebar < floating < header < popover < tooltip < modal`

Os valores numéricos ainda presentes em `index.css` pertencem a elementos do
canvas e popovers legados. Eles não devem ser normalizados sem analisar o
stacking context de cada elemento.

## Fluxo seguro para as próximas etapas

1. escolher um único domínio ou componente;
2. registrar seletores duplicados, estados e media queries que o afetam;
3. mover primeiro as regras efetivamente vencedoras da cascata;
4. remover somente as regras comprovadamente sobrescritas ou sem uso;
5. executar `npm run test:visual` antes e depois do grupo;
6. executar lint, typecheck, testes e build antes de concluir a etapa.

Próximos recortes recomendados: modais e popovers de ferramentas; formulários e
diálogos de assets; sincronização e colaboração; por último, separar
`index.css` entre base, canvas e compatibilidade temporária.
