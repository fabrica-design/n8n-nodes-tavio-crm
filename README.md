# n8n-nodes-tavio-crm

Pacote privado oficial de integração entre o [n8n](https://n8n.io/) e o Tavio
CRM. Inclui um nó regular para operações comerciais e um trigger de webhooks
com validação HMAC-SHA256.

## Compatibilidade

| Componente      | Versão validada                     |
| --------------- | ----------------------------------- |
| n8n self-hosted | 2.29.1                              |
| `n8n-workflow`  | 2.29.1                              |
| Node.js         | 22.22 ou superior                   |
| Tavio CRM API   | `/api/v1` do monorepo em 13/08/2026 |

O pacote usa somente `n8n-workflow` como peer dependency e não inclui runtime
externo. A implementação foi criada e validada com `@n8n/node-cli`.

## Credenciais

Crie uma credencial **Tavio CRM API** com:

- URL da API: `https://crm.tavio.com.br/api/v1` por padrão;
- chave de API no formato emitido pelo Tavio CRM.

A chave fica marcada como segredo no n8n. O teste de credencial consulta
`GET /auth/session`. Não há e nunca deve haver campo `workspaceId`: o Tavio CRM
deriva o tenant exclusivamente da chave.

Escopos necessários dependem das operações usadas:

| Função                | Escopos                                           |
| --------------------- | ------------------------------------------------- |
| Contatos e empresas   | `contacts:read/write`, `organizations:read/write` |
| Leads e negócios      | `leads:read/write`, `deals:read/write`            |
| Funis e opções        | `pipelines:read`                                  |
| Atividades e produtos | `activities:read/write`, `products:read/write`    |
| Notas e tags          | `notes:write`, `tags:read/write`                  |
| Campos e seletores    | `custom-fields:read`, `users:read`, `teams:read`  |
| Trigger               | `webhooks:manage`                                 |

Use o conjunto mínimo. Revogue a chave no CRM ao desativar definitivamente a
integração.

## Operações

| Recurso   | Operações                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------- |
| Contato   | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Criar ou Atualizar                                |
| Empresa   | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Criar ou Atualizar                                |
| Lead      | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Arquivar, Converter                               |
| Negócio   | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Mover, Ganho, Perdido, Reabrir, Adicionar Produto |
| Atividade | Criar, Obter, Obter Muitas, Atualizar, Concluir                                                     |
| Nota      | Criar                                                                                               |
| Produto   | Criar, Obter Muitos, Atualizar                                                                      |
| Funil     | Obter Muitos, Obter Etapas                                                                          |
| Tag       | Obter Muitas, Adicionar ao Item, Remover do Item                                                    |
| Avançado  | Requisição customizada restrita à origem da credencial                                              |

Funis, etapas, produtos, tags, usuários e equipes são carregados dinamicamente.
Listagens oferecem paginação automática, limite e saída simplificada ou bruta.
Cada item de saída mantém `pairedItem`; **Continue On Fail** usa o contrato
nativo do n8n.

### Campos JSON

Operações de escrita recebem os campos documentados pela API no parâmetro
**Campos (JSON)**. Expressões n8n são aceitas. Exemplos:

```json
{
	"firstName": "Ana",
	"lastName": "Silva",
	"emails": [{ "email": "ana@example.com", "primary": true }],
	"phones": [],
	"customData": {}
}
```

```json
{
	"title": "Renovação Acme",
	"value": "25000.00",
	"currency": "BRL",
	"externalId": "erp-deal-984",
	"customData": {}
}
```

Dinheiro deve ser string decimal. Updates usam a `version` retornada pelo CRM;
atividade e produto usam `updatedAt`. Informe uma **Chave de Idempotência**
estável ao criar ou alterar dados. No upsert, contato permite selecionar
`externalId`, `matchEmail` ou `matchPhone`; empresa usa `document`. Campos
personalizados podem ser escolhidos dinamicamente ou enviados em `customData`
dentro de **Campos (JSON)**.

### Requisição avançada

Aceita método, caminho, query e corpo JSON. O caminho deve começar com `/` e é
resolvido contra a URL da credencial. URLs absolutas, protocol-relative e
tentativas de trocar a origem são rejeitadas antes do HTTP. A autenticação é
sempre aplicada pela credencial e nunca aparece na saída.

## Gatilho webhook

Ao ativar o workflow, o **Tavio CRM Trigger** cria um endpoint no CRM e guarda o
ID e o segredo de uso único nos dados estáticos do workflow. Ao desativar,
desabilita o endpoint remoto.

O trigger:

- valida `X-Tavio-Signature` sobre `timestamp.eventId.corpoBruto`;
- rejeita assinaturas inválidas ou timestamps fora da janela de cinco minutos;
- valida a correspondência dos headers com o payload;
- deduplica os 500 event IDs mais recentes;
- retorna `eventId`, `event`, `occurredAt`, `resourceId`, `data` e `raw`;
- nunca inclui o segredo na saída.

Eventos: contato criado/atualizado, empresa criada, lead criado/convertido,
negócio criado/atualizado/movido/ganho/perdido e atividade criada/concluída.
A URL pública do n8n precisa ser HTTPS e estar corretamente configurada; o CRM
recusa destinos locais ou privados em produção.

## Instalação self-hosted

### Pela interface do n8n

1. Gere ou disponibilize o pacote em um registro npm acessível pela instância.
2. Em **Settings → Community Nodes**, escolha **Install**.
3. Informe `n8n-nodes-tavio-crm` e reinicie os workers se usar queue mode.

Para pacote privado em registro, configure a autenticação npm no ambiente do
container por secret do orquestrador; não grave token em imagem ou repositório.

### Artefato local

```bash
npm ci
npm run lint
npm run build
npm pack
```

Instale o `.tgz` resultante no diretório de community nodes da instância e
reinicie main e workers. O tarball não contém testes, fontes temporárias ou
credenciais.

## Docker e EasyPanel

O `Dockerfile` versionado gera o pacote em um estágio Node 22 Alpine e o instala
em uma imagem imutável do n8n 2.29.1:

```bash
docker build -t n8n-tavio-crm:0.1.0 .
```

Se o registry principal estiver temporariamente limitado, o mesmo build pode
usar o espelho oficial da imagem sem alterar o Dockerfile:

```bash
docker build --build-arg N8N_IMAGE=docker.io/n8nio/n8n:2.29.1 -t n8n-tavio-crm:0.1.0 .
```

No EasyPanel, use este repositório e o `Dockerfile` da raiz para construir uma
imagem própria. Aponte o serviço principal do n8n e todos os workers para a
mesma imagem. Preserve as variáveis, banco e volumes já usados pelo n8n; não é
necessário expor uma porta adicional. Não adicione a chave Tavio à imagem:
cadastre-a como credencial pela UI do n8n.

A imagem define `N8N_CUSTOM_EXTENSIONS` para um caminho imutável fora de
`/home/node/.n8n`. Assim, o volume persistente do n8n não oculta o pacote e não
é necessário executar `npm install` no startup.

Faça um workflow de smoke antes de promover. Para atualizar, faça checkout do
commit desejado, construa uma nova tag e aplique-a ao main e aos workers. Para
rollback, reaplique a tag anterior nos mesmos serviços, sem alterar nem apagar
o banco ou os volumes do n8n.

## Exemplos importáveis

- [`examples/01-webhook-lead-contato-empresa.json`](examples/01-webhook-lead-contato-empresa.json)
- [`examples/02-lead-qualificado-negocio.json`](examples/02-lead-qualificado-negocio.json)
- [`examples/03-etapa-criar-atividade.json`](examples/03-etapa-criar-atividade.json)
- [`examples/04-negocio-ganho-onboarding.json`](examples/04-negocio-ganho-onboarding.json)

Após importar, selecione sua credencial e substitua IDs de exemplo.

## Solução de problemas

- `401`: chave inválida/revogada ou assinatura rejeitada; recrie a credencial
  ou reative o trigger para obter um novo segredo remoto.
- `403`: falta escopo na API key ou permissão no papel de quem criou a chave.
- `409`: `version`/`updatedAt` obsoleto, chave idempotente reutilizada com corpo
  diferente ou upsert ambíguo. Leia novamente o registro antes de repetir.
- `429`: reduza concorrência e aplique retry com backoff.
- Trigger não ativa: confirme URL pública HTTPS, `WEBHOOK_URL` do n8n e
  `webhooks:manage`.
- Opções vazias: adicione os escopos de leitura correspondentes.

## Desenvolvimento

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Consulte [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e a
[matriz auditada da API](docs/api-coverage.md).

## Licença

MIT. Consulte [LICENSE](LICENSE).
