import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import { createProxyMiddleware, Filter } from 'http-proxy-middleware';

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

const PREFIX = '/api/v1';
const targets = {
  auth: process.env.AUTH_URL ?? 'http://127.0.0.1:3001',
  quotes: process.env.QUOTES_URL ?? 'http://127.0.0.1:3002',
  payments: process.env.PAYMENTS_URL ?? 'http://127.0.0.1:3003',
  config: process.env.CONFIG_URL ?? 'http://127.0.0.1:3004',
  catalog: process.env.CATALOG_URL ?? 'http://127.0.0.1:3005',
  public: process.env.PUBLIC_URL ?? 'http://127.0.0.1:3006',
  tileCalculator: process.env.TILE_CALCULATOR_URL ?? 'http://127.0.0.1:3007',
};

/**
 * Genera o reusa un request ID y lo propaga a los microservicios.
 */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
app.use(requestIdMiddleware);

/**
 * Logger simple de requests: método, ruta, request ID, tiempo y status.
 */
function gatewayLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[GATEWAY] ${req.method} ${req.path} | requestId=${requestId} | status=${res.statusCode} | ${duration}ms`,
    );
  });
  next();
}
app.use(gatewayLogger);

// Healthcheck del gateway
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
  }),
);

/**
 * Crea un proxy que solo actúa si la ruta cumple el filtro.
 * Quita el prefijo /api/v1 antes de reenviar al microservicio.
 * Propaga x-request-id, x-shop-slug y authorization.
 */
const route = (serviceName: string, target: string, pathFilter: Filter) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    pathRewrite: { [`^${PREFIX}`]: '' },
    on: {
      proxyReq: (proxyReq, req: Request) => {
        const requestId = req.headers['x-request-id'] as string;
        proxyReq.setHeader('x-request-id', requestId);
        proxyReq.setHeader('x-gateway-service', serviceName);
        console.log(`[GATEWAY -> ${serviceName.toUpperCase()}] ${req.method} ${req.path} | requestId=${requestId}`);
      },
      proxyRes: (proxyRes, req: Request) => {
        const requestId = req.headers['x-request-id'] as string;
        console.log(
          `[GATEWAY <- ${serviceName.toUpperCase()}] ${req.method} ${req.path} | requestId=${requestId} | status=${proxyRes.statusCode}`,
        );
      },
      error: (err, req: Request, res: any) => {
        const requestId = req.headers['x-request-id'] as string;
        console.error(`[GATEWAY ERROR] ${req.method} ${req.path} | requestId=${requestId} | error=${err.message}`);
        if (res && !res.headersSent && typeof res.status === 'function') {
          res.status(502).json({ error: `Servicio ${serviceName} no disponible` });
        }
      },
    },
  });

// ── Orden importante: las rutas más específicas primero ──

// Payments: payment-plans/* y quotes/:id/payments
app.use(
  route('payments', targets.payments, (path) =>
    new RegExp(`^${PREFIX}/payment-plans`).test(path) ||
    new RegExp(`^${PREFIX}/quotes/[^/]+/payments`).test(path),
  ),
);

// Quotes: el resto de /quotes/*
app.use(route('quotes', targets.quotes, (path) => new RegExp(`^${PREFIX}/quotes`).test(path)));

// Auth & Tenant: /auth/* y /customers/*
app.use(route('auth', targets.auth, (path) => new RegExp(`^${PREFIX}/(auth|customers)`).test(path)));

// Config: /customer-config/*
app.use(route('config', targets.config, (path) => new RegExp(`^${PREFIX}/customer-config`).test(path)));

// Catalog: /quote-catalog/*
app.use(route('catalog', targets.catalog, (path) => new RegExp(`^${PREFIX}/quote-catalog`).test(path)));

// Public/Site: /public/*
app.use(route('public', targets.public, (path) => new RegExp(`^${PREFIX}/public`).test(path)));

// Tile Calculator: /tile-calculator/*
app.use(route('tile-calculator', targets.tileCalculator, (path) => new RegExp(`^${PREFIX}/tile-calculator`).test(path)));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada en el gateway' }));

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`API Gateway escuchando en puerto ${port} (prefijo ${PREFIX})`));
