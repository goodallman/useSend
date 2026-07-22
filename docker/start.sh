#!/bin/sh

set -eu

echo "Deploying prisma migrations"

node ./node_modules/prisma/build/index.js migrate deploy --schema ./apps/web/prisma/schema.prisma

echo "Starting web server"

exec node apps/web/server.js

