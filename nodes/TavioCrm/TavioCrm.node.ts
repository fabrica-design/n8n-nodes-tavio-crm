import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	IHttpRequestMethods,
	JsonObject,
} from 'n8n-workflow';
/* eslint-disable n8n-nodes-base/node-execute-block-wrong-error-thrown -- Load-option helpers normalize their errors with safelyLoadOptions before n8n renders them. */
import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	VersionedNodeType,
} from 'n8n-workflow';
import { tavioCrmV2Properties } from './properties-v2';
import { tavioCrmV3Properties } from './properties-v3';
import { tavioCrmProperties } from './properties';
import {
	asDataObject,
	compactObject,
	getMany,
	parseJsonObject,
	tavioApiRequest,
	unwrapResponse,
	type TavioFunctions,
	type TavioPage,
} from './transport';

const endpoints: Record<string, string> = {
	contact: '/contacts',
	organization: '/organizations',
	lead: '/leads',
	deal: '/deals',
	activity: '/activities',
	product: '/products',
};

function toOptions(
	items: IDataObject[],
	label: (item: IDataObject) => string,
): INodePropertyOptions[] {
	return items
		.map((item) => ({ name: label(item), value: String(item.id) }))
		.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

async function loadArray(
	this: ILoadOptionsFunctions,
	path: string,
	query?: IDataObject,
): Promise<IDataObject[]> {
	const response = await tavioApiRequest.call(this, 'GET', path, undefined, query);
	const data = unwrapResponse<unknown>(response);
	if (Array.isArray(data)) return data as IDataObject[];
	if (typeof data === 'object' && data !== null && 'items' in data) {
		return ((data as { items?: IDataObject[] }).items ?? []) as IDataObject[];
	}
	return [];
}

function errorStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const candidate = error as {
		statusCode?: unknown;
		httpCode?: unknown;
		response?: { status?: unknown; statusCode?: unknown };
	};
	for (const value of [
		candidate.statusCode,
		candidate.httpCode,
		candidate.response?.status,
		candidate.response?.statusCode,
	]) {
		if (typeof value === 'number') return value;
	}
	return undefined;
}

export function formatLoadOptionsError(error: unknown): Error {
	switch (errorStatus(error)) {
		case 401:
			return new Error(
				'Não foi possível carregar opções: a credencial do Tavio CRM é inválida ou expirou.',
			);
		case 403:
			return new Error(
				'Não foi possível carregar opções: a credencial não possui o escopo necessário.',
			);
		case 404:
			return new Error(
				'Não foi possível carregar opções: verifique a URL da API ou a disponibilidade do recurso.',
			);
		case 422:
			return new Error(
				'Não foi possível carregar opções: a configuração do seletor é inválida para este recurso.',
			);
		default:
			return new Error(
				'Não foi possível carregar opções: API indisponível do Tavio CRM. Tente novamente.',
			);
	}
}

async function safelyLoadOptions<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		throw formatLoadOptionsError(error);
	}
}

function entityForCurrentResource(context: ILoadOptionsFunctions): string {
	const resource = getParameterString(context, 'resource', undefined, 'contact');
	const source =
		resource === 'tag' ? getParameterString(context, 'entityType', undefined, 'contact') : resource;
	const entityByResource: Record<string, string> = {
		contact: 'CONTACT',
		organization: 'ORGANIZATION',
		lead: 'LEAD',
		deal: 'DEAL',
		product: 'PRODUCT',
	};
	const entity = entityByResource[source];
	if (!entity) throw new Error('Recurso sem entidade compatível para este seletor.');
	return entity;
}

async function listPage(
	this: ILoadOptionsFunctions,
	path: string,
	label: (item: IDataObject) => string,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const response = await tavioApiRequest.call(this, 'GET', path, undefined, {
		limit: 100,
		...(filter ? { search: filter } : {}),
		...(paginationToken ? { cursor: paginationToken } : {}),
	});
	const page = unwrapResponse<TavioPage>(response);
	if (!page || !Array.isArray(page.items))
		throw new TypeError('Resposta de paginação incompatível');
	return {
		results: toOptions(page.items, label),
		...(page.nextCursor ? { paginationToken: page.nextCursor } : {}),
	};
}

async function getPipelinesOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return toOptions(await loadArray.call(this, '/pipelines'), (item) => String(item.name));
}

async function getStagesOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const pipelines = await loadArray.call(this, '/pipelines');
	const selectedPipeline = getParameterString(this, 'pipelineId', undefined, '');
	return pipelines.flatMap((pipeline) => {
		if (selectedPipeline && String(pipeline.id) !== selectedPipeline) return [];
		const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as IDataObject[]) : [];
		return toOptions(stages, (stage) => `${String(pipeline.name)} — ${String(stage.name)}`);
	});
}

async function getTagsOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return toOptions(
		await loadArray.call(this, '/tags', { entity: entityForCurrentResource(this) }),
		(item) => String(item.name),
	);
}

async function getCustomFieldsOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return toOptions(
		await loadArray.call(this, '/custom-fields', { entity: entityForCurrentResource(this) }),
		(item) => String(item.name),
	);
}

async function getUsersOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return toOptions(await loadArray.call(this, '/workspace/members'), (item) => {
		const user = (item.user ?? {}) as IDataObject;
		return user.email
			? `${String(user.name)} (${String(user.email)})`
			: String(user.name ?? item.id);
	});
}

async function getTeamsOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return toOptions(await loadArray.call(this, '/workspace/teams'), (item) => String(item.name));
}

export class TavioCrmV1 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tavio CRM',
		name: 'tavioCrm',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg, @n8n/community-nodes/icon-prefer-themed-variants -- The official round Tavio asset is a theme-neutral PNG.
		icon: 'file:tavio-crm-icon.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consulta e altera dados do Tavio CRM',
		defaults: { name: 'Tavio CRM' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'tavioCrmApi', required: true }],
		properties: tavioCrmProperties,
	};

	methods = {
		loadOptions: {
			async getPipelines(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getPipelinesOptions.call(this));
			},
			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getStagesOptions.call(this));
			},
			async getProducts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(
							await listPage.call(this, '/products', (item) =>
								item.code ? `${String(item.name)} (${String(item.code)})` : String(item.name),
							)
						).results,
				);
			},
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getTagsOptions.call(this));
			},
			async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getUsersOptions.call(this));
			},
			async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getTeamsOptions.call(this));
			},
			async getCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(() => getCustomFieldsOptions.call(this));
			},
			async getContacts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(
							await listPage.call(this, '/contacts', (item) =>
								String(item.fullName ?? item.firstName ?? item.id),
							)
						).results,
				);
			},
			async getOrganizations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(await listPage.call(this, '/organizations', (item) => String(item.name ?? item.id)))
							.results,
				);
			},
			async getLeads(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(await listPage.call(this, '/leads', (item) => String(item.title ?? item.id))).results,
				);
			},
			async getDeals(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(await listPage.call(this, '/deals', (item) => String(item.title ?? item.id))).results,
				);
			},
			async getActivities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return safelyLoadOptions(
					async () =>
						(await listPage.call(this, '/activities', (item) => String(item.title ?? item.id)))
							.results,
				);
			},
		},
		listSearch: {
			async getContacts(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(
						this,
						'/contacts',
						(item) => String(item.fullName ?? item.firstName ?? item.id),
						filter,
						token,
					),
				);
			},
			async getOrganizations(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(
						this,
						'/organizations',
						(item) => String(item.name ?? item.id),
						filter,
						token,
					),
				);
			},
			async getLeads(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(this, '/leads', (item) => String(item.title ?? item.id), filter, token),
				);
			},
			async getDeals(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(this, '/deals', (item) => String(item.title ?? item.id), filter, token),
				);
			},
			async getActivities(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(
						this,
						'/activities',
						(item) => String(item.title ?? item.id),
						filter,
						token,
					),
				);
			},
			async getProducts(this: ILoadOptionsFunctions, filter?: string, token?: string) {
				return safelyLoadOptions(() =>
					listPage.call(
						this,
						'/products',
						(item) =>
							item.code ? `${String(item.name)} (${String(item.code)})` : String(item.name),
						filter,
						token,
					),
				);
			},
			async getPipelines(this: ILoadOptionsFunctions) {
				return safelyLoadOptions(async () => ({ results: await getPipelinesOptions.call(this) }));
			},
			async getStages(this: ILoadOptionsFunctions) {
				return safelyLoadOptions(async () => ({ results: await getStagesOptions.call(this) }));
			},
			async getUsers(this: ILoadOptionsFunctions) {
				return safelyLoadOptions(async () => ({ results: await getUsersOptions.call(this) }));
			},
			async getTeams(this: ILoadOptionsFunctions) {
				return safelyLoadOptions(async () => ({ results: await getTeamsOptions.call(this) }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputItems = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			try {
				const result = await executeItem.call(this, itemIndex);
				for (const json of result) output.push({ json, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					output.push({
						json: { error: error instanceof Error ? error.message : 'Falha desconhecida' },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (
					typeof error === 'object' &&
					error !== null &&
					('httpCode' in error || 'statusCode' in error)
				) {
					throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}
		return [output];
	}
}

async function executeItem(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const resource = this.getNodeParameter('resource', itemIndex) as string;
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const simplify = resolveSimplifyOutput.call(this, itemIndex);
	const idempotencyKey = resolveIdempotencyKey.call(this, itemIndex, resource, operation);

	if (resource === 'advanced') {
		const method = this.getNodeParameter('method', itemIndex) as IHttpRequestMethods;
		const response = await tavioApiRequest.call(
			this,
			method,
			this.getNodeParameter('path', itemIndex) as string,
			parseJsonObject(this.getNodeParameter('body', itemIndex, '{}'), 'Corpo'),
			parseJsonObject(this.getNodeParameter('query', itemIndex, '{}'), 'Query'),
			idempotencyKey,
		);
		return [asDataObject(simplify ? unwrapResponse(response) : response)];
	}

	if (operation === 'getMany' || operation === 'search') {
		if (resource === 'pipeline' || resource === 'tag') {
			const response = await tavioApiRequest.call(
				this,
				'GET',
				resource === 'pipeline' ? '/pipelines' : '/tags',
				undefined,
				compactObject({ search: this.getNodeParameter('search', itemIndex, '') as string }),
			);
			const data = simplify ? unwrapResponse<unknown>(response) : response;
			return Array.isArray(data) ? data.map(asDataObject) : [asDataObject(data)];
		}
		const path = endpoints[resource];
		if (!path) throw new NodeOperationError(this.getNode(), 'Recurso não paginável', { itemIndex });
		const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
		const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
		const page = await getMany.call(
			this,
			path,
			compactObject({ search: this.getNodeParameter('search', itemIndex, '') as string }),
			returnAll,
			limit,
		);
		return simplify ? page.items : page.rawPages.map(asDataObject);
	}

	if (resource === 'pipeline' && operation === 'getStages') {
		const pipelineId = getParameterString(this, 'pipelineId', itemIndex);
		const pipelines = unwrapResponse<IDataObject[]>(
			await tavioApiRequest.call(this, 'GET', '/pipelines'),
		);
		const pipeline = pipelines.find(({ id }) => id === pipelineId);
		if (!pipeline)
			throw new NodeOperationError(this.getNode(), 'Funil não encontrado', { itemIndex });
		const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as IDataObject[]) : [];
		return simplify ? stages : [pipeline];
	}

	if (resource === 'note') {
		const response = await tavioApiRequest.call(
			this,
			'POST',
			'/notes',
			{
				entityType: this.getNodeParameter('entityType', itemIndex) as string,
				entityId: getParameterString(this, 'entityId', itemIndex),
				content: this.getNodeParameter('content', itemIndex) as string,
			},
			undefined,
			idempotencyKey,
		);
		return [asDataObject(simplify ? unwrapResponse(response) : response)];
	}

	if (
		['contact', 'organization'].includes(resource) &&
		['archive', 'restore'].includes(operation)
	) {
		const response = await tavioApiRequest.call(
			this,
			'POST',
			`${endpoints[resource]}/${idForOperation(this, itemIndex)}/${operation}`,
			undefined,
			undefined,
			idempotencyKey,
		);
		return [asDataObject(simplify ? unwrapResponse(response) : response)];
	}

	if (resource === 'tag' && ['add', 'remove'].includes(operation)) {
		return [await changeTag.call(this, itemIndex, operation === 'add', idempotencyKey, simplify)];
	}

	const path = endpoints[resource];
	if (!path) throw new NodeOperationError(this.getNode(), 'Operação não suportada', { itemIndex });
	const id = getParameterString(this, 'id', itemIndex, '');
	let method: IHttpRequestMethods = 'POST';
	let requestPath = path;
	let body: IDataObject = {};

	if (operation === 'get') {
		method = 'GET';
		requestPath = `${path}/${id}`;
	} else if (operation === 'create' || operation === 'upsert') {
		body = enrichedBody.call(this, itemIndex, resource);
		if (isV3(this) && resource === 'deal' && operation === 'create') {
			if (!body.pipelineId || !body.stageId) {
				throw new NodeOperationError(
					this.getNode(),
					'Adicione Funil e Etapa em Campos adicionais para criar o negócio.',
					{ itemIndex },
				);
			}
		}
		requestPath = operation === 'upsert' ? `${path}/upsert` : path;
		if (resource === 'contact' && operation === 'upsert') {
			const upsertBy = this.getNodeParameter('upsertBy', itemIndex, 'email') as string;
			if (upsertBy === 'email') {
				body.matchEmail = this.getNodeParameter('matchEmail', itemIndex) as string;
			} else if (upsertBy === 'phone') {
				body.matchPhone = this.getNodeParameter('matchPhone', itemIndex) as string;
			} else {
				body.externalId = this.getNodeParameter('externalId', itemIndex) as string;
			}
		}
	} else if (operation === 'update') {
		method = 'PATCH';
		requestPath = `${path}/${id}`;
		body = enrichedBody.call(this, itemIndex, resource);
		if (['activity', 'product'].includes(resource)) {
			body.updatedAt = this.getNodeParameter('updatedAt', itemIndex) as string;
		} else {
			body.version = this.getNodeParameter('version', itemIndex) as number;
		}
	} else if (resource === 'lead' && operation === 'archive') {
		requestPath = `${path}/${id}/archive`;
		body = { version: this.getNodeParameter('version', itemIndex) as number };
	} else if (resource === 'lead' && operation === 'restore') {
		requestPath = `${path}/${id}/restore`;
		body = { version: this.getNodeParameter('version', itemIndex) as number };
	} else if (resource === 'lead' && operation === 'qualify') {
		requestPath = `${path}/${id}/qualify`;
	} else if (resource === 'lead' && operation === 'disqualify') {
		requestPath = `${path}/${id}/disqualify`;
		body = compactObject({
			version: this.getNodeParameter('version', itemIndex, undefined) as number | undefined,
			reason: this.getNodeParameter('reason', itemIndex, '') as string,
			note: this.getNodeParameter('note', itemIndex, '') as string,
		});
	} else if (resource === 'lead' && operation === 'convert') {
		requestPath = `${path}/${id}/convert`;
		body = {
			pipelineId: getParameterString(this, 'pipelineId', itemIndex),
			stageId: getParameterString(this, 'stageId', itemIndex),
			version: this.getNodeParameter('version', itemIndex) as number,
		};
	} else if (resource === 'deal' && operation === 'move') {
		requestPath = `${path}/${id}/move`;
		body = {
			stageId: getParameterString(this, 'stageId', itemIndex),
			version: this.getNodeParameter('version', itemIndex) as number,
		};
	} else if (resource === 'deal' && ['won', 'lost', 'reopen'].includes(operation)) {
		requestPath = `${path}/${id}/${operation}`;
		body = compactObject({
			version: this.getNodeParameter('version', itemIndex) as number,
			lostReason: this.getNodeParameter('lostReason', itemIndex, '') as string,
		});
	} else if (resource === 'deal' && ['archive', 'restore'].includes(operation)) {
		requestPath = `${path}/${id}/${operation}`;
	} else if (resource === 'deal' && operation === 'addProduct' && isV2(this)) {
		requestPath = `${path}/${id}/items`;
		body = compactObject({
			productId: getParameterString(this, 'productId', itemIndex, ''),
			description: this.getNodeParameter('itemDescription', itemIndex) as string,
			quantity: String(this.getNodeParameter('quantity', itemIndex)),
			unitPrice: String(this.getNodeParameter('unitPrice', itemIndex)),
			discountValue: this.getNodeParameter('discountValue', itemIndex, '') as string,
			discountRate: this.getNodeParameter('discountRate', itemIndex, '') as string,
			note: this.getNodeParameter('itemNote', itemIndex, '') as string,
		});
	} else if (resource === 'deal' && operation === 'addProduct') {
		requestPath = `${path}/${id}/items`;
		body = {
			...parseJsonObject(this.getNodeParameter('dealItem', itemIndex), 'Item do negócio'),
			productId: getParameterString(this, 'productId', itemIndex, ''),
		};
	} else if (resource === 'activity' && operation === 'complete') {
		requestPath = `${path}/${id}/complete`;
		body = compactObject({ result: this.getNodeParameter('result', itemIndex, '') as string });
	} else {
		throw new NodeOperationError(this.getNode(), 'Operação não suportada', { itemIndex });
	}

	const response = await tavioApiRequest.call(
		this,
		method,
		requestPath,
		body,
		undefined,
		idempotencyKey,
	);
	return [asDataObject(simplify ? unwrapResponse(response) : response)];
}

function enrichedBody(this: IExecuteFunctions, itemIndex: number, resource: string): IDataObject {
	const body = isV2(this)
		? buildTypedBody.call(this, itemIndex, resource)
		: parseJsonObject(this.getNodeParameter('fields', itemIndex, '{}'), 'Campos');
	const customFields = parameterValue(this, 'customFields', itemIndex, {}) as IDataObject;
	const values = Array.isArray(customFields.values) ? (customFields.values as IDataObject[]) : [];
	if (values.length > 0) {
		const customData =
			typeof body.customData === 'object' &&
			body.customData !== null &&
			!Array.isArray(body.customData)
				? (body.customData as IDataObject)
				: {};
		for (const entry of values) {
			const fieldId = String(entry.fieldId ?? '');
			if (!fieldId) continue;
			const rawValue = entry.value;
			if (typeof rawValue === 'string') {
				try {
					customData[fieldId] = JSON.parse(rawValue) as IDataObject[string];
				} catch {
					customData[fieldId] = rawValue;
				}
			} else {
				customData[fieldId] = rawValue;
			}
		}
		body.customData = customData;
	}
	for (const parameter of ['ownerId', 'teamId']) {
		const value = getParameterString(this, parameter, itemIndex, '');
		if (value) body[parameter] = value;
	}
	if (resource === 'deal') {
		body.pipelineId = getParameterString(this, 'pipelineId', itemIndex);
		body.stageId = getParameterString(this, 'stageId', itemIndex);
	}
	return body;
}

async function changeTag(
	this: IExecuteFunctions,
	itemIndex: number,
	add: boolean,
	idempotencyKey: string,
	simplify: boolean,
): Promise<IDataObject> {
	const entityType = this.getNodeParameter('entityType', itemIndex) as string;
	const entityId = getParameterString(this, 'entityId', itemIndex);
	const tagId = getParameterString(this, 'tagId', itemIndex);
	const path = endpoints[entityType];
	if (!path) throw new NodeOperationError(this.getNode(), 'Tipo de item inválido', { itemIndex });
	const currentResponse = await tavioApiRequest.call(this, 'GET', `${path}/${entityId}`);
	const current = unwrapResponse<IDataObject>(currentResponse);
	const currentTags = Array.isArray(current.tagIds) ? current.tagIds.map(String) : [];
	const tagIds = add
		? [...new Set([...currentTags, tagId])]
		: currentTags.filter((value) => value !== tagId);
	const token =
		entityType === 'product' ? { updatedAt: current.updatedAt } : { version: current.version };
	const response = await tavioApiRequest.call(
		this,
		'PATCH',
		`${path}/${entityId}`,
		{ tagIds, ...token },
		undefined,
		idempotencyKey,
	);
	return asDataObject(simplify ? unwrapResponse(response) : response);
}

function rawParameter(
	context: TavioFunctions,
	name: string,
	itemIndex: number | undefined,
	fallback: unknown = '',
): unknown {
	if (itemIndex === undefined) {
		return (context as ILoadOptionsFunctions).getNodeParameter(name, fallback);
	}
	return (context as IExecuteFunctions).getNodeParameter(name, itemIndex, fallback);
}

function getParameterString(
	context: TavioFunctions,
	name: string,
	itemIndex: number | undefined,
	fallback = '',
): string {
	const value = parameterValue(context, name, itemIndex, fallback);
	if (typeof value === 'object' && value !== null && 'value' in value) {
		return String((value as { value?: unknown }).value ?? fallback);
	}
	return value === undefined || value === null ? fallback : String(value);
}

function idForOperation(context: IExecuteFunctions, itemIndex: number): string {
	return getParameterString(context, 'id', itemIndex, '');
}

function isV2(context: IExecuteFunctions): boolean {
	return context.getNode().typeVersion >= 2;
}

function isV3(context: TavioFunctions): boolean {
	return context.getNode().typeVersion >= 3;
}

function additionalFields(
	context: TavioFunctions,
	itemIndex: number | undefined,
): IDataObject | undefined {
	if (!isV3(context)) return undefined;
	const value = rawParameter(context, 'additionalFields', itemIndex, undefined);
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as IDataObject)
		: undefined;
}

function parameterValue(
	context: TavioFunctions,
	name: string,
	itemIndex: number | undefined,
	fallback: unknown = '',
): unknown {
	const values = additionalFields(context, itemIndex);
	if (values && name in values) return values[name];
	return rawParameter(context, name, itemIndex, fallback);
}

function collectionValues(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
): IDataObject[] {
	const value = parameterValue(context, name, itemIndex, {});
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
	const values = (value as IDataObject).values;
	return Array.isArray(values) ? (values as IDataObject[]) : [];
}

function buildTypedBody(this: IExecuteFunctions, itemIndex: number, resource: string): IDataObject {
	const body: IDataObject = {};
	const fieldsByResource: Record<string, string[]> = {
		contact: [
			'firstName',
			'lastName',
			'jobTitle',
			'source',
			'notes',
			'contactPreference',
			'externalId',
			'matchEmail',
			'matchPhone',
		],
		organization: [
			'name',
			'tradeName',
			'document',
			'industry',
			'size',
			'website',
			'source',
			'notes',
		],
		lead: [
			'title',
			'estimatedValue',
			'currency',
			'source',
			'description',
			'expectedAt',
			'externalId',
		],
		deal: [
			'title',
			'value',
			'currency',
			'probability',
			'source',
			'expectedCloseAt',
			'notes',
			'externalId',
		],
		activity: [
			'title',
			'description',
			'type',
			'dueAt',
			'durationMinutes',
			'priority',
			'reminderAt',
		],
		product: [
			'name',
			'category',
			'description',
			'code',
			'defaultPrice',
			'currency',
			'unit',
			'type',
			'recurring',
			'recurrencePeriod',
			'active',
		],
	};
	for (const field of fieldsByResource[resource] ?? []) {
		const value = parameterValue(this, field, itemIndex, undefined);
		if (value !== undefined && value !== null && value !== '')
			body[field] = value as IDataObject[string];
	}
	for (const linked of ['contactId', 'organizationId']) {
		const value = getParameterString(this, linked, itemIndex, '');
		if (value) body[linked] = value;
	}
	if (resource === 'activity') {
		for (const linked of ['leadId', 'dealId']) {
			const value = getParameterString(this, linked, itemIndex, '');
			if (value) body[linked] = value;
		}
	}
	if (resource === 'contact') {
		const emailValues = collectionValues(this, 'emails', itemIndex);
		const phoneValues = collectionValues(this, 'phones', itemIndex);
		if (emailValues.length) body.emails = emailValues;
		if (phoneValues.length) body.phones = phoneValues;
	} else if (resource === 'organization') {
		const emailValues = collectionValues(this, 'emails', itemIndex);
		const phoneValues = collectionValues(this, 'phones', itemIndex);
		if (emailValues.length) body.emails = emailValues.map((entry) => String(entry.email ?? ''));
		if (phoneValues.length) body.phones = phoneValues.map((entry) => String(entry.phone ?? ''));
	}
	if (isV3(this) && resource === 'deal') {
		const association = String(rawParameter(this, 'associateWith', itemIndex, 'none'));
		if (association !== 'contact') delete body.contactId;
		if (association !== 'organization') delete body.organizationId;
	}
	const addressValue = parameterValue(this, 'address', itemIndex, {});
	if (typeof addressValue === 'object' && addressValue !== null && !Array.isArray(addressValue)) {
		const address = compactObject(addressValue as IDataObject);
		if (Object.keys(address).length) body.address = address;
	}
	const tagIds = parameterValue(this, 'tagIds', itemIndex, []);
	if (Array.isArray(tagIds) && tagIds.length) body.tagIds = tagIds.map(String);
	const options = rawParameter(this, 'options', itemIndex, {});
	if (
		(resource === 'lead' || resource === 'deal') &&
		!body.externalId &&
		typeof options === 'object' &&
		options !== null &&
		'externalId' in options
	) {
		body.externalId = String((options as IDataObject).externalId);
	}
	return body;
}

function resolveIdempotencyKey(
	this: IExecuteFunctions,
	itemIndex: number,
	resource: string,
	operation: string,
): string {
	if (resource === 'advanced' && String(rawParameter(this, 'method', itemIndex, 'GET')) === 'GET') {
		return '';
	}
	const readOperations = new Set(['get', 'getMany', 'search', 'getStages']);
	if (readOperations.has(operation)) return '';
	if (!isV2(this)) return getParameterString(this, 'idempotencyKey', itemIndex, '');
	const options = rawParameter(this, 'options', itemIndex, {});
	const values = typeof options === 'object' && options !== null ? (options as IDataObject) : {};
	const mode = String(values.idempotencyMode ?? 'automatic');
	if (mode === 'disabled') return '';
	if (mode === 'custom') return String(values.idempotencyKey ?? '');
	const workflow = this.getWorkflow();
	return [
		'tavio',
		workflow.id ?? workflow.name ?? 'workflow',
		this.getNode().id,
		this.getExecutionId(),
		itemIndex,
		resource,
		operation,
	]
		.join(':')
		.slice(0, 200);
}

function resolveSimplifyOutput(this: IExecuteFunctions, itemIndex: number): boolean {
	if (!isV2(this)) return this.getNodeParameter('simplifyOutput', itemIndex, true) as boolean;
	const options = rawParameter(this, 'options', itemIndex, {});
	if (typeof options === 'object' && options !== null && 'simplifyOutput' in options) {
		return Boolean((options as IDataObject).simplifyOutput);
	}
	return true;
}

// eslint-disable-next-line @n8n/community-nodes/icon-validation -- The versioned implementation receives its description in the constructor.
class TavioCrmV2 implements INodeType {
	icon = 'file:tavio-crm-icon.png';

	description: INodeTypeDescription;
	methods: TavioCrmV1['methods'];

	constructor(baseDescription?: INodeTypeBaseDescription) {
		const v1 = new TavioCrmV1();
		this.description = {
			...v1.description,
			...baseDescription,
			version: 2,
			properties: tavioCrmV2Properties,
		};
		this.methods = v1.methods;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return TavioCrmV1.prototype.execute.call(this);
	}
}

// eslint-disable-next-line @n8n/community-nodes/icon-validation -- The versioned implementation receives its description in the constructor.
class TavioCrmV3 implements INodeType {
	icon = 'file:tavio-crm-icon.png';

	description: INodeTypeDescription;
	methods: TavioCrmV1['methods'];

	constructor(baseDescription?: INodeTypeBaseDescription) {
		const v1 = new TavioCrmV1();
		this.description = {
			...v1.description,
			...baseDescription,
			version: 3,
			properties: tavioCrmV3Properties,
		};
		this.methods = v1.methods;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return TavioCrmV1.prototype.execute.call(this);
	}
}

export class TavioCrm extends VersionedNodeType {
	icon = 'file:tavio-crm-icon.png';

	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Tavio CRM',
			name: 'tavioCrm',
			// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg -- The official round Tavio asset is a theme-neutral PNG.
			icon: 'file:tavio-crm-icon.png',
			group: ['transform'],
			description: 'Consulta e altera dados do Tavio CRM',
			defaultVersion: 3,
		};
		super(
			{
				1: new TavioCrmV1(),
				2: new TavioCrmV2(baseDescription),
				3: new TavioCrmV3(baseDescription),
			},
			baseDescription,
		);
	}
}
