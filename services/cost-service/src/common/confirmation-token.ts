import { createHmac } from 'crypto';

const SECRET = process.env.JWT_SECRET ?? 'cambia-esto-por-un-secreto-largo';
const TTL_MS = 5 * 60 * 1000;

interface TokenPayload {
  op: string;
  shopId: string;
  resourceId: string;
  hash: string;
  exp: number;
}

function hashInput(data: unknown): string {
  return createHmac('sha256', SECRET)
    .update(JSON.stringify(data ?? null))
    .digest('hex')
    .slice(0, 16);
}

/** Firma un token de confirmación ligado a una operación y a la entrada propuesta. */
export function firmarConfirmacion(
  op: string,
  shopId: string,
  resourceId: string,
  data: unknown,
): string {
  const payload: ConfirmationPayload = {
    op,
    shopId,
    resourceId,
    hash: hashInput(data),
    exp: Date.now() + TTL_MS,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export interface ConfirmationPayload {
  op: string;
  shopId: string;
  resourceId: string;
  hash: string;
  exp: number;
}

/**
 * Valida un token de confirmación. Devuelve el payload si es válido y no
 * expiró, o null en caso contrario.
 */
export function verificarConfirmacion(token: string | undefined): ConfirmationPayload | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as
      | ConfirmationPayload
      | null;
    if (!payload || !payload.op || !payload.shopId || !payload.resourceId || !payload.hash) {
      return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Comprueba que el token fue emitido para esta operación y este resource. */
export function confirmacionMatch(
  token: string | undefined,
  op: string,
  shopId: string,
  resourceId: string,
): boolean {
  const payload = verificarConfirmacion(token);
  if (!payload) return false;
  return (
    payload.op === op && payload.shopId === shopId && payload.resourceId === resourceId
  );
}

/** Reconcilia el hash del payload propuesto con el que dio origen al token. */
export function confirmacionValidaParaDatos(
  token: string | undefined,
  op: string,
  shopId: string,
  resourceId: string,
  data: unknown,
): boolean {
  const payload = verificarConfirmacion(token);
  if (!payload) return false;
  return (
    payload.op === op &&
    payload.shopId === shopId &&
    payload.resourceId === resourceId &&
    payload.hash === hashInput(data)
  );
}

export function hashDeInput(data: unknown): string {
  return hashInput(data);
}