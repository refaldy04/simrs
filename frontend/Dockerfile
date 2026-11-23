FROM node:22-bookworm-slim

COPY --chown=node:node package.json package-lock.json /app/
WORKDIR /app

USER node
RUN npm ci
COPY --chown=node:node . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
