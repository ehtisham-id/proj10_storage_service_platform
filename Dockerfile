FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm install -D @nestjs/cli
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
