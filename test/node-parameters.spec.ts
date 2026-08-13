import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';
import { TavioCrmTrigger } from '../nodes/TavioCrm/TavioCrmTrigger.node';

const expectedOperations: Record<string, string[]> = {
	contact: ['create', 'get', 'getMany', 'search', 'update', 'upsert'],
	organization: ['create', 'get', 'getMany', 'search', 'update', 'upsert'],
	lead: ['archive', 'convert', 'create', 'get', 'getMany', 'search', 'update'],
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
	],
	activity: ['complete', 'create', 'get', 'getMany', 'update'],
	note: ['create'],
	product: ['create', 'getMany', 'update'],
	pipeline: ['getMany', 'getStages'],
	tag: ['add', 'getMany', 'remove'],
	advanced: ['request'],
};

describe('parâmetros dos nós', () => {
	it('expõe toda a matriz de recursos e operações sem workspaceId', () => {
		const properties = new TavioCrm().description.properties;
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
		const serialized = JSON.stringify(new TavioCrm().description.properties);
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
});
