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

# Variabili d'ambiente per la build (necessarie per Next.js)
# Firebase principale (dmprojectnew)
ENV NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA2rUtbVrUq68JmnAKJ8J0g1mvNoIg1GHs"
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="dmprojectnew.firebaseapp.com"
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID="dmprojectnew"
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="dmprojectnew.firebasestorage.app"
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="920921649335"
ENV NEXT_PUBLIC_FIREBASE_APP_ID="1:660509531035:web:aa5796eda30fb7f39edf3e"

# Firebase dedicato alle immagini (petrolis-cd75b)
ENV NEXT_PUBLIC_STORAGE_PUBLIC_API_KEY="AIzaSyChev6cBb77QU1TzyK4txnYLnkScbDMxW0"
ENV NEXT_PUBLIC_STORAGE_PUBLIC_AUTH_DOMAIN="petrolis-cd75b.firebaseapp.com"
ENV NEXT_PUBLIC_STORAGE_PUBLIC_PROJECT_ID="petrolis-cd75b"
ENV NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET="petrolis-cd75b.firebasestorage.app"
ENV NEXT_PUBLIC_STORAGE_PUBLIC_MESSAGING_SENDER_ID="31005220155"
ENV NEXT_PUBLIC_STORAGE_PUBLIC_APP_ID="1:31005220155:web:6668d46b9ba31c5e65eb1e"

# OpenAI API Key
ENV OPENAI_API_KEY="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"

# ImgBB API Key (legacy, non più utilizzata ma mantenuta per compatibilità)
ENV NEXT_PUBLIC_IMGBB_API_KEY="fac33993006884896dacf85c5ecd5f39"

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


