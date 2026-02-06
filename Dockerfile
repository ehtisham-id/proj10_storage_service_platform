FROM node:20-bullseye-slim
WORKDIR /app

# Install system dependencies required by Prisma native engine
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl1.1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
RUN npm run build
CMD ["npm", "run", "start:dev"]
