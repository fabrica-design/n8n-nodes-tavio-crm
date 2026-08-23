import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';

const locator = (value: string) => ({ mode: 'id', value });

function contextFor(parameters: Record<string, unknown>) {
	const request = vi.fn().mockResolvedValue({ data: { id: 'created-1', ...parameters } });
	const node = {
		id: 'node-1',
		name: 'Tavio CRM',
		type: 'tavioCrm',
		typeVersion: 2,
		parameters,
	} as unknown as INode;
	const context = {
		getInputData: vi.fn().mockReturnValue([{ json: { source: 'test' } }]),
		getNodeParameter: vi.fn(
			(name: string, _indexOrFallback?: number | unknown, fallback?: unknown) => {
				if (name in parameters) return parameters[name];
				return fallback ?? '';
			},
		),
		getNode: vi.fn().mockReturnValue(node),
		getExecutionId: vi.fn().mockReturnValue('execution-1'),
		getWorkflow: vi.fn().mockReturnValue({ id: 'workflow-1', name: 'Teste', active: false }),
		getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://crm.tavio.com.br/api/v1' }),
		continueOnFail: vi.fn().mockReturnValue(false),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as IExecuteFunctions;
	return { context, request };
}

async function executeV2(parameters: Record<string, unknown>) {
	const { context, request } = contextFor(parameters);
	const node = new TavioCrm().getNodeType(2);
	await node.execute?.call(context);
	return request.mock.calls[0][1] as IHttpRequestOptions;
}

describe('execução visual v2', () => {
	it.each([
		{
			name: 'contato',
			parameters: {
				resource: 'contact',
				operation: 'create',
				firstName: 'Ana',
				lastName: 'Silva',
				emails: { values: [{ email: 'ana@example.com', primary: true }] },
				phones: { values: [{ phone: '+5511999999999', primary: true }] },
			},
			path: '/contacts',
			body: {
				firstName: 'Ana',
				lastName: 'Silva',
				emails: [{ email: 'ana@example.com', primary: true }],
				phones: [{ phone: '+5511999999999', primary: true }],
			},
		},
		{
			name: 'empresa',
			parameters: {
				resource: 'organization',
				operation: 'create',
				name: 'Acme Ltda',
				document: '123',
			},
			path: '/organizations',
			body: { name: 'Acme Ltda', document: '123' },
		},
		{
			name: 'lead',
			parameters: {
				resource: 'lead',
				operation: 'create',
				title: 'Novo lead',
				currency: 'BRL',
				estimatedValue: '1200.00',
			},
			path: '/leads',
			body: { title: 'Novo lead', currency: 'BRL', estimatedValue: '1200.00' },
		},
		{
			name: 'negócio',
			parameters: {
				resource: 'deal',
				operation: 'create',
				title: 'Contrato',
				pipelineId: locator('pipe-1'),
				stageId: locator('stage-1'),
				value: '0',
				currency: 'BRL',
				probability: 0,
			},
			path: '/deals',
			body: {
				title: 'Contrato',
				pipelineId: 'pipe-1',
				stageId: 'stage-1',
				value: '0',
				currency: 'BRL',
				probability: 0,
			},
		},
		{
			name: 'atividade',
			parameters: {
				resource: 'activity',
				operation: 'create',
				title: 'Ligação',
				type: 'CALL',
				dueAt: '2026-08-23T12:00:00.000Z',
				priority: 'NORMAL',
			},
			path: '/activities',
			body: {
				title: 'Ligação',
				type: 'CALL',
				dueAt: '2026-08-23T12:00:00.000Z',
				priority: 'NORMAL',
			},
		},
		{
			name: 'produto',
			parameters: {
				resource: 'product',
				operation: 'create',
				name: 'Plano',
				type: 'SERVICE',
				defaultPrice: '99.90',
				currency: 'BRL',
				unit: 'un',
				recurring: false,
			},
			path: '/products',
			body: {
				name: 'Plano',
				type: 'SERVICE',
				defaultPrice: '99.90',
				currency: 'BRL',
				unit: 'un',
				recurring: false,
			},
		},
	])('$name usa payload tipado sem JSON bruto', async ({ parameters, path, body }) => {
		const request = await executeV2(parameters);
		expect(request.url).toBe(`https://crm.tavio.com.br/api/v1${path}`);
		expect(request.body).toMatchObject(body);
		expect(request.body).not.toHaveProperty('fields');
		expect(request.headers).toHaveProperty('Idempotency-Key');
	});

	it('preserva zero e false e mantém a chave automática estável', async () => {
		const first = await executeV2({
			resource: 'product',
			operation: 'create',
			name: 'Plano',
			type: 'PRODUCT',
			defaultPrice: '0',
			currency: 'BRL',
			unit: 'un',
			recurring: false,
		});
		const second = await executeV2({
			resource: 'product',
			operation: 'create',
			name: 'Plano',
			type: 'PRODUCT',
			defaultPrice: '0',
			currency: 'BRL',
			unit: 'un',
			recurring: false,
		});
		expect(first.body).toMatchObject({ defaultPrice: '0', recurring: false });
		expect(first.headers).toEqual(second.headers);
	});

	it('mantém JSON e chave legados na v1', async () => {
		const { context, request } = contextFor({
			resource: 'contact',
			operation: 'create',
			fields: '{"firstName":"Ana"}',
			idempotencyKey: 'legacy-key',
		});
		(context.getNode as ReturnType<typeof vi.fn>).mockReturnValue({
			...context.getNode(),
			typeVersion: 1,
		});
		const node = new TavioCrm().getNodeType(1);
		await node.execute?.call(context);
		expect((request.mock.calls[0][1] as IHttpRequestOptions).body).toEqual({ firstName: 'Ana' });
		expect((request.mock.calls[0][1] as IHttpRequestOptions).headers).toEqual({
			'Idempotency-Key': 'legacy-key',
		});
	});

	it('mantém JSON apenas na requisição avançada e bloqueia origem externa', async () => {
		const request = await executeV2({
			resource: 'advanced',
			operation: 'request',
			method: 'POST',
			path: '/contacts',
			query: '{"limit":1}',
			body: '{"firstName":"Ana"}',
		});
		expect(request.body).toEqual({ firstName: 'Ana' });
		expect(request.qs).toEqual({ limit: 1 });
	});
});
