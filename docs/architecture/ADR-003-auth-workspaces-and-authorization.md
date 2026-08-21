# ADR-003 — Autenticação, workspaces e autorização

- Status: aceito
- Data: 2026-08-11

## Contexto

A persistência inicial tratava todos os documentos como uma coleção global. Para operar como SaaS, a aplicação precisa separar dados de clientes, manter sessões revogáveis e aplicar autorização no servidor independentemente do que a interface exibe.

## Decisão

- Todo `Document` pertence obrigatoriamente a um `Workspace`.
- O acesso de um `User` ao workspace é representado por `Membership`, com estado e papel explícitos.
- Os papéis são `OWNER`, `ADMIN`, `EDITOR` e `VIEWER`; capacidades são mapeadas centralmente em políticas.
- Registro cria usuário, workspace pessoal, membership `OWNER` e sessão em uma transação lógica.
- Senhas são derivadas com `scrypt`, salt aleatório e comparação resistente a timing attacks.
- A sessão usa token opaco aleatório em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Apenas SHA-256 do token é armazenado no PostgreSQL.
- Um guard global autentica a requisição; um segundo guard resolve o recurso e verifica a política exigida pelo endpoint.
- Serviços de documentos e memberships repetem as verificações relevantes como defesa em profundidade.
- O cache do frontend recebe um escopo de usuário/workspace e a sincronização só inicia depois de uma sessão válida.

## Matriz inicial de acesso

| Papel | Workspace | Membros | Documentos |
| --- | --- | --- | --- |
| `OWNER` | ler, alterar e excluir | ler e gerenciar | ler, criar, alterar e excluir |
| `ADMIN` | ler e alterar | ler e gerenciar | ler, criar, alterar e excluir |
| `EDITOR` | ler | ler | ler, criar, alterar e excluir |
| `VIEWER` | ler | ler | somente leitura |

## Consequências

- Uma conta pode participar de múltiplos workspaces sem duplicar identidade.
- A revogação de sessão passa a ter efeito no servidor e o token bruto não pode ser recuperado do banco.
- Documentos antigos são preservados em um workspace de importação isolado.
- A autorização deixa de depender do frontend e é coberta por testes E2E de acesso anônimo e papel `VIEWER`.
- Recuperação de senha, verificação de e-mail, convites pendentes, rate limiting, CSRF explícito e encerramento de todas as sessões permanecem entregas de hardening antes da abertura pública.
