# Contribuindo

Use Node.js 22.22 ou superior e não inclua dados reais, chaves ou URLs privadas.

1. Crie uma branch local.
2. Rode `npm ci`.
3. Implemente mantendo Recurso → Operação, `pairedItem`, expressões,
   `continueOnFail` e erros nativos do n8n.
4. Adicione testes para parâmetros, transporte e segurança.
5. Rode `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
   `npm run build` e `npm pack --dry-run`.

Mudanças de contrato devem ser compatíveis com a API do monorepo Tavio CRM e
documentadas no changelog. Nunca aceite `workspaceId` em parâmetros do nó.
Novas dependências de runtime exigem revisão explícita de segurança e tamanho.
