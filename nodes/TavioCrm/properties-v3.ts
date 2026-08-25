/* eslint-disable n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options, n8n-nodes-base/node-param-description-missing-from-dynamic-options, n8n-nodes-base/node-param-collection-type-unsorted-items, n8n-nodes-base/node-param-description-excess-final-period, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options, n8n-nodes-base/node-param-description-missing-from-dynamic-multi-options -- A interface deste node privado é localizada em português e Campos adicionais mantém ordem de negócio, não alfabética. */
import type { INodeProperties } from 'n8n-workflow';
import { tavioCrmV2Properties } from './properties-v2';

const dealCreate = { show: { resource: ['deal'], operation: ['create'] } };

const locator = (
	displayName: string,
	name: string,
	searchListMethod: string,
	required = false,
	dependsOn: string[] = [],
): INodeProperties => ({
	displayName,
	name,
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	...(required ? { required: true } : {}),
	modes: [
		{
			displayName: 'Selecionar na lista',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod,
				searchable: true,
				...(dependsOn.length ? { loadOptionsDependsOn: dependsOn } : {}),
			},
		},
		{ displayName: 'Informar ID', name: 'id', type: 'string' },
	],
});

const customFields: INodeProperties = {
	displayName: 'Campos personalizados',
	name: 'customFields',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	options: [
		{
			name: 'values',
			displayName: 'Campo',
			values: [
				{
					displayName: 'Campo',
					name: 'fieldId',
					type: 'options',
					typeOptions: { loadOptionsMethod: 'getCustomFields', loadOptionsDependsOn: ['resource'] },
					default: '',
					required: true,
				},
				{
					displayName: 'Valor',
					name: 'value',
					type: 'string',
					default: '',
					description:
						'Informe texto ou uma expressão. Valores JSON válidos (número, booleano ou lista) são convertidos antes do envio e validados pelo CRM.',
				},
			],
		},
	],
};

const dealAdditionalFields: INodeProperties = {
	displayName: 'Campos adicionais',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Adicionar campo',
	default: {},
	displayOptions: dealCreate,
	options: [
		{
			displayName: 'Valor',
			name: 'value',
			type: 'string',
			default: '',
			description: 'Valor monetário como string decimal, por exemplo 1250.00.',
		},
		{
			displayName: 'Moeda',
			name: 'currency',
			type: 'options',
			options: [
				{ name: 'BRL', value: 'BRL' },
				{ name: 'USD', value: 'USD' },
				{ name: 'EUR', value: 'EUR' },
			],
			default: 'BRL',
		},
		locator('Funil', 'pipelineId', 'getPipelines', true),
		locator('Etapa', 'stageId', 'getStages', true, ['additionalFields.pipelineId']),
		{
			displayName: 'Data prevista de fechamento',
			name: 'expectedCloseAt',
			type: 'dateTime',
			default: '',
		},
		locator('Responsável', 'ownerId', 'getUsers'),
		locator('Equipe', 'teamId', 'getTeams'),
		{
			displayName: 'Probabilidade (%)',
			name: 'probability',
			type: 'number',
			default: 0,
			typeOptions: { minValue: 0, maxValue: 100 },
		},
		{ displayName: 'Origem', name: 'source', type: 'string', default: '' },
		{
			displayName: 'ID externo',
			name: 'externalId',
			type: 'string',
			default: '',
			description: 'Identificador estável do negócio no sistema de origem.',
		},
		{
			displayName: 'Observações',
			name: 'notes',
			type: 'string',
			default: '',
			typeOptions: { rows: 4 },
		},
		{
			displayName: 'Tags',
			name: 'tagIds',
			type: 'multiOptions',
			default: [],
			typeOptions: { loadOptionsMethod: 'getTags', loadOptionsDependsOn: ['resource'] },
		},
		customFields,
	],
};

const associationFields: INodeProperties[] = [
	{
		displayName: 'Associar a',
		name: 'associateWith',
		type: 'options',
		options: [
			{ name: 'Nenhum', value: 'none' },
			{ name: 'Contato', value: 'contact' },
			{ name: 'Empresa', value: 'organization' },
		],
		default: 'none',
		displayOptions: dealCreate,
		description: 'O Tavio CRM aceita negócios sem associação.',
	},
	{
		...locator('Contato', 'contactId', 'getContacts', true),
		displayOptions: {
			show: { resource: ['deal'], operation: ['create'], associateWith: ['contact'] },
		},
	},
	{
		...locator('Empresa', 'organizationId', 'getOrganizations', true),
		displayOptions: {
			show: { resource: ['deal'], operation: ['create'], associateWith: ['organization'] },
		},
	},
];

function resourceValues(property: INodeProperties): string[] {
	const values = property.displayOptions?.show?.resource;
	return Array.isArray(values) ? (values as string[]) : [];
}

function operationValues(property: INodeProperties): string[] {
	const values = property.displayOptions?.show?.operation;
	return Array.isArray(values) ? (values as string[]) : [];
}

function withDisplayOptions(
	property: INodeProperties,
	resource: string[],
	operation: string[],
): INodeProperties {
	return {
		...property,
		displayOptions: { show: { ...property.displayOptions?.show, resource, operation } },
	};
}

const dealCreateFields = new Set([
	'title',
	'contactId',
	'organizationId',
	'value',
	'currency',
	'probability',
	'pipelineId',
	'stageId',
	'expectedCloseAt',
	'source',
	'notes',
	'externalId',
]);

const sharedFields = new Set(['customFields', 'tagIds', 'ownerId', 'teamId']);

const baseProperties = tavioCrmV2Properties.flatMap((property) => {
	if (sharedFields.has(property.name)) return [];
	const resources = resourceValues(property);
	const operations = operationValues(property);
	if (
		!resources.includes('deal') ||
		!operations.includes('create') ||
		!dealCreateFields.has(property.name)
	) {
		return [property];
	}
	const withoutCreate = operations.filter((operation) => operation !== 'create');
	if (resources.length === 1 && withoutCreate.length === 0) return [];
	if (resources.length === 1) return [withDisplayOptions(property, resources, withoutCreate)];
	return [
		withDisplayOptions(
			property,
			resources.filter((resource) => resource !== 'deal'),
			operations,
		),
	];
});

const sharedV3Fields: INodeProperties[] = [
	{
		...customFields,
		displayOptions: {
			show: {
				resource: ['contact', 'organization', 'lead', 'product'],
				operation: ['create', 'update', 'upsert'],
			},
		},
	},
	{
		displayName: 'Tags',
		name: 'tagIds',
		type: 'multiOptions',
		default: [],
		typeOptions: { loadOptionsMethod: 'getTags', loadOptionsDependsOn: ['resource'] },
		displayOptions: {
			show: {
				resource: ['contact', 'organization', 'lead', 'product'],
				operation: ['create', 'update', 'upsert'],
			},
		},
	},
	{
		...customFields,
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
	},
	{
		displayName: 'Tags',
		name: 'tagIds',
		type: 'multiOptions',
		default: [],
		typeOptions: { loadOptionsMethod: 'getTags', loadOptionsDependsOn: ['resource'] },
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
	},
	{
		...locator('Responsável', 'ownerId', 'getUsers'),
		displayOptions: {
			show: {
				resource: ['contact', 'organization', 'lead', 'activity'],
				operation: ['create', 'update', 'upsert'],
			},
		},
	},
	{
		...locator('Equipe', 'teamId', 'getTeams'),
		displayOptions: {
			show: {
				resource: ['contact', 'organization', 'lead', 'activity'],
				operation: ['create', 'update', 'upsert'],
			},
		},
	},
	{
		...locator('Responsável', 'ownerId', 'getUsers'),
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
	},
	{
		...locator('Equipe', 'teamId', 'getTeams'),
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
	},
	{
		displayName: 'ID externo',
		name: 'externalId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['update'] } },
		description: 'Identificador estável do negócio no sistema de origem.',
	},
];

const resourceAndOperationProperties = baseProperties.filter(
	(property) => property.name === 'resource' || property.name === 'operation',
);

const remainingProperties = baseProperties.filter(
	(property) => property.name !== 'resource' && property.name !== 'operation',
);

export const tavioCrmV3Properties: INodeProperties[] = [
	...resourceAndOperationProperties,
	{
		displayName: 'Título',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		displayOptions: dealCreate,
		description: 'Título do negócio.',
	},
	...associationFields,
	dealAdditionalFields,
	...remainingProperties,
	...sharedV3Fields,
];
