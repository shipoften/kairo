FROM oven/bun:1.3.14 AS deps
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1.3.14 AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app /app
EXPOSE 5180
CMD ["bun", "run", "start"]
