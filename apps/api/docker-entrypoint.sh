#!/bin/sh
set -e
cd /app/packages/db
bun drizzle-kit migrate
cd /app/apps/api
exec "$@"
