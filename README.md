# n8n-nodes-tavio-crm 0.2.2

Pacote privado oficial de integração entre o [n8n](https://n8n.io/) e o Tavio
CRM. Inclui um nó regular para operações comerciais e um trigger de webhooks
com validação HMAC-SHA256.

## Compatibilidade

| Componente      | Versão validada                                                   |
| --------------- | ----------------------------------------------------------------- |
| n8n self-hosted | 2.40.6 (carregamento da v3 validado em CI; instância pendente)    |
| `n8n-workflow`  | 2.34.2 nos testes locais; versão da imagem 2.40.6 a conferir      |
| Node.js         | 22.22 ou superior para build; runtime definido pela imagem n8n    |
| Tavio CRM API   | `/api/v1` do monorepo; Attendance requer incremento de 2026-09-26 |

O pacote usa somente `n8n-workflow` como peer dependency e não inclui runtime
externo. O peer permanece aberto para usar a cópia fornecida pelo n8n; os tipos
e testes de desenvolvimento ainda ficam fixados em `n8n-workflow` 2.34.2.
A imagem com n8n 2.40.6 passou por build e smoke test do carregamento da v3 no
CI; a instalação e a execução na instância de produção ainda precisam de teste.
A implementação foi validada com `@n8n/node-cli`.

## Credenciais

Crie uma credencial **Tavio CRM API** com:

- URL da API: `https://crm.tavio.com.br/api/v1` por padrão;
- chave de API no formato emitido pelo Tavio CRM.

A chave fica marcada como segredo no n8n. O teste de credencial consulta
`GET /auth/session`. Não há e nunca deve haver campo `workspaceId`: o Tavio CRM
deriva o tenant exclusivamente da chave.

Escopos necessários dependem das operações usadas:

| Função                | Escopos                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Contatos e empresas   | `contacts:read/write`, `organizations:read/write`                                                 |
| Leads e negócios      | `leads:read/write`, `deals:read/write`                                                            |
| Atendimento inbound   | `attendances:read/write`; vínculo com pessoa ou Lead também exige `contacts:read` ou `leads:read` |
| Funis e opções        | `pipelines:read`                                                                                  |
| Atividades e produtos | `activities:read/write`, `products:read/write`                                                    |
| Notas e tags          | `notes:write`, `tags:read/write`                                                                  |
| Campos e seletores    | `custom-fields:read`, `users:read`, `teams:read`                                                  |
| Trigger               | `webhooks:manage`                                                                                 |

Use o conjunto mínimo. Revogue a chave no CRM ao desativar definitivamente a
integração.

## Operações

| Recurso     | Operações                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contato     | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Criar ou Atualizar                                                                                                                                 |
| Empresa     | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Criar ou Atualizar                                                                                                                                 |
| Lead        | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Arquivar, Restaurar, Qualificar, Desqualificar, Converter; v3: Criar ou localizar por ID externo, Buscar por ID externo, Listar ativos por contato |
| Atendimento | v3: Registrar entrada, Obter, Vincular, Encaminhar, Registrar primeira resposta, Encerrar                                                                                                            |
| Negócio     | Criar, Obter, Obter Muitos, Pesquisar, Atualizar, Mover, Ganho, Perdido, Reabrir, Arquivar, Restaurar, Adicionar Produto                                                                             |
| Atividade   | Criar, Obter, Obter Muitas, Atualizar, Concluir                                                                                                                                                      |
| Nota        | Criar                                                                                                                                                                                                |
| Produto     | Criar, Obter, Obter Muitos, Atualizar                                                                                                                                                                |
| Funil       | Obter Muitos, Obter Etapas                                                                                                                                                                           |
| Tag         | Obter Muitas, Adicionar ao Item, Remover do Item                                                                                                                                                     |
| Avançado    | Requisição customizada restrita à origem da credencial                                                                                                                                               |

Funis, etapas, produtos, tags, usuários e equipes são carregados dinamicamente.
Listagens oferecem paginação automática, limite e saída simplificada ou bruta.
Cada item de saída mantém `pairedItem`; **Continue On Fail** usa o contrato
nativo do n8n.

### Versões e campos visuais

O incremento inbound de 2026-09-26 está implementado **localmente**. A migration
da API passou em PostgreSQL temporário vazio; faltam validação contra cópia do
banco de destino, publicação da versão 0.2.2 e deploy. Na v3,
**Atendimento → Registrar entrada** aceita IDs de conta, conversa e mensagem do
Chatwoot, canal, horário, origem e campanha opcional. O retorno simplificado
traz `attendanceId`, `contactId`, `leadId`, `status`, `version`, horários e
`outcome`. O contato pode ficar vazio até existir identidade confiável.
**Atendimento → Encerrar** exige motivo e não muda o Lead. **Lead → Criar ou
localizar** exige `externalId` de negócio e recupera o existente após repetição
ou timeout. As novas operações não usam uma chave de idempotência derivada da
execução do n8n; os IDs de mensagem, evento e Lead são os identificadores
persistentes. O node não envia `workspaceId`.

O contrato, os exemplos de payload, scopes e o plano de implantação estão em
[docs/inbound-attendance.md](../tavio-crm/docs/inbound-attendance.md). A v2
continua com os mesmos parâmetros e execução; novas operações aparecem somente
na v3. Nenhum workflow atual é migrado automaticamente.

Nodes novos usam automaticamente o **typeVersion 3**. Em `Negócio → Criar`, a
tela inicial contém apenas **Título**, **Associar a** e a coleção **Campos
adicionais**. A associação pode ser Contato, Empresa ou Nenhum — o contrato do
Tavio CRM permite um negócio sem vínculo. Valor, moeda, funil, etapa,
responsável, equipe, probabilidade, origem, ID externo, observações, Tags e
Campos personalizados só aparecem após **Adicionar campo**; somente os itens
escolhidos entram no payload.

A v3 preserva a interface visual tipada de contato, empresa, lead, atividade e
produto, os seletores de contatos, empresas, funis, etapas, produtos,
responsáveis, equipes, tags e campos personalizados e o uso de expressões do
n8n. Tags e Campos personalizados aparecem uma única vez por operação aplicável.
Funil e Etapa são obrigatórios na criação de negócio e a lista de Etapa é filtrada
pelo Funil selecionado.

Nodes existentes da versão 0.1.1 continuam carregando como **typeVersion 1**. A
v1 preserva **Campos (JSON)**, a chave de idempotência legada, os nomes internos e
a serialização dos workflows existentes. Não há migração silenciosa de valores.

Workflows salvos pela 0.2.0 continuam como **typeVersion 2**: os mesmos nomes e
caminhos de parâmetros são executados sem migração. A v2 recebeu apenas a remoção
das definições repetidas de Tags e Campos personalizados e os carregadores
corrigidos. A v3 usa um normalizador interno para os caminhos dentro de **Campos
adicionais**.

Os textos `Renovação Acme` e `25000.00` eram placeholders da v2, não defaults ou
dados enviados pela API. Eles não são copiados para a v3 e nenhum valor salvo do
usuário é apagado. `BRL` e `0` só são mostrados depois que o respectivo campo é
adicionado à coleção; `0` e `false` explicitamente escolhidos são preservados.

### Seletores e erros

Os resource locators usam a API `listSearch` do n8n com paginação por cursor. Tags
e Campos personalizados chamam respectivamente `/tags?entity=<ENTIDADE>` e
`/custom-fields?entity=<ENTIDADE>` com a entidade válida do registro; `TAG` não é
uma entidade aceita pelo CRM. Todas as respostas são desembrulhadas de
`{ data, meta }` e retornam IDs como valor interno e nomes legíveis como rótulo.

Erros de opções são convertidos em mensagens acionáveis para credencial inválida
(401), escopo ausente (403), URL/recurso (404), configuração inválida (422) e API
indisponível (5xx), sem serializar objetos HTTP, chaves, headers ou `workspaceId`.

### Campos JSON (typeVersion 1)

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

### Idempotência na v2

Nas operações de escrita da v2, **Idempotência: Automática** é o padrão. A chave
determinística considera workflow, node, execução, item, recurso e operação e é
reutilizada em retries da mesma execução/item, sem ser registrada em logs. Em
**Opções avançadas**, é possível escolher uma chave personalizada ou desativar o
cabeçalho quando o contrato permitir. `externalId` continua sendo a deduplicação
de negócio para eventos de execuções diferentes e não substitui a chave HTTP.

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

Use esta opção apenas em uma instância sem queue mode. No queue mode, o pacote
precisa estar disponível também em cada worker e processador de webhook; a
[documentação oficial do n8n](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation)
orienta a instalação manual nesse caso.

1. Gere ou disponibilize o pacote em um registro npm acessível pela instância.
2. Em **Settings → Community Nodes**, escolha **Install**.
3. Informe `n8n-nodes-tavio-crm` e reinicie a instância após instalar.

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

## Exemplos rápidos da v2

- **Criar contato a partir de webhook:** use `Contato → Criar`, Nome `={{$json.nome}}`, E-mail `={{$json.email}}` e Telefone `={{$json.telefone}}`.
- **Criar ou atualizar contato:** use `Contato → Criar ou Atualizar`, escolha `External ID` e informe `={{$json.id_cliente}}`.
- **Criar lead:** use `Lead → Criar`, Título, Contato, Empresa, Valor e Moeda; a conversão seleciona Funil e depois Etapa.
- **Mover negócio:** use `Negócio → Mover`, selecione Negócio, Funil e Etapa e informe a versão retornada pelo CRM.
- **Concluir atividade:** use `Atividade → Concluir`, selecione a Atividade e informe o resultado opcional.
- **Requisição avançada:** use somente para contratos não modelados, com Método, Caminho relativo, Query JSON e Corpo JSON.

## Docker e EasyPanel

O `Dockerfile` versionado gera o pacote em um estágio Node 22 Alpine e o instala
por padrão sobre a imagem oficial exata `docker.n8n.io/n8nio/n8n:2.40.6`:

```bash
docker build -t n8n-tavio-crm:2.40.6-0.2.2-COMMIT .
```

Se `docker.n8n.io` responder HTTP 429, preserve a mesma versão e use a imagem
espelhada no Docker Hub por meio do argumento `N8N_IMAGE`:

```bash
docker build --build-arg N8N_IMAGE=docker.io/n8nio/n8n:2.40.6 -t n8n-tavio-crm:2.40.6-0.2.2-COMMIT .
```

No EasyPanel, use este repositório e o `Dockerfile` da raiz para construir uma
imagem própria. Aponte o serviço principal e todos os workers n8n para a mesma
imagem imutável `n8n-tavio-crm:2.40.6-0.2.2-COMMIT`; uma mistura de versões entre main
e workers não é suportada. Preserve integralmente o banco, os volumes, o
domínio, todas as variáveis existentes e, em especial, `N8N_ENCRYPTION_KEY`.
Não recrie nem limpe esses recursos durante a troca da imagem. Não é necessário
expor porta adicional. Não adicione a chave Tavio à imagem: cadastre-a como
credencial pela UI do n8n.

A imagem define `N8N_CUSTOM_EXTENSIONS` para um caminho imutável fora de
`/home/node/.n8n`. Assim, o volume persistente do n8n não oculta o pacote e não
é necessário executar `npm install` no startup.

Faça um workflow de smoke antes de promover. Para atualizar, faça checkout do
commit desejado, construa uma nova tag imutável e aplique exatamente a mesma
imagem ao main e aos workers. Para rollback, reaplique a tag imutável anterior
nos mesmos serviços, sem alterar nem apagar banco, volumes, domínio, variáveis
ou encryption key. Nunca use `latest` como imagem-base ou tag de release.

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
