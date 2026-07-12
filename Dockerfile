FROM mcr.microsoft.com/playwright:v1.61.1-noble AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runner

LABEL org.opencontainers.image.title="BladeVault"
LABEL org.opencontainers.image.description="A sharp, local-first knife collection manager."

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BLADEVAULT_DATA_DIR=/app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next.js standalone's dependency tracing strips files that Playwright loads
# dynamically at runtime (notably browsers.json). Copy the full package so
# Chromium can launch in the runner image.
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
