FROM node:24

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 8080

USER node
CMD ["node", "server.js"]