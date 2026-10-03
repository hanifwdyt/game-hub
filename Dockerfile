# Hanif Play hub. Build context = the deploy/ folder made by `npm run package`.
FROM node:20-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 compiles natively; the slim image needs a toolchain only at build time
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
ENV NEXT_TELEMETRY_DISABLED=1
# Better Auth refuses to start without a secret, and Next imports the auth module while collecting page data at build time.
# This placeholder exists only in this build stage — the runtime image gets the real BETTER_AUTH_SECRET from Coolify.
RUN BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime BETTER_AUTH_URL=http://localhost:3000 npm run build && cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    GAMES_ROOT=/games HUB_DB=/data/hub.db
# standalone server + the hub config it reads from the working directory
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/hub.config.json ./hub.config.json
COPY games /games
RUN useradd -r -u 10001 hub && mkdir -p /data && chown hub /data
USER hub
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
