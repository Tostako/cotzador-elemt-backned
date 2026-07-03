#!/bin/sh
# Levanta los servicios auxiliares (config, catalog, public, tile) en un solo contenedor.
# Si Railway ya seteó las variables *_DATABASE_SCHEMA, las respeta.
set -e

export NODE_ENV=production

concurrently \
  -n config,catalog,public,tile \
  "DATABASE_SCHEMA=${CONFIG_DATABASE_SCHEMA:-config} npm run start --prefix services/config-service" \
  "DATABASE_SCHEMA=${CATALOG_DATABASE_SCHEMA:-catalog} npm run start --prefix services/catalog-service" \
  "DATABASE_SCHEMA=${PUBLIC_DATABASE_SCHEMA:-site} npm run start --prefix services/public-service" \
  "DATABASE_SCHEMA=${TILE_CALCULATOR_DATABASE_SCHEMA:-tile_calculator} npm run start --prefix services/tile-calculator-service"
