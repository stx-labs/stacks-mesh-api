FROM node:24-alpine

WORKDIR /app

COPY .git /.git
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/

RUN apk add --no-cache --virtual .build-deps git
RUN npm ci --no-audit && \
    npm run build --workspace=@stacks/mesh-schemas
RUN cd packages/api && \
    npm install --no-audit && \
    npm run build && \
    npm run generate:git-info && \
    npm prune --production
RUN apk del .build-deps

WORKDIR /app/packages/api
CMD ["node", "./dist/src/index.js"]