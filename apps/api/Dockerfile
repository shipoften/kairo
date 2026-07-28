FROM oven/bun:1.3.14
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN bun install --frozen-lockfile
WORKDIR /app/apps/api
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 5181
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts"]
