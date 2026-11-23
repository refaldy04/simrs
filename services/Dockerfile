FROM node:22-bookworm-slim

COPY --chown=node:node package.json package-lock.json /app/
WORKDIR /app

USER node
RUN npm ci --omit=dev
COPY --chown=node:node . .

CMD ["node", "src/server.js"]
