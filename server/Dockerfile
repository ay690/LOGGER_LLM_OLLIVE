# ─── Development ──────────────────────────────────────────────────────────────
# Runs ts-node-dev with hot reload on port 3001.
# Source code is mounted as a volume so changes reflect instantly.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Copy source into the image.
# When run via docker-compose, the volume mount overlays this with
# your live source so ts-node-dev hot-reloads on every save.
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
