import type { ILoadOptionsFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { formatLoadOptionsError, TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';

function contextFor(parameters: Record<string, unknown>, response: unknown) {
	const request = vi.fn().mockResolvedValue(response);
	const context = {
		getNode: vi.fn().mockReturnValue({ typeVersion: 3 }),
		getNodeParameter: vi.fn((name: string, fallback?: unknown) =>
			name in parameters ? parameters[name] : (fallback ?? ''),
		),
		getCredentials: vi.fn().mockResolvedValue({
			baseUrl: 'https://crm.tavio.com.br/api/v1',
			apiKey: 'nunca-expor-esta-chave',
		}),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as ILoadOptionsFunctions;
	return { context, request };
}

describe('carregadores dinâmicos', () => {
	it('interpreta envelopes reais, usa IDs e filtra Tags pela entidade correta', async () => {
		const { context, request } = contextFor(
			{ resource: 'tag', entityType: 'deal' },
			{ data: [{ id: 'tag-1', name: 'Prioridade' }], meta: { correlationId: 'test' } },
		);
		const methods = new TavioCrm().getNodeType(3).methods?.loadOptions;
		await expect(methods?.getTags.call(context)).resolves.toEqual([
			{ name: 'Prioridade', value: 'tag-1' },
		]);
		expect((request.mock.calls[0][1] as IHttpRequestOptions).qs).toEqual({ entity: 'DEAL' });
	});

	it('filtra Campos personalizados e pagina resource locators pelo cursor da API', async () => {
		const node = new TavioCrm().getNodeType(3);
		const fields = contextFor(
			{ resource: 'deal' },
			{ data: [{ id: 'field-1', name: 'Canal', type: 'SINGLE_SELECT' }] },
		);
		await expect(node.methods?.loadOptions?.getCustomFields.call(fields.context)).resolves.toEqual([
			{ name: 'Canal', value: 'field-1' },
		]);
		expect((fields.request.mock.calls[0][1] as IHttpRequestOptions).qs).toEqual({ entity: 'DEAL' });

		const contacts = contextFor(
			{ resource: 'deal' },
			{ data: { items: [{ id: 'contact-1', fullName: 'Ana Silva' }], nextCursor: 'cursor-2' } },
		);
		await expect(
			node.methods?.listSearch?.getContacts.call(contacts.context, 'ana', 'cursor-1'),
		).resolves.toEqual({
			results: [{ name: 'Ana Silva', value: 'contact-1' }],
			paginationToken: 'cursor-2',
		});
		expect((contacts.request.mock.calls[0][1] as IHttpRequestOptions).qs).toMatchObject({
			search: 'ana',
			cursor: 'cursor-1',
			limit: 100,
		});
	});

	it('filtra etapas pelo funil selecionado, inclusive dentro de Campos adicionais', async () => {
		const { context } = contextFor(
			{ resource: 'deal', additionalFields: { pipelineId: { mode: 'id', value: 'pipeline-2' } } },
			{
				data: [
					{ id: 'pipeline-1', name: 'Antigo', stages: [{ id: 'stage-1', name: 'Entrada' }] },
					{ id: 'pipeline-2', name: 'Novo', stages: [{ id: 'stage-2', name: 'Proposta' }] },
				],
			},
		);
		await expect(
			new TavioCrm().getNodeType(3).methods?.loadOptions?.getStages.call(context),
		).resolves.toEqual([{ name: 'Novo — Proposta', value: 'stage-2' }]);
	});

	it('carrega contatos, empresas, produtos, funis, responsáveis e equipes com rótulos legíveis', async () => {
		const node = new TavioCrm().getNodeType(3);
		const scenarios = [
			{
				method: 'getContacts',
				path: '/contacts',
				response: { data: { items: [{ id: 'contact-1', fullName: 'Ana Silva' }] } },
				expected: [{ name: 'Ana Silva', value: 'contact-1' }],
			},
			{
				method: 'getOrganizations',
				path: '/organizations',
				response: { data: { items: [{ id: 'organization-1', name: 'Acme Ltda' }] } },
				expected: [{ name: 'Acme Ltda', value: 'organization-1' }],
			},
			{
				method: 'getProducts',
				path: '/products',
				response: { data: { items: [{ id: 'product-1', name: 'Plano', code: 'PRO' }] } },
				expected: [{ name: 'Plano (PRO)', value: 'product-1' }],
			},
			{
				method: 'getPipelines',
				path: '/pipelines',
				response: { data: [{ id: 'pipeline-1', name: 'Comercial' }] },
				expected: [{ name: 'Comercial', value: 'pipeline-1' }],
			},
			{
				method: 'getUsers',
				path: '/workspace/members',
				response: { data: [{ id: 'member-1', user: { name: 'Ana', email: 'ana@example.com' } }] },
				expected: [{ name: 'Ana (ana@example.com)', value: 'member-1' }],
			},
			{
				method: 'getTeams',
				path: '/workspace/teams',
				response: { data: [{ id: 'team-1', name: 'Vendas' }] },
				expected: [{ name: 'Vendas', value: 'team-1' }],
			},
		] as const;

		for (const scenario of scenarios) {
			const { context, request } = contextFor({ resource: 'deal' }, scenario.response);
			const method = node.methods?.loadOptions?.[scenario.method];
			await expect(method?.call(context)).resolves.toEqual(scenario.expected);
			expect((request.mock.calls[0][1] as IHttpRequestOptions).url).toBe(
				`https://crm.tavio.com.br/api/v1${scenario.path}`,
			);
		}
	});

	it.each([
		[401, 'credencial do Tavio CRM é inválida ou expirou'],
		[403, 'credencial não possui o escopo necessário'],
		[404, 'verifique a URL da API ou a disponibilidade do recurso'],
		[422, 'configuração do seletor é inválida'],
		[500, 'API indisponível'],
	])('transforma erro HTTP %i em mensagem acionável sem segredo', (status, message) => {
		const error = formatLoadOptionsError({
			statusCode: status,
			response: { body: 'nunca-expor-esta-chave' },
		});
		expect(error.message).toContain(message);
		expect(error.message).not.toContain('nunca-expor-esta-chave');
		expect(error.message).not.toContain('[object Object]');
	});
});
