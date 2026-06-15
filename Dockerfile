ARG APP_NAME

# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG APP_NAME
RUN npm run prisma:generate
RUN npx nest build ${APP_NAME}

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/libs/prisma/prisma ./libs/prisma/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY proto/ ./proto

USER app
EXPOSE 3000

ARG APP_NAME
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
CMD node "dist/apps/${APP_NAME}/main"
