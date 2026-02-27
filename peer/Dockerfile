FROM node:24

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node
CMD ["node", "cli.js"]