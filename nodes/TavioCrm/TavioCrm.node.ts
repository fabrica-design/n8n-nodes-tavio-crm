import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { tavioCrmProperties } from './properties';
import {
	asDataObject,
	compactObject,
	getMany,
	parseJsonObject,
	tavioApiRequest,
	unwrapResponse,
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

async function loadArray(this: ILoadOptionsFunctions, path: string): Promise<IDataObject[]> {
	const response = await tavioApiRequest.call(this, 'GET', path);
	const data = unwrapResponse<unknown>(response);
	if (Array.isArray(data)) return data as IDataObject[];
	if (typeof data === 'object' && data !== null && 'items' in data) {
		return ((data as { items?: IDataObject[] }).items ?? []) as IDataObject[];
	}
	return [];
}

export class TavioCrm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tavio CRM',
		name: 'tavioCrm',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg, @n8n/community-nodes/icon-prefer-themed-variants -- The official round Tavio asset is a theme-neutral PNG.
		icon: 'file:tavio-crm.png',
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
				return toOptions(await loadArray.call(this, '/pipelines'), (item) => String(item.name));
			},
			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const pipelines = await loadArray.call(this, '/pipelines');
				return pipelines.flatMap((pipeline) => {
					const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as IDataObject[]) : [];
					return toOptions(stages, (stage) => `${String(pipeline.name)} — ${String(stage.name)}`);
				});
			},
			async getProducts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { items } = await getMany.call(this, '/products', {}, true, 100);
				return toOptions(items, (item) =>
					item.code ? `${String(item.name)} (${String(item.code)})` : String(item.name),
				);
			},
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toOptions(await loadArray.call(this, '/tags'), (item) => String(item.name));
			},
			async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toOptions(await loadArray.call(this, '/workspace/members'), (item) => {
					const user = (item.user ?? {}) as IDataObject;
					return user.email ? `${String(user.name)} (${String(user.email)})` : String(user.name);
				});
			},
			async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toOptions(await loadArray.call(this, '/workspace/teams'), (item) =>
					String(item.name),
				);
			},
			async getCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return toOptions(
					await loadArray.call(this, '/custom-fields'),
					(item) => `${String(item.entity)} — ${String(item.name)}`,
				);
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
	const simplify = this.getNodeParameter('simplifyOutput', itemIndex, true) as boolean;
	const idempotencyKey = this.getNodeParameter('idempotencyKey', itemIndex, '') as string;

	if (resource === 'advanced') {
		const response = await tavioApiRequest.call(
			this,
			this.getNodeParameter('method', itemIndex) as IHttpRequestMethods,
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
		const pipelineId = this.getNodeParameter('pipelineId', itemIndex) as string;
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
				entityId: this.getNodeParameter('entityId', itemIndex) as string,
				content: this.getNodeParameter('content', itemIndex) as string,
			},
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
	const id = this.getNodeParameter('id', itemIndex, '') as string;
	let method: IHttpRequestMethods = 'POST';
	let requestPath = path;
	let body: IDataObject = {};

	if (operation === 'get') {
		method = 'GET';
		requestPath = `${path}/${id}`;
	} else if (operation === 'create' || operation === 'upsert') {
		body = enrichedBody.call(this, itemIndex, resource);
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
	} else if (resource === 'lead' && operation === 'convert') {
		requestPath = `${path}/${id}/convert`;
		body = {
			pipelineId: this.getNodeParameter('pipelineId', itemIndex) as string,
			stageId: this.getNodeParameter('stageId', itemIndex) as string,
			version: this.getNodeParameter('version', itemIndex) as number,
		};
	} else if (resource === 'deal' && operation === 'move') {
		requestPath = `${path}/${id}/move`;
		body = {
			stageId: this.getNodeParameter('stageId', itemIndex) as string,
			version: this.getNodeParameter('version', itemIndex) as number,
		};
	} else if (resource === 'deal' && ['won', 'lost', 'reopen'].includes(operation)) {
		requestPath = `${path}/${id}/${operation}`;
		body = compactObject({
			version: this.getNodeParameter('version', itemIndex) as number,
			lostReason: this.getNodeParameter('lostReason', itemIndex, '') as string,
		});
	} else if (resource === 'deal' && operation === 'addProduct') {
		requestPath = `${path}/${id}/items`;
		body = {
			...parseJsonObject(this.getNodeParameter('dealItem', itemIndex), 'Item do negócio'),
			productId: this.getNodeParameter('productId', itemIndex, '') as string,
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
	const body = parseJsonObject(this.getNodeParameter('fields', itemIndex, '{}'), 'Campos');
	const customFields = this.getNodeParameter('customFields', itemIndex, {}) as IDataObject;
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
		const value = this.getNodeParameter(parameter, itemIndex, '') as string;
		if (value) body[parameter] = value;
	}
	if (resource === 'deal') {
		body.pipelineId = this.getNodeParameter('pipelineId', itemIndex) as string;
		body.stageId = this.getNodeParameter('stageId', itemIndex) as string;
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
	const entityId = this.getNodeParameter('entityId', itemIndex) as string;
	const tagId = this.getNodeParameter('tagId', itemIndex) as string;
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
