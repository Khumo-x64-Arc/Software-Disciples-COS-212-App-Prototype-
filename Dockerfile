# One image with Node.js (app) and a JDK (to compile and run learners' Java).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY shared ./shared
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm --prefix server ci --omit=dev && npm --prefix client ci
COPY server ./server
COPY client ./client
RUN npm --prefix client run build
ENV PORT=3001 DATA_DIR=/app/data
EXPOSE 3001
# Runs as a non-root user so learner code cannot touch the app files.
RUN useradd -m runner && mkdir -p /app/data && chown -R runner /app/data
USER runner
CMD ["node", "server/src/index.js"]
