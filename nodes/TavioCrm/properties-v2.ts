/* eslint-disable n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-option-name-wrong-for-upsert, n8n-nodes-base/node-param-description-wrong-for-upsert, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options, n8n-nodes-base/node-param-description-missing-from-dynamic-options, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options, n8n-nodes-base/node-param-description-missing-from-dynamic-multi-options, n8n-nodes-base/node-param-description-boolean-without-whether, n8n-nodes-base/node-param-description-excess-final-period, n8n-nodes-base/node-param-description-wrong-for-return-all -- A interface deste node privado é localizada em português. */
import type { INodeProperties } from 'n8n-workflow';

const bodyOperations = ['create', 'update', 'upsert'];
const listOperations = ['getMany', 'search'];

const show = (resource: string | string[], operation?: string | string[]) => ({
	show: {
		resource: Array.isArray(resource) ? resource : [resource],
		...(operation ? { operation: Array.isArray(operation) ? operation : [operation] } : {}),
	},
});

const operation = (
	resource: string,
	options: Array<{ name: string; value: string; action: string; description: string }>,
	defaultValue: string,
): INodeProperties => ({
	displayName: 'Operação',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: show(resource),
	options,
	default: defaultValue,
});

const crud = (noun: string, upsert = false) => [
	{ name: 'Criar', value: 'create', action: `Criar ${noun}`, description: `Cria ${noun}` },
	{ name: 'Obter', value: 'get', action: `Obter ${noun}`, description: `Obtém ${noun} por ID` },
	{
		name: 'Obter Muitos',
		value: 'getMany',
		action: `Obter muitos ${noun}`,
		description: `Lista ${noun}`,
	},
	{
		name: 'Pesquisar',
		value: 'search',
		action: `Pesquisar ${noun}`,
		description: `Pesquisa ${noun}`,
	},
	{
		name: 'Atualizar',
		value: 'update',
		action: `Atualizar ${noun}`,
		description: `Atualiza ${noun}`,
	},
	...(upsert
		? [
				{
					name: 'Criar ou Atualizar',
					value: 'upsert',
					action: `Criar ou atualizar ${noun}`,
					description: `Cria ou atualiza ${noun} por uma chave de correspondência`,
				},
			]
		: []),
];

const locator = (
	displayName: string,
	name: string,
	searchListMethod: string,
	displayOptions: INodeProperties['displayOptions'],
	required = false,
	loadOptionsDependsOn: string[] = [],
): INodeProperties => ({
	displayName,
	name,
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	...(required ? { required: true } : {}),
	displayOptions,
	modes: [
		{
			displayName: 'Selecionar na lista',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod,
				searchable: true,
				...(loadOptionsDependsOn.length ? { loadOptionsDependsOn } : {}),
			},
		},
		{ displayName: 'Informar ID', name: 'id', type: 'string' },
	],
});

const text = (
	displayName: string,
	name: string,
	displayOptions: INodeProperties['displayOptions'],
	options: Partial<INodeProperties> = {},
): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	default: '',
	displayOptions,
	...options,
});

const number = (
	displayName: string,
	name: string,
	displayOptions: INodeProperties['displayOptions'],
	options: Partial<INodeProperties> = {},
): INodeProperties => ({
	displayName,
	name,
	type: 'number',
	default: 0,
	displayOptions,
	...options,
});

const options = (
	displayName: string,
	name: string,
	displayOptions: INodeProperties['displayOptions'],
	values: Array<{ name: string; value: string }>,
	defaultValue = '',
): INodeProperties => ({
	displayName,
	name,
	type: 'options',
	options: values,
	default: defaultValue,
	displayOptions,
});

const customFields: INodeProperties = {
	displayName: 'Campos personalizados',
	name: 'customFields',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	displayOptions: show(['contact', 'organization', 'lead', 'deal', 'product'], bodyOperations),
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
						'Use texto, número, data, booleano ou uma expressão do n8n conforme o tipo do campo.',
				},
			],
		},
	],
};

const tags: INodeProperties = {
	displayName: 'Tags',
	name: 'tagIds',
	type: 'multiOptions',
	default: [],
	typeOptions: { loadOptionsMethod: 'getTags', loadOptionsDependsOn: ['resource'] },
	displayOptions: show(['contact', 'organization', 'lead', 'deal', 'product'], bodyOperations),
};

const address: INodeProperties = {
	displayName: 'Endereço',
	name: 'address',
	type: 'collection',
	default: {},
	displayOptions: show(['contact', 'organization'], bodyOperations),
	options: [
		text('Rua', 'street', undefined),
		text('Número', 'number', undefined),
		text('Complemento', 'complement', undefined),
		text('Cidade', 'city', undefined),
		text('Estado', 'state', undefined),
		text('CEP', 'postalCode', undefined),
		text('País', 'country', undefined),
	],
};

const emails: INodeProperties = {
	displayName: 'E-mails',
	name: 'emails',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	displayOptions: show(['contact', 'organization'], bodyOperations),
	options: [
		{
			name: 'values',
			displayName: 'E-mail',
			values: [
				text('E-mail', 'email', undefined, { required: true }),
				text('Rótulo', 'label', undefined),
				{ displayName: 'Principal', name: 'primary', type: 'boolean', default: false },
			],
		},
	],
};

const phones: INodeProperties = {
	displayName: 'Telefones',
	name: 'phones',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	displayOptions: show(['contact', 'organization'], bodyOperations),
	options: [
		{
			name: 'values',
			displayName: 'Telefone',
			values: [
				text('Telefone', 'phone', undefined, { required: true }),
				text('Rótulo', 'label', undefined),
				{ displayName: 'Principal', name: 'primary', type: 'boolean', default: false },
			],
		},
	],
};

const lifecycleId = (resource: string, operations: string[]) =>
	locator(
		`${resource === 'organization' ? 'Empresa' : resource === 'contact' ? 'Contato' : resource === 'lead' ? 'Lead' : resource === 'deal' ? 'Negócio' : resource === 'activity' ? 'Atividade' : 'Produto'}`,
		'id',
		resource === 'activity'
			? 'getActivities'
			: `get${resource[0].toUpperCase()}${resource.slice(1)}s`,
		show(resource, operations),
		true,
	);

export const tavioCrmV2Properties: INodeProperties[] = [
	{
		displayName: 'Recurso',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Atividade', value: 'activity' },
			{ name: 'Contato', value: 'contact' },
			{ name: 'Empresa', value: 'organization' },
			{ name: 'Funil', value: 'pipeline' },
			{ name: 'Lead', value: 'lead' },
			{ name: 'Negócio', value: 'deal' },
			{ name: 'Nota', value: 'note' },
			{ name: 'Produto', value: 'product' },
			{ name: 'Requisição Avançada', value: 'advanced' },
			{ name: 'Tag', value: 'tag' },
		],
		default: 'contact',
	},
	operation(
		'contact',
		[
			...crud('um contato', true),
			{
				name: 'Arquivar',
				value: 'archive',
				action: 'Arquivar um contato',
				description: 'Arquiva o contato',
			},
			{
				name: 'Restaurar',
				value: 'restore',
				action: 'Restaurar um contato',
				description: 'Restaura o contato',
			},
		],
		'create',
	),
	operation(
		'organization',
		[
			...crud('uma empresa', true),
			{
				name: 'Arquivar',
				value: 'archive',
				action: 'Arquivar uma empresa',
				description: 'Arquiva a empresa',
			},
			{
				name: 'Restaurar',
				value: 'restore',
				action: 'Restaurar uma empresa',
				description: 'Restaura a empresa',
			},
		],
		'create',
	),
	operation(
		'lead',
		[
			...crud('um lead'),
			{
				name: 'Arquivar',
				value: 'archive',
				action: 'Arquivar um lead',
				description: 'Arquiva o lead',
			},
			{
				name: 'Restaurar',
				value: 'restore',
				action: 'Restaurar um lead',
				description: 'Restaura o lead',
			},
			{
				name: 'Qualificar',
				value: 'qualify',
				action: 'Qualificar um lead',
				description: 'Qualifica o lead',
			},
			{
				name: 'Desqualificar',
				value: 'disqualify',
				action: 'Desqualificar um lead',
				description: 'Desqualifica o lead com motivo opcional',
			},
			{
				name: 'Converter',
				value: 'convert',
				action: 'Converter um lead',
				description: 'Converte o lead em negócio',
			},
		],
		'create',
	),
	operation(
		'deal',
		[
			...crud('um negócio'),
			{
				name: 'Adicionar Produto',
				value: 'addProduct',
				action: 'Adicionar produto ao negócio',
				description: 'Adiciona um item ao negócio',
			},
			{
				name: 'Marcar Como Ganho',
				value: 'won',
				action: 'Marcar negócio como ganho',
				description: 'Fecha como ganho',
			},
			{
				name: 'Marcar Como Perdido',
				value: 'lost',
				action: 'Marcar negócio como perdido',
				description: 'Fecha como perdido',
			},
			{
				name: 'Mover',
				value: 'move',
				action: 'Mover um negócio',
				description: 'Move para outra etapa',
			},
			{
				name: 'Reabrir',
				value: 'reopen',
				action: 'Reabrir um negócio',
				description: 'Reabre o negócio',
			},
			{
				name: 'Arquivar',
				value: 'archive',
				action: 'Arquivar um negócio',
				description: 'Arquiva o negócio',
			},
			{
				name: 'Restaurar',
				value: 'restore',
				action: 'Restaurar um negócio',
				description: 'Restaura o negócio',
			},
		],
		'create',
	),
	operation(
		'activity',
		[
			{
				name: 'Criar',
				value: 'create',
				action: 'Criar uma atividade',
				description: 'Cria uma atividade',
			},
			{ name: 'Obter', value: 'get', action: 'Obter uma atividade', description: 'Obtém por ID' },
			{
				name: 'Obter Muitas',
				value: 'getMany',
				action: 'Obter muitas atividades',
				description: 'Lista atividades',
			},
			{
				name: 'Atualizar',
				value: 'update',
				action: 'Atualizar uma atividade',
				description: 'Atualiza uma atividade',
			},
			{
				name: 'Concluir',
				value: 'complete',
				action: 'Concluir uma atividade',
				description: 'Marca como concluída',
			},
		],
		'create',
	),
	operation(
		'note',
		[
			{
				name: 'Criar',
				value: 'create',
				action: 'Criar uma nota',
				description: 'Cria uma nota vinculada',
			},
		],
		'create',
	),
	operation(
		'product',
		[
			{
				name: 'Criar',
				value: 'create',
				action: 'Criar um produto',
				description: 'Cria produto ou serviço',
			},
			{ name: 'Obter', value: 'get', action: 'Obter um produto', description: 'Obtém por ID' },
			{
				name: 'Obter Muitos',
				value: 'getMany',
				action: 'Obter muitos produtos',
				description: 'Lista produtos',
			},
			{
				name: 'Atualizar',
				value: 'update',
				action: 'Atualizar um produto',
				description: 'Atualiza produto ou serviço',
			},
		],
		'create',
	),
	operation(
		'pipeline',
		[
			{
				name: 'Obter Muitos',
				value: 'getMany',
				action: 'Obter muitos funis',
				description: 'Lista funis',
			},
			{
				name: 'Obter Etapas',
				value: 'getStages',
				action: 'Obter etapas do funil',
				description: 'Lista etapas do funil selecionado',
			},
		],
		'getMany',
	),
	operation(
		'tag',
		[
			{
				name: 'Adicionar Ao Item',
				value: 'add',
				action: 'Adicionar tag ao item',
				description: 'Adiciona uma tag',
			},
			{
				name: 'Obter Muitas',
				value: 'getMany',
				action: 'Obter muitas tags',
				description: 'Lista tags',
			},
			{
				name: 'Remover Do Item',
				value: 'remove',
				action: 'Remover tag do item',
				description: 'Remove uma tag',
			},
		],
		'getMany',
	),
	operation(
		'advanced',
		[
			{
				name: 'Executar',
				value: 'request',
				action: 'Executar requisição avançada',
				description: 'Executa uma requisição na origem da credencial',
			},
		],
		'request',
	),

	// Identificadores para leitura e lifecycle.
	lifecycleId('contact', ['get', 'update', 'archive', 'restore']),
	lifecycleId('organization', ['get', 'update', 'archive', 'restore']),
	lifecycleId('lead', ['get', 'update', 'archive', 'restore', 'qualify', 'disqualify', 'convert']),
	lifecycleId('deal', [
		'get',
		'update',
		'addProduct',
		'won',
		'lost',
		'reopen',
		'move',
		'archive',
		'restore',
	]),
	lifecycleId('activity', ['get', 'update', 'complete']),
	lifecycleId('product', ['get', 'update']),
	locator('Funil', 'pipelineId', 'getPipelines', show('pipeline', 'getStages'), true),

	// Contato.
	text('Nome', 'firstName', show('contact', ['create', 'update', 'upsert']), {
		required: true,
		placeholder: 'Maria',
	}),
	text('Sobrenome', 'lastName', show('contact', ['create', 'update', 'upsert'])),
	text('Cargo', 'jobTitle', show('contact', ['create', 'update', 'upsert'])),
	locator(
		'Empresa',
		'organizationId',
		'getOrganizations',
		show('contact', ['create', 'update', 'upsert']),
	),
	text('Origem', 'source', show('contact', ['create', 'update', 'upsert'])),
	emails,
	phones,
	text('Observações', 'notes', show('contact', ['create', 'update', 'upsert']), {
		typeOptions: { rows: 4 },
	}),
	text(
		'Preferência de contato',
		'contactPreference',
		show('contact', ['create', 'update', 'upsert']),
	),
	locator(
		'Responsável',
		'ownerId',
		'getUsers',
		show(['contact', 'organization', 'lead', 'deal', 'activity'], bodyOperations),
	),
	locator(
		'Equipe',
		'teamId',
		'getTeams',
		show(['contact', 'organization', 'lead', 'deal', 'activity'], bodyOperations),
	),
	options(
		'Correspondência',
		'upsertBy',
		show('contact', 'upsert'),
		[
			{ name: 'E-mail', value: 'email' },
			{ name: 'External ID', value: 'externalId' },
			{ name: 'Telefone', value: 'phone' },
		],
		'email',
	),
	text('E-mail para correspondência', 'matchEmail', show('contact', 'upsert'), {
		required: true,
		displayOptions: show('contact', 'upsert'),
	}),
	text(
		'External ID',
		'externalId',
		show(['contact', 'lead', 'deal'], ['create', 'update', 'upsert']),
		{ description: 'Identificador estável no sistema de origem' },
	),
	text(
		'Telefone para correspondência',
		'matchPhone',
		{ show: { resource: ['contact'], operation: ['upsert'], upsertBy: ['phone'] } },
		{ required: true },
	),

	// Empresa.
	text('Nome', 'name', show('organization', ['create', 'update', 'upsert']), {
		required: true,
		placeholder: 'Acme Ltda',
	}),
	text('Nome fantasia', 'tradeName', show('organization', ['create', 'update', 'upsert'])),
	text('Documento', 'document', show('organization', ['create', 'update', 'upsert'])),
	text('Setor', 'industry', show('organization', ['create', 'update', 'upsert'])),
	text('Porte', 'size', show('organization', ['create', 'update', 'upsert'])),
	text('Website', 'website', show('organization', ['create', 'update', 'upsert']), {
		placeholder: 'https://exemplo.com.br',
	}),
	address,
	text('Origem', 'source', show('organization', ['create', 'update', 'upsert'])),
	text('Observações', 'notes', show('organization', ['create', 'update', 'upsert']), {
		typeOptions: { rows: 4 },
	}),
	// Lead.
	text('Título', 'title', show('lead', ['create', 'update']), {
		required: true,
		placeholder: 'Renovação do contrato',
	}),
	locator('Contato', 'contactId', 'getContacts', show('lead', ['create', 'update'])),
	locator('Empresa', 'organizationId', 'getOrganizations', show('lead', ['create', 'update'])),
	text('Valor estimado', 'estimatedValue', show('lead', ['create', 'update']), {
		placeholder: '12500.00',
	}),
	options(
		'Moeda',
		'currency',
		show('lead', ['create', 'update']),
		[
			{ name: 'BRL', value: 'BRL' },
			{ name: 'USD', value: 'USD' },
			{ name: 'EUR', value: 'EUR' },
		],
		'BRL',
	),
	text('Origem', 'source', show('lead', ['create', 'update'])),
	text('Descrição', 'description', show('lead', ['create', 'update']), {
		typeOptions: { rows: 4 },
	}),
	text('Data prevista', 'expectedAt', show('lead', ['create', 'update']), { type: 'dateTime' }),
	text('Motivo', 'reason', show('lead', 'disqualify'), { required: true }),
	text('Observação', 'note', show('lead', 'disqualify'), { typeOptions: { rows: 3 } }),
	locator('Funil', 'pipelineId', 'getPipelines', show('lead', 'convert')),
	locator('Etapa', 'stageId', 'getStages', show('lead', 'convert'), true, ['pipelineId']),

	// Negócio.
	text('Título', 'title', show('deal', ['create', 'update']), {
		required: true,
		placeholder: 'Renovação Acme',
	}),
	locator('Contato', 'contactId', 'getContacts', show('deal', ['create', 'update'])),
	locator('Empresa', 'organizationId', 'getOrganizations', show('deal', ['create', 'update'])),
	text('Valor', 'value', show('deal', ['create', 'update']), { placeholder: '25000.00' }),
	options(
		'Moeda',
		'currency',
		show('deal', ['create', 'update']),
		[
			{ name: 'BRL', value: 'BRL' },
			{ name: 'USD', value: 'USD' },
			{ name: 'EUR', value: 'EUR' },
		],
		'BRL',
	),
	number('Probabilidade (%)', 'probability', show('deal', ['create', 'update']), {
		typeOptions: { minValue: 0, maxValue: 100 },
	}),
	locator('Funil', 'pipelineId', 'getPipelines', show('deal', ['create', 'update', 'move'])),
	locator('Etapa', 'stageId', 'getStages', show('deal', ['create', 'update', 'move']), false, [
		'pipelineId',
	]),
	text('Data prevista de fechamento', 'expectedCloseAt', show('deal', ['create', 'update']), {
		type: 'dateTime',
	}),
	text('Origem', 'source', show('deal', ['create', 'update'])),
	text('Observações', 'notes', show('deal', ['create', 'update']), { typeOptions: { rows: 4 } }),
	text('Descrição do produto', 'itemDescription', show('deal', 'addProduct'), { required: true }),
	number('Quantidade', 'quantity', show('deal', 'addProduct'), {
		required: true,
		typeOptions: { minValue: 0.0001 },
	}),
	text('Preço unitário', 'unitPrice', show('deal', 'addProduct'), { required: true }),
	text('Desconto', 'discountValue', show('deal', 'addProduct')),
	text('Taxa de desconto', 'discountRate', show('deal', 'addProduct')),
	text('Observação do item', 'itemNote', show('deal', 'addProduct')),
	locator('Produto', 'productId', 'getProducts', show('deal', 'addProduct')),
	text('Motivo da perda', 'lostReason', show('deal', 'lost'), { required: true }),

	// Atividade.
	text('Assunto', 'title', show('activity', ['create', 'update']), { required: true }),
	text('Descrição', 'description', show('activity', ['create', 'update']), {
		typeOptions: { rows: 4 },
	}),
	text('Tipo', 'type', show('activity', ['create', 'update']), {
		required: true,
		placeholder: 'MEETING',
	}),
	text('Data e hora', 'dueAt', show('activity', ['create', 'update']), {
		type: 'dateTime',
		required: true,
	}),
	number('Duração (minutos)', 'durationMinutes', show('activity', ['create', 'update']), {
		typeOptions: { minValue: 1, maxValue: 1440 },
	}),
	options(
		'Prioridade',
		'priority',
		show('activity', ['create', 'update']),
		[
			{ name: 'Baixa', value: 'LOW' },
			{ name: 'Normal', value: 'NORMAL' },
			{ name: 'Alta', value: 'HIGH' },
			{ name: 'Urgente', value: 'URGENT' },
		],
		'NORMAL',
	),
	text('Lembrete', 'reminderAt', show('activity', ['create', 'update']), { type: 'dateTime' }),
	locator('Contato', 'contactId', 'getContacts', show('activity', ['create', 'update'])),
	locator('Empresa', 'organizationId', 'getOrganizations', show('activity', ['create', 'update'])),
	locator('Lead', 'leadId', 'getLeads', show('activity', ['create', 'update'])),
	locator('Negócio', 'dealId', 'getDeals', show('activity', ['create', 'update'])),
	text('Resultado', 'result', show('activity', 'complete'), { typeOptions: { rows: 3 } }),

	// Produto.
	text('Nome', 'name', show('product', ['create', 'update']), { required: true }),
	options(
		'Tipo',
		'type',
		show('product', ['create', 'update']),
		[
			{ name: 'Produto', value: 'PRODUCT' },
			{ name: 'Serviço', value: 'SERVICE' },
		],
		'PRODUCT',
	),
	text('Código', 'code', show('product', ['create', 'update'])),
	text('Categoria', 'category', show('product', ['create', 'update'])),
	text('Descrição', 'description', show('product', ['create', 'update']), {
		typeOptions: { rows: 4 },
	}),
	text('Preço padrão', 'defaultPrice', show('product', ['create', 'update']), { required: true }),
	options(
		'Moeda',
		'currency',
		show('product', ['create', 'update']),
		[
			{ name: 'BRL', value: 'BRL' },
			{ name: 'USD', value: 'USD' },
			{ name: 'EUR', value: 'EUR' },
		],
		'BRL',
	),
	text('Unidade', 'unit', show('product', ['create', 'update']), { required: true, default: 'un' }),
	{
		displayName: 'Recorrente',
		name: 'recurring',
		type: 'boolean',
		default: false,
		displayOptions: show('product', ['create', 'update']),
	},
	options('Periodicidade', 'recurrencePeriod', show('product', ['create', 'update']), [
		{ name: 'Semanal', value: 'WEEKLY' },
		{ name: 'Mensal', value: 'MONTHLY' },
		{ name: 'Trimestral', value: 'QUARTERLY' },
		{ name: 'Anual', value: 'YEARLY' },
	]),
	{
		displayName: 'Ativo',
		name: 'active',
		type: 'boolean',
		default: true,
		displayOptions: show('product', 'update'),
	},
	// Coleções compartilhadas entram uma única vez. Repeti-las dentro de cada
	// grupo de recurso fazia todas as cópias aparecerem ao mesmo tempo na v2.
	customFields,
	tags,

	// Nota e tags.
	options(
		'Tipo de entidade',
		'entityType',
		show('note', 'create'),
		[
			{ name: 'Contato', value: 'contact' },
			{ name: 'Empresa', value: 'organization' },
			{ name: 'Lead', value: 'lead' },
			{ name: 'Negócio', value: 'deal' },
		],
		'contact',
	),
	text('ID da entidade', 'entityId', show('note', 'create'), { required: true }),
	text('Conteúdo', 'content', show('note', 'create'), { required: true, typeOptions: { rows: 4 } }),
	options(
		'Tipo de entidade',
		'entityType',
		show('tag', ['add', 'remove']),
		[
			{ name: 'Contato', value: 'contact' },
			{ name: 'Empresa', value: 'organization' },
			{ name: 'Lead', value: 'lead' },
			{ name: 'Negócio', value: 'deal' },
			{ name: 'Produto', value: 'product' },
		],
		'contact',
	),
	text('ID da entidade', 'entityId', show('tag', ['add', 'remove']), { required: true }),
	{
		...options('Tag', 'tagId', show('tag', ['add', 'remove']), [], ''),
		typeOptions: { loadOptionsMethod: 'getTags' },
	},

	// Pesquisa, paginação e controle de concorrência.
	text('Pesquisar', 'search', { show: { operation: listOperations } }),
	{
		displayName: 'Retornar todos',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: listOperations } },
		description: 'Percorre automaticamente todas as páginas.',
	},
	number(
		'Limite',
		'limit',
		{ show: { operation: listOperations, returnAll: [false] } },
		{ default: 50, typeOptions: { minValue: 1, maxValue: 10000 } },
	),
	text(
		'Versão',
		'version',
		{
			show: {
				operation: ['update', 'archive', 'restore', 'convert', 'move', 'won', 'lost', 'reopen'],
			},
		},
		{ type: 'number', default: 1, required: true, typeOptions: { minValue: 1 } },
	),
	text('Atualizado em', 'updatedAt', show(['activity', 'product'], 'update'), {
		type: 'dateTime',
		required: true,
	}),
	{
		displayName: 'Opções avançadas',
		name: 'options',
		type: 'collection',
		default: {},
		displayOptions: { hide: { resource: ['advanced'] } },
		options: [
			{
				displayName: 'Idempotência',
				name: 'idempotencyMode',
				type: 'options',
				options: [
					{ name: 'Automática', value: 'automatic' },
					{ name: 'Personalizada', value: 'custom' },
					{ name: 'Desativada', value: 'disabled' },
				],
				default: 'automatic',
				description:
					'Evita que a mesma operação crie registros duplicados quando uma execução é repetida.',
			},
			{
				displayName: 'Chave personalizada',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				displayOptions: { show: { idempotencyMode: ['custom'] } },
			},
			{
				displayName: 'ID externo',
				name: 'externalId',
				type: 'string',
				default: '',
				description: 'Identificador de negócio no sistema de origem.',
			},
			{
				displayName: 'Simplificar saída',
				name: 'simplifyOutput',
				type: 'boolean',
				default: true,
				description: 'Retorna somente os dados principais da resposta.',
			},
		],
	},

	// Requisição avançada: o único recurso com JSON como entrada central.
	options(
		'Método',
		'method',
		show('advanced', 'request'),
		[
			{ name: 'GET', value: 'GET' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'DELETE', value: 'DELETE' },
		],
		'GET',
	),
	text('Caminho relativo', 'path', show('advanced', 'request'), {
		required: true,
		default: '/',
		placeholder: '/contacts',
	}),
	{
		displayName: 'Parâmetros de consulta (JSON)',
		name: 'query',
		type: 'json',
		default: '{}',
		displayOptions: show('advanced', 'request'),
	},
	{
		displayName: 'Corpo JSON',
		name: 'body',
		type: 'json',
		default: '{}',
		displayOptions: show('advanced', 'request'),
	},
];
