/* eslint-disable n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options, n8n-nodes-base/node-param-description-missing-from-dynamic-options, n8n-nodes-base/node-param-collection-type-unsorted-items, n8n-nodes-base/node-param-description-excess-final-period, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options, n8n-nodes-base/node-param-description-missing-from-dynamic-multi-options -- A interface deste node privado é localizada em português e Campos adicionais mantém ordem de negócio, não alfabética. */
/* eslint-disable n8n-nodes-base/node-param-option-name-wrong-for-upsert, n8n-nodes-base/node-param-description-wrong-for-upsert, n8n-nodes-base/node-param-options-type-unsorted-items -- O upsert recupera Lead por ID externo sem atualizar; a ordem das operacoes acompanha a jornada de atendimento. */
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

const v3ResourceAndOperationProperties = resourceAndOperationProperties.map((property) => {
	if (property.name === 'resource') {
		return {
			...property,
			options: [...(property.options ?? []), { name: 'Atendimento', value: 'attendance' }],
		};
	}
	if (property.displayOptions?.show?.resource?.includes('lead')) {
		return {
			...property,
			options: [
				...(property.options ?? []),
				{
					name: 'Criar ou localizar',
					value: 'upsert',
					action: 'Criar ou localizar lead',
					description: 'Cria ou recupera lead pelo ID externo estável',
				},
				{
					name: 'Buscar por ID externo',
					value: 'getByExternalId',
					action: 'Buscar lead por ID externo',
					description: 'Recupera um lead pelo identificador externo exato',
				},
				{
					name: 'Listar ativos por contato',
					value: 'listActiveByContact',
					action: 'Listar leads ativos por contato',
					description: 'Consulta leads NEW e QUALIFIED do contato',
				},
			],
		};
	}
	return property;
});

const attendanceOperations: INodeProperties = {
	displayName: 'Operação',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['attendance'] } },
	options: [
		{
			name: 'Registrar entrada',
			value: 'inbound',
			action: 'Registrar entrada de atendimento',
			description: 'Cria ou localiza episódio pela mensagem recebida',
		},
		{
			name: 'Obter',
			value: 'get',
			action: 'Obter atendimento',
			description: 'Consulta atendimento e histórico',
		},
		{
			name: 'Vincular',
			value: 'link',
			action: 'Vincular atendimento',
			description: 'Vincula contato, lead ou responsável com versão',
		},
		{
			name: 'Encaminhar',
			value: 'handoff',
			action: 'Encaminhar atendimento',
			description: 'Marca passagem à fila humana',
		},
		{
			name: 'Registrar primeira resposta',
			value: 'firstResponse',
			action: 'Registrar primeira resposta',
			description: 'Marca resposta elegível de agente humano',
		},
		{
			name: 'Encerrar',
			value: 'close',
			action: 'Encerrar atendimento',
			description: 'Encerra episódio com motivo sem alterar o lead',
		},
	],
	default: 'inbound',
};

const attendanceField = (
	displayName: string,
	name: string,
	operations: string[],
	required = false,
	type: INodeProperties['type'] = 'string',
): INodeProperties => ({
	displayName,
	name,
	type,
	default: type === 'number' ? 1 : '',
	required,
	displayOptions: { show: { resource: ['attendance'], operation: operations } },
});

const attendanceProperties: INodeProperties[] = [
	attendanceOperations,
	attendanceField(
		'ID do atendimento',
		'attendanceId',
		['get', 'link', 'handoff', 'firstResponse', 'close'],
		true,
	),
	attendanceField('Conta Chatwoot', 'chatwootAccountId', ['inbound'], true),
	attendanceField('Conversa Chatwoot', 'chatwootConversationId', ['inbound'], true),
	attendanceField('Mensagem recebida', 'messageId', ['inbound'], true),
	attendanceField('Inbox Chatwoot', 'inboxId', ['inbound']),
	attendanceField('Canal', 'channel', ['inbound'], true),
	attendanceField(
		'Horário do evento',
		'occurredAt',
		['inbound', 'handoff', 'firstResponse', 'close'],
		true,
		'dateTime',
	),
	{
		displayName: 'Origem',
		name: 'source',
		type: 'options',
		default: '',
		required: true,
		description: 'Classifique a origem antes de registrar a primeira mensagem.',
		options: [
			{ name: 'WhatsApp orgânico', value: 'whatsapp_organico' },
			{ name: 'WhatsApp campanha', value: 'whatsapp_campanha' },
		],
		displayOptions: { show: { resource: ['attendance'], operation: ['inbound'] } },
	},
	attendanceField('Ref da campanha', 'tvRef', ['inbound']),
	attendanceField('Campanha de origem', 'campaignOrigin', ['inbound']),
	attendanceField('Criativo de origem', 'creativeOrigin', ['inbound']),
	{
		...locator('Contato CRM', 'contactId', 'getContacts'),
		displayOptions: { show: { resource: ['attendance'], operation: ['inbound', 'link'] } },
	},
	{
		displayName: 'Estado inicial',
		name: 'initialStatus',
		type: 'options',
		default: 'EM_TRIAGEM',
		options: [
			{ name: 'Em triagem', value: 'EM_TRIAGEM' },
			{ name: 'Aguardando atendimento', value: 'AGUARDANDO_ATENDIMENTO' },
		],
		displayOptions: { show: { resource: ['attendance'], operation: ['inbound'] } },
	},
	attendanceField('ID estável do evento', 'eventId', ['handoff', 'firstResponse', 'close'], true),
	attendanceField('Versão', 'attendanceVersion', ['link'], true, 'number'),
	attendanceField('Versão esperada (opcional)', 'expectedVersion', [
		'handoff',
		'firstResponse',
		'close',
	]),
	{
		...locator('Lead CRM', 'leadId', 'getLeads'),
		displayOptions: { show: { resource: ['attendance'], operation: ['link'] } },
	},
	{
		...locator('Responsável CRM', 'ownerId', 'getUsers'),
		displayOptions: { show: { resource: ['attendance'], operation: ['link', 'handoff'] } },
	},
	{
		...locator('Equipe CRM', 'teamId', 'getTeams'),
		displayOptions: { show: { resource: ['attendance'], operation: ['link', 'handoff'] } },
	},
	{
		displayName: 'Tipo de emissor',
		name: 'responderKind',
		type: 'options',
		default: '',
		required: true,
		description: 'Selecione agente humano somente após confirmar quem respondeu.',
		options: [
			{ name: 'Agente humano', value: 'HUMAN_AGENT' },
			{ name: 'Bot', value: 'BOT' },
			{ name: 'API', value: 'API' },
		],
		displayOptions: { show: { resource: ['attendance'], operation: ['firstResponse'] } },
	},
	{
		displayName: 'Nota privada',
		name: 'private',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['attendance'], operation: ['firstResponse'] } },
	},
	attendanceField('Motivo do encerramento', 'reason', ['close'], true),
];

const leadLookupProperties: INodeProperties[] = [
	{
		displayName: 'ID externo',
		name: 'externalId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Identificador estável da oportunidade comercial; repetição devolve o lead existente.',
		displayOptions: { show: { resource: ['lead'], operation: ['upsert'] } },
	},
	{
		displayName: 'ID externo',
		name: 'lookupExternalId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['lead'], operation: ['getByExternalId'] } },
	},
	{
		...locator('Contato CRM', 'lookupContactId', 'getContacts', true),
		displayOptions: { show: { resource: ['lead'], operation: ['listActiveByContact'] } },
	},
];

const remainingProperties = baseProperties
	.filter((property) => property.name !== 'resource' && property.name !== 'operation')
	.map((property) => {
		const shown = property.displayOptions?.show;
		if (property.name === 'title' && shown?.resource?.includes('lead')) {
			return { ...property, placeholder: 'Informe o título do lead' };
		}
		if (property.name === 'externalId' && shown?.resource?.includes('lead')) {
			return {
				...property,
				displayOptions: {
					...property.displayOptions,
					hide: { resource: ['lead'], operation: ['upsert'] },
				},
			};
		}
		if (
			shown?.resource?.includes('lead') &&
			shown.operation?.includes('create') &&
			!shown.operation.includes('upsert')
		) {
			return {
				...property,
				displayOptions: {
					...property.displayOptions,
					show: { ...shown, operation: [...shown.operation, 'upsert'] },
				},
			};
		}
		if (property.name === 'options') {
			return {
				...property,
				displayOptions: { hide: { resource: ['advanced', 'attendance'] } },
			};
		}
		return property;
	});

export const tavioCrmV3Properties: INodeProperties[] = [
	...v3ResourceAndOperationProperties,
	...attendanceProperties,
	...leadLookupProperties,
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
