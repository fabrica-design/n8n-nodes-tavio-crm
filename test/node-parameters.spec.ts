import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';
import { TavioCrmTrigger } from '../nodes/TavioCrm/TavioCrmTrigger.node';

const expectedOperations: Record<string, string[]> = {
	contact: ['archive', 'create', 'get', 'getMany', 'restore', 'search', 'update', 'upsert'],
	organization: ['archive', 'create', 'get', 'getMany', 'restore', 'search', 'update', 'upsert'],
	lead: [
		'archive',
		'convert',
		'create',
		'disqualify',
		'get',
		'getMany',
		'qualify',
		'restore',
		'search',
		'update',
	],
	deal: [
		'addProduct',
		'create',
		'get',
		'getMany',
		'lost',
		'move',
		'reopen',
		'search',
		'update',
		'won',
		'archive',
		'restore',
	],
	activity: ['complete', 'create', 'get', 'getMany', 'update'],
	note: ['create'],
	product: ['create', 'get', 'getMany', 'update'],
	pipeline: ['getMany', 'getStages'],
	tag: ['add', 'getMany', 'remove'],
	advanced: ['request'],
};

describe('parâmetros dos nós', () => {
	it('expõe toda a matriz v2 de recursos e operações sem workspaceId', () => {
		const properties = new TavioCrm().getNodeType(2).description.properties;
		for (const [resource, expected] of Object.entries(expectedOperations)) {
			const property = properties.find(
				(candidate) =>
					candidate.name === 'operation' &&
					(candidate.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
			) as INodeProperties | undefined;
			const values = (property?.options as Array<{ value: string }>)
				.map(({ value }) => value)
				.sort();
			expect(values).toEqual([...expected].sort());
		}
		expect(JSON.stringify(properties)).not.toContain('workspaceId');
	});

	it('declara opções dinâmicas e trigger assinado', () => {
		const serialized = JSON.stringify(new TavioCrm().getNodeType(2).description.properties);
		for (const method of [
			'getPipelines',
			'getStages',
			'getProducts',
			'getTags',
			'getUsers',
			'getTeams',
			'getCustomFields',
		]) {
			expect(serialized).toContain(method);
		}
		const trigger = new TavioCrmTrigger();
		expect(trigger.description.webhooks?.[0]).toMatchObject({ httpMethod: 'POST' });
		expect(trigger.description.credentials?.[0]?.name).toBe('tavioCrmApi');
	});

	it('mantém a descrição v1 com Campos JSON e a v2 visual como padrão', () => {
		const versioned = new TavioCrm();
		const v1 = versioned.getNodeType(1).description.properties;
		const v2 = versioned.getNodeType(2).description.properties;
		expect(versioned.currentVersion).toBe(2);
		expect(JSON.stringify(v1)).toContain('Campos (JSON)');
		expect(JSON.stringify(v1)).toContain('idempotencyKey');
		expect(JSON.stringify(v2)).not.toContain('Campos (JSON)');
		expect(JSON.stringify(v2)).toContain('Opções avançadas');
		expect(JSON.stringify(v2)).toContain('idempotencyMode');
	});

	it('não oculta a entrada JSON da requisição avançada e usa locators na v2', () => {
		const properties = new TavioCrm().getNodeType(2).description.properties;
		const advancedJson = properties.filter(
			(property) =>
				property.type === 'json' && JSON.stringify(property.displayOptions).includes('advanced'),
		);
		expect(advancedJson).toHaveLength(2);
		expect(
			properties.filter((property) => property.type === 'resourceLocator').length,
		).toBeGreaterThan(5);
	});
});
