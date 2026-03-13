# Fase 1: Installazione delle dipendenze
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copia solo package.json (no lock file - install fresco)
COPY package.json ./
RUN npm install

# Fase 2: Build dell'applicazione
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Fase 3: Esecuzione in produzione
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Aggiungi un utente non-root per la sicurezza
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia l'output standalone dalla fase di build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copia le dipendenze dalla fase deps e rimuovi le devDependencies
# (necessario per serverExternalPackages come @google-cloud/documentai)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
RUN npm prune --omit=dev

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Avvia il server Node.js di Next.js
CMD ["node", "server.js"]
