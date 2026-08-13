# Matriz auditada da API Tavio CRM

Auditoria realizada em 13/08/2026 sobre controllers, contratos, serviços,
Prisma, autenticação, idempotência, auditoria e worker do monorepo.

| Recurso               | Endpoint base        | Autorização API key        | Paginação/pesquisa      | Idempotência/auditoria                 | Lacuna encontrada e decisão                                            |
| --------------------- | -------------------- | -------------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| API key               | `/api-keys`          | administração por sessão   | lista                   | segredo excluído de snapshot; auditada | credencial usa `/auth/session`, sem administrar chaves                 |
| Contatos              | `/contacts`          | `contacts:read/write`      | cursor + search         | interceptor + outbox/audit             | adicionado `/contacts/upsert` por externalId, e-mail ou telefone       |
| Empresas              | `/organizations`     | `organizations:read/write` | cursor + search         | interceptor + outbox/audit             | adicionado upsert por documento único                                  |
| Leads                 | `/leads`             | `leads:read/write`         | cursor + search         | interceptor; eventos                   | adicionados get/update/archive/restore; convert repetível sem duplicar |
| Negócios              | `/deals`             | `deals:read/write`         | cursor + search/filtros | interceptor; lifecycle auditado        | `externalId` exposto no contrato; lifecycle existente reutilizado      |
| Funis/etapas          | `/pipelines`         | `pipelines:read/write`     | lista com etapas        | mutações auditadas                     | leitura existente atende loadOptions                                   |
| Atividades            | `/activities`        | `activities:read/write`    | cursor + search/filtros | interceptor; eventos                   | adicionados get/update e complete idempotente                          |
| Produtos              | `/products`          | `products:read/write`      | cursor + search         | interceptor                            | adicionados get/update e eventos de auditoria                          |
| Notas                 | `/notes`             | `notes:write`              | não aplicável           | criação auditada                       | escopo API key adicionado                                              |
| Tags                  | `/tags`              | `tags:read/write`          | lista                   | mutações auditadas                     | add/remove usa leitura + update versionado do item                     |
| Campos personalizados | `/custom-fields`     | `custom-fields:read`       | lista                   | mutações existentes auditadas          | leitura liberada para automações; escrita fora do nó v1                |
| Usuários              | `/workspace/members` | `users:read`               | lista                   | leitura                                | escopo somente leitura para seletor                                    |
| Equipes               | `/workspace/teams`   | `teams:read`               | lista                   | leitura                                | escopo somente leitura para seletor                                    |
| Webhooks              | `/webhooks`          | `webhooks:manage`          | lista/deliveries        | lifecycle auditado; segredo one-shot   | trigger cria, verifica existência e desabilita                         |

## Invariantes preservados

- `workspaceId` sempre deriva da sessão ou chave persistida.
- Escopo RBAC `OWN`/`TEAM`/`ALL` continua aplicado por `scopedWhere`.
- Dinheiro não usa `number` persistido.
- Mutações sensíveis escrevem audit log append-only e, quando aplicável, outbox.
- Workspaces suspensos continuam bloqueados para escrita pelo guard global.
- Nenhuma migration foi criada ou alterada.

## Contrato de erro

O nó reconhece o envelope `{ error: { code, message, correlationId, details } }`
da API. `401` indica credencial, `403` escopo/permissão, `404` também protege
isolamento entre tenants, `409` representa concorrência/idempotência/regra de
negócio e `429` exige backoff.
