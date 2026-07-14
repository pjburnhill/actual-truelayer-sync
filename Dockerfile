FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/pjburnhill/actual-truelayer-sync" \
      org.opencontainers.image.revision="$VCS_REF"
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
USER node
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s --retries=3 CMD ["node", "dist/healthcheck.js"]
CMD ["node", "dist/sync.js"]
