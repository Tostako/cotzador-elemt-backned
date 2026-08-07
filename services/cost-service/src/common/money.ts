/**
 * Dinero como cadena decimal con dos decimales (ej: "58696983.45").
 * Internamente se opera en centavos (enteros) para evitar errores de redondeo
 * de coma flotante en presupuestos.
 */

export type Dinero = string; // "58696983.45"
export type Cantidad = string; // "26.0400"

const MONEY_RE = /^-?\d+\.\d{2}$/;

/** Valida que un string sea dinero con exactamente dos decimales. */
export function isValidMoney(value: string): boolean {
  return MONEY_RE.test(value);
}

/** Convierte dinero string ("123.45") a centavos enteros. */
export function toCents(value: string | number): number {
  const s = typeof value === 'number' ? value.toFixed(2) : value;
  if (s === '' || s === null || s === undefined) return 0;
  const [int, dec = '00'] = s.split('.');
  const sign = int.startsWith('-') ? -1 : 1;
  const cleanInt = int.replace('-', '') || '0';
  const cleanDec = (dec + '00').slice(0, 2);
  return sign * (parseInt(cleanInt, 10) * 100 + parseInt(cleanDec, 10));
}

/** Convierte centavos enteros a dinero string con dos decimales. */
export function fromCents(cents: number): Dinero {
  const abs = Math.abs(Math.round(cents));
  const sign = cents < 0 ? '-' : '';
  const int = Math.floor(abs / 100);
  const dec = (abs % 100).toString().padStart(2, '0');
  return `${sign}${int}.${dec}`;
}

export function moneyAdd(a: string | number, b: string | number): Dinero {
  return fromCents(toCents(a) + toCents(b));
}

export function moneySub(a: string | number, b: string | number): Dinero {
  return fromCents(toCents(a) - toCents(b));
}

export function moneyMul(a: string | number, b: string | number): Dinero {
  return fromCents(Math.round(toCents(a) * toCents(b) / 100));
}

export function moneyDiv(a: string | number, b: string | number): Dinero {
  if (toCents(b) === 0) return '0.00';
  return fromCents(Math.round(toCents(a) / (toCents(b) / 100)));
}

/** Aplica un porcentaje (23 = 23%) sobre una cantidad. */
export function moneyPercent(value: string | number, pct: number): Dinero {
  return fromCents(Math.round(toCents(value) * pct / 100));
}

/** Formatea una cantidad con hasta cuatro decimales. */
export function formatCantidad(value: number | string): Cantidad {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(n)) return '0.0000';
  return n.toFixed(4);
}

export function parseCantidad(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}
