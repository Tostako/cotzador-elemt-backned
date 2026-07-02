#!/bin/sh
# Levanta los servicios auxiliares (config, catalog, public, tile) en un solo contenedor.
set -e

export NODE_ENV=production

concurrently \
  -n config,catalog,public,tile \
  "DATABASE_SCHEMA=config npm run start --prefix services/config-service" \
  "DATABASE_SCHEMA=catalog npm run start --prefix services/catalog-service" \
  "DATABASE_SCHEMA=site npm run start --prefix services/public-service" \
  "DATABASE_SCHEMA=tile_calculator npm run start --prefix services/tile-calculator-service"
