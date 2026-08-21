# Regressão visual do Moctes

Esta suíte protege apenas as superfícies visuais mais sensíveis do editor. Ela usa Playwright e snapshots versionados, sem depender do banco de desenvolvimento, MinIO, ClamAV ou de uma sessão real.

## Comandos

Na raiz do projeto:

```bash
npm run test:visual
```

Para revisar uma mudança visual intencional e atualizar os baselines:

```bash
npm run test:visual:update
```

Sempre examine o diff antes de versionar uma atualização. O CI nunca atualiza snapshots automaticamente.

Para abrir o último relatório HTML:

```bash
npm run test:visual:report
```

Na primeira execução em uma máquina nova, instale o Chromium gerenciado pelo Playwright:

```bash
cd frontend
npx playwright install chromium
```

## Cobertura inicial

A suíte mantém dez snapshots essenciais:

1. editor aberto em 1440×900;
2. editor aberto em 1920×1080;
3. editor aberto em 1280×720;
4. shell mobile em 390×844;
5. painel de aparência em 1440×1200, altura necessária para exibir selects, cores e sliders juntos;
6. texto selecionado, com bounding box e toolbar contextual;
7. imagem selecionada, com handles;
8. menu da pessoa usuária;
9. asset `PROCESSING` na biblioteca;
10. placeholder `PROCESSING` dentro do editor.

Os testes também verificam overflow horizontal, limites do header, sidebar, toolbar, menu e preservação da geometria do placeholder.

## Determinismo

- O backend é substituído por respostas locais controladas usando interceptação de rede do Playwright.
- Usuária, workspace, caderno, seção, páginas, textos, imagem, sticker, post-it, forma e asset em processamento são fixtures estáticas.
- Datas e UUIDs gerados no navegador são estabilizados antes da aplicação carregar.
- O navegador usa locale `pt-BR`, timezone `America/Sao_Paulo`, tema claro, escala CSS 1 e preferência por movimento reduzido.
- A abertura do caderno e o carregamento de fontes e imagens são aguardados por estados reais; não há sleeps longos.
- A fonte Inter Variable é servida pelo próprio bundle da aplicação.
- Imagens do fixture usam apenas o catálogo local do projeto.
- Presença e cursores remotos são ocultados somente na suíte, pois dependem de WebSocket e não fazem parte destes cenários.

## Snapshots e tolerância

Os baselines ficam em `frontend/e2e/visual/__snapshots__`. A comparação aceita no máximo 0,2% de pixels diferentes, suficiente para pequenas variações de rasterização sem esconder deslocamentos, overflow, tipografia incorreta ou componentes cortados.

Quando uma comparação falha, o Playwright grava o esperado, o recebido e o diff em `frontend/test-results/visual`, além do relatório em `frontend/playwright-report`.

## CI

O workflow `.github/workflows/visual-regression.yml` executa no Windows, igual ao ambiente onde os baselines iniciais foram gerados. Ele instala a mesma versão do Chromium definida no lockfile e executa lint, typecheck, testes unitários, regressão visual e build.

Em caso de falha, o relatório HTML e os diffs são publicados como artefatos por 14 dias. O workflow não atualiza snapshots.

## Política para mudanças visuais

1. Execute `npm run test:visual` e abra o relatório.
2. Confirme se o diff representa uma regressão ou uma mudança de produto desejada.
3. Corrija a regressão ou execute `npm run test:visual:update` somente para a mudança aprovada.
4. Revise as imagens alteradas antes de incluí-las no commit.

Evite aumentar a tolerância, mascarar regiões grandes ou adicionar snapshots redundantes para resolver instabilidade.
