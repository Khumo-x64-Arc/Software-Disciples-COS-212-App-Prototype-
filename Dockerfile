# Software Disciples COS212 app: one container with Node.js and a JDK,
# so the coding questions can be compiled and marked.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY shared ./shared
COPY client/package*.json ./client/
RUN npm install --prefix client --include=dev
COPY client ./client
RUN npm run build --prefix client

FROM node:20-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY shared ./shared
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
ENV NODE_ENV=production
# Render sets PORT; 10000 is its default.
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server/src/index.js"]
