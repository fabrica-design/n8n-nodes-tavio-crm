import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';

const locator = (value: string) => ({ mode: 'id', value });

function contextFor(parameters: Record<string, unknown>) {
	const request = vi.fn().mockResolvedValue({ data: { id: 'deal-1' } });
	const context = {
		getInputData: vi.fn().mockReturnValue([{ json: {} }]),
		getNodeParameter: vi.fn((name: string, _index?: number, fallback?: unknown) =>
			name in parameters ? parameters[name] : (fallback ?? ''),
		),
		getNode: vi.fn().mockReturnValue({
			id: 'node-v3',
			name: 'Tavio CRM',
			type: 'tavioCrm',
			typeVersion: 3,
			parameters,
		} as unknown as INode),
		getExecutionId: vi.fn().mockReturnValue('execution-v3'),
		getWorkflow: vi.fn().mockReturnValue({ id: 'workflow-v3', name: 'Teste', active: false }),
		getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://crm.tavio.com.br/api/v1' }),
		continueOnFail: vi.fn().mockReturnValue(false),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as IExecuteFunctions;
	return { context, request };
}

describe('execução compacta v3', () => {
	it('envia apenas os Campos adicionais escolhidos e preserva zero e false', async () => {
		const { context, request } = contextFor({
			resource: 'deal',
			operation: 'create',
			title: 'Contrato de suporte',
			associateWith: 'contact',
			contactId: locator('contact-1'),
			additionalFields: {
				pipelineId: locator('pipeline-1'),
				stageId: locator('stage-1'),
				value: '0',
				probability: 0,
				tagIds: ['tag-1'],
				customFields: { values: [{ fieldId: 'field-1', value: 'false' }] },
			},
		});
		await new TavioCrm().getNodeType(3).execute?.call(context);
		const options = request.mock.calls[0][1] as IHttpRequestOptions;
		expect(options.url).toBe('https://crm.tavio.com.br/api/v1/deals');
		expect(options.body).toEqual({
			title: 'Contrato de suporte',
			contactId: 'contact-1',
			pipelineId: 'pipeline-1',
			stageId: 'stage-1',
			value: '0',
			probability: 0,
			tagIds: ['tag-1'],
			customData: { 'field-1': false },
		});
		expect(options.body).not.toHaveProperty('currency');
		expect(options.body).not.toHaveProperty('organizationId');
	});

	it('aceita associação com empresa ou nenhum vínculo quando o contrato permitir', async () => {
		for (const [associateWith, association] of [
			['organization', { organizationId: 'organization-1' }],
			['none', {}],
		] as const) {
			const { context, request } = contextFor({
				resource: 'deal',
				operation: 'create',
				title: 'Contrato',
				associateWith,
				...(associateWith === 'organization' ? { organizationId: locator('organization-1') } : {}),
				additionalFields: { pipelineId: locator('pipeline-1'), stageId: locator('stage-1') },
			});
			await new TavioCrm().getNodeType(3).execute?.call(context);
			const body = (request.mock.calls[0][1] as IHttpRequestOptions).body;
			expect(body).toMatchObject(association);
			if (associateWith === 'none') {
				expect(body).not.toHaveProperty('contactId');
				expect(body).not.toHaveProperty('organizationId');
			}
		}
	});

	it('não envia uma associação oculta que tenha sido deixada por uma escolha anterior', async () => {
		const { context, request } = contextFor({
			resource: 'deal',
			operation: 'create',
			title: 'Contrato',
			associateWith: 'none',
			contactId: locator('contact-stale'),
			organizationId: locator('organization-stale'),
			additionalFields: { pipelineId: locator('pipeline-1'), stageId: locator('stage-1') },
		});
		await new TavioCrm().getNodeType(3).execute?.call(context);
		const body = (request.mock.calls[0][1] as IHttpRequestOptions).body;
		expect(body).not.toHaveProperty('contactId');
		expect(body).not.toHaveProperty('organizationId');
	});

	it('orienta o usuário quando os campos obrigatórios dentro da coleção não foram adicionados', async () => {
		const { context, request } = contextFor({
			resource: 'deal',
			operation: 'create',
			title: 'Contrato',
			associateWith: 'none',
			additionalFields: {},
		});
		await expect(new TavioCrm().getNodeType(3).execute?.call(context)).rejects.toThrow(
			'Adicione Funil e Etapa em Campos adicionais',
		);
		expect(request).not.toHaveBeenCalled();
	});
});
