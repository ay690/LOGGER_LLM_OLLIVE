# ─── Development ──────────────────────────────────────────────────────────────
# Runs Vite dev server with hot reload on port 5173.
# Source code is mounted as a volume so changes reflect instantly.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Copy source into the image.
# When run via docker-compose, the volume mount overlays this with
# your live source so Vite HMR picks up changes on every save.
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
