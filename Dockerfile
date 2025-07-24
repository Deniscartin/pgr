# Fase 1: Installazione delle dipendenze
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copia package.json e lock file
COPY package.json package-lock.json* ./
RUN npm ci

# Fase 2: Build dell'applicazione
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variabili d'ambiente per la build (se necessarie)
# ENV NEXT_PUBLIC_CLIENT_VAR="value"

RUN npm run build

# Fase 3: Esecuzione in produzione
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia l'output standalone dalla fase di build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Aggiungi un utente non-root per la sicurezza
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000

ENV PORT 3000

# Avvia il server Node.js di Next.js
CMD ["node", "server.js"] 


