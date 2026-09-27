import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';

function applies(values: unknown, value: string): boolean {
	return !Array.isArray(values) || values.includes(value);
}

function visibleProperties(
	properties: INodeProperties[],
	resource: string,
	operation: string,
): INodeProperties[] {
	return properties.filter((property) => {
		const show = property.displayOptions?.show;
		const hide = property.displayOptions?.hide;
		if (show && (!applies(show.resource, resource) || !applies(show.operation, operation)))
			return false;
		return !(hide && applies(hide.resource, resource) && applies(hide.operation, operation));
	});
}

describe('UX visual sem propriedades duplicadas', () => {
	it('mantém uma única propriedade por nome em cada recurso e operação da v2 e v3', () => {
		const node = new TavioCrm();
		for (const version of [2, 3]) {
			const properties = node.getNodeType(version).description.properties;
			for (const operationProperty of properties.filter(
				(property) => property.name === 'operation',
			)) {
				const resource = (operationProperty.displayOptions?.show?.resource as string[])[0];
				for (const option of operationProperty.options as Array<{ value: string }>) {
					const visible = visibleProperties(properties, resource, option.value).filter(
						(property) => property.name !== 'resource' && property.name !== 'operation',
					);
					const names = visible.map((property) => property.name);
					expect(
						new Set(names).size,
						`${version}:${resource}:${option.value}: ${names.join(', ')}`,
					).toBe(names.length);
					const usesCollection = version === 3 && resource === 'deal' && option.value === 'create';
					const expectedCollections =
						['contact', 'organization', 'lead', 'deal', 'product'].includes(resource) &&
						['create', 'update', 'upsert'].includes(option.value) &&
						!usesCollection
							? 1
							: 0;
					expect(visible.filter((property) => property.name === 'tagIds')).toHaveLength(
						expectedCollections,
					);
					expect(visible.filter((property) => property.name === 'customFields')).toHaveLength(
						expectedCollections,
					);
				}
			}
		}
	});

	it('apresenta Negócio > Criar de forma compacta na v3, sem exemplos como defaults', () => {
		const properties = new TavioCrm().getNodeType(3).description.properties;
		const visible = visibleProperties(properties, 'deal', 'create');
		expect(visible.map((property) => property.name)).toEqual(
			expect.arrayContaining(['title', 'associateWith', 'additionalFields']),
		);
		expect(visible.filter((property) => property.name === 'title')[0].default).toBe('');
		expect(visible.filter((property) => property.name === 'additionalFields')).toHaveLength(1);
		expect(visible.filter((property) => property.name === 'tagIds')).toHaveLength(0);
		expect(visible.filter((property) => property.name === 'customFields')).toHaveLength(0);
		expect(JSON.stringify(visible)).not.toContain('Renovação Acme');
		expect(JSON.stringify(visible)).not.toContain('25000.00');
	});

	it('exige classificação explícita de origem e emissor e não sugere título fictício na v3', () => {
		const node = new TavioCrm();
		const v3 = node.getNodeType(3).description.properties;
		const inbound = visibleProperties(v3, 'attendance', 'inbound');
		const firstResponse = visibleProperties(v3, 'attendance', 'firstResponse');
		const leadCreate = visibleProperties(v3, 'lead', 'create');
		const source = inbound.find((property) => property.name === 'source');
		const responderKind = firstResponse.find((property) => property.name === 'responderKind');
		const title = leadCreate.find((property) => property.name === 'title');

		expect(source).toMatchObject({ default: '', required: true });
		expect(responderKind).toMatchObject({ default: '', required: true });
		expect(title).toMatchObject({ default: '', placeholder: 'Informe o título do lead' });
		expect(
			node
				.getNodeType(2)
				.description.properties.find(
					(property) =>
						property.name === 'title' && property.displayOptions?.show?.resource?.includes('lead'),
				)?.placeholder,
		).toBe('Renovação do contrato');
	});
});
