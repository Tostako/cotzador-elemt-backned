import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import { createProxyMiddleware, Filter } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

const app = express();
app.use(helmet());

const PREFIX = '/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const CORS_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: CORS_ORIGINS.includes('*') ? true : CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Shop-Slug'],
  }),
);
app.use(morgan('dev'));

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
 * Limpia headers internos que solo el gateway debe establecer.
 * Evita que un cliente falsifique contexto de otro usuario.
 */
function sanitizeInternalHeaders(req: Request, _res: Response, next: NextFunction) {
  delete req.headers['x-customer-id'];
  delete req.headers['x-shop-id'];
  delete req.headers['x-user-email'];
  delete req.headers['x-gateway-service'];
  next();
}
app.use(sanitizeInternalHeaders);

interface JwtPayload {
  sub?: string;
  customer_id?: string;
  shop_id?: string;
  email?: string;
  role?: string;
}

const PUBLIC_PATHS = [
  /^\/health$/,
  new RegExp(`^(${PREFIX})?/public/`),
  new RegExp(`^(${PREFIX})?/auth/customer/register$`),
  new RegExp(`^(${PREFIX})?/auth/customer/login$`),
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((regex) => regex.test(path));
}

/**
 * Rate limiting simple en memoria para endpoints pÃºblicos sensibles.
 * LÃ­mite: 10 intentos por ventana de 15 minutos por IP + ruta.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path.replace(PREFIX, '') || '/';
  const sensitive = /^\/?auth\/customer\/(login|register|reset-password)$/.test(path);
  if (!sensitive) return next();

  const key = `${getClientIp(req)}:${path}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Demasiados intentos. Por favor intenta mÃ¡s tarde.' });
  }
  rateLimitMap.set(key, entry);
  next();
}
app.use(rateLimitMiddleware);

/**
 * Valida el JWT en el gateway para todas las rutas no pÃºblicas.
 * Rechaza tokens invÃ¡lidos o ausentes antes de llegar a los microservicios.
 * Inyecta headers de contexto de forma segura.
 */
function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  if (isPublicPath(req.path)) return next();

  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Se requiere un token de autenticaciÃ³n vÃ¡lido' });
  }

  try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET as string) as JwtPayload;
    req.headers['x-customer-id'] = payload.customer_id ?? payload.sub ?? '';
    req.headers['x-shop-id'] = payload.shop_id ?? '';
    req.headers['x-user-email'] = payload.email ?? '';
    req.headers['x-user-role'] = payload.role ?? 'customer';
    next();
  } catch {
    return res.status(401).json({ error: 'Token invÃ¡lido o expirado' });
  }
}
app.use(jwtMiddleware);

/**
 * Logger simple de requests: mÃ©todo, ruta, request ID, tiempo y status.
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
 * Crea un proxy que actÃºa si la ruta cumple el filtro.
 * Acepta rutas con o sin el prefijo /api/v1.
 * Quita el prefijo antes de reenviar al microservicio.
 */
const route = (serviceName: string, target: string, pathFilter: Filter) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    pathRewrite: (path) => path.replace(new RegExp(`^${PREFIX}`), '').replace(/\/+/g, '/') || '/',
    on: {
      proxyReq: (proxyReq, req: Request) => {
        const requestId = req.headers['x-request-id'] as string;
        proxyReq.setHeader('x-request-id', requestId);
        proxyReq.setHeader('x-gateway-service', 'api-gateway');
        proxyReq.setHeader('x-customer-id', (req.headers['x-customer-id'] as string) ?? '');
        proxyReq.setHeader('x-shop-id', (req.headers['x-shop-id'] as string) ?? '');
        proxyReq.setHeader('x-user-email', (req.headers['x-user-email'] as string) ?? '');
        proxyReq.setHeader('x-user-role', (req.headers['x-user-role'] as string) ?? 'customer');
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

// Helper para crear filtros que acepten /api/v1/ruta o /ruta
const prefixed = (segment: string) => new RegExp(`^(${PREFIX})?/${segment}`);

// â”€â”€ Orden importante: las rutas mÃ¡s especÃ­ficas primero â”€â”€

// Payments: payment-plans/* y quotes/:id/payments
app.use(
  route('payments', targets.payments, (path) =>
    prefixed('payment-plans').test(path) ||
    new RegExp(`^(${PREFIX})?/quotes/[^/]+/payments`).test(path),
  ),
);

// Quotes: el resto de /quotes/*
app.use(route('quotes', targets.quotes, (path) => prefixed('quotes').test(path)));

// Auth & Tenant: /auth/* y /customers/*
app.use(route('auth', targets.auth, (path) => new RegExp(`^(${PREFIX})?/(auth|customers)`).test(path)));

// Config: /customer-config/*
app.use(route('config', targets.config, (path) => prefixed('customer-config').test(path)));

// Catalog: /quote-catalog/*
app.use(route('catalog', targets.catalog, (path) => prefixed('quote-catalog').test(path)));

// Public/Site: /public/*
app.use(route('public', targets.public, (path) => prefixed('public').test(path)));

// Tile Calculator: /tile-calculator/*
app.use(route('tile-calculator', targets.tileCalculator, (path) => prefixed('tile-calculator').test(path)));

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada en el gateway' }));

const port = process.env.PORT ?? process.env.GATEWAY_PORT ?? 3000;
app.listen(port, () => console.log(`API Gateway escuchando en puerto ${port} (acepta prefijo ${PREFIX} o sin prefijo)`));

