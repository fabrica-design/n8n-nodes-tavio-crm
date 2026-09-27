ARG N8N_IMAGE=docker.n8n.io/n8nio/n8n:2.40.6
FROM node:22-alpine AS builder

WORKDIR /source
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.json ./
COPY credentials ./credentials
COPY nodes ./nodes
RUN npm run build && mkdir -p /out && npm pack --pack-destination /out

FROM ${N8N_IMAGE}

USER root
COPY --from=builder /out/n8n-nodes-tavio-crm-*.tgz /tmp/tavio-crm.tgz
RUN mkdir -p /usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-tavio-crm \
	&& tar -xzf /tmp/tavio-crm.tgz --strip-components=1 \
		-C /usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-tavio-crm \
	&& rm /tmp/tavio-crm.tgz
ENV N8N_CUSTOM_EXTENSIONS=/usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-tavio-crm/dist
USER node
