#!/bin/sh
# Levanta todos los microservicios en un solo contenedor de Railway.
# Cada servicio recibe su propio DATABASE_SCHEMA.
set -e

export NODE_ENV=production

concurrently \
  -n auth,quotes,payments,config,catalog,public,tile \
  "DATABASE_SCHEMA=element_auth npm run start --prefix services/auth-service" \
  "DATABASE_SCHEMA=quotes npm run start --prefix services/quotes-service" \
  "DATABASE_SCHEMA=payments npm run start --prefix services/payments-service" \
  "DATABASE_SCHEMA=config npm run start --prefix services/config-service" \
  "DATABASE_SCHEMA=catalog npm run start --prefix services/catalog-service" \
  "DATABASE_SCHEMA=site npm run start --prefix services/public-service" \
  "DATABASE_SCHEMA=tile_calculator npm run start --prefix services/tile-calculator-service"
