FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
RUN mkdir -p logs
EXPOSE 0
CMD ["node", "src/agent.js"]
