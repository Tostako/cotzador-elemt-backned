export interface Segmento {
  largo: number;
  ancho: number;
}

export interface EspacioInput {
  segmentos: Segmento[];
  tipo?: 'piso' | 'pared';
  orientacion_manual?: 'largo' | 'ancho' | null;
}

export interface MaterialInput {
  id: string;
  nombre: string;
  tipo_acabado: string;
  formato_largo?: number; // cm
  formato_ancho?: number; // cm
  modo_precio: 'm2' | 'caja';
  precio_m2?: number | null;
  precio_caja?: number | null;
  m2_caja?: number | null;
}

export interface Pattern {
  id: string;
  nombre: string;
  desperdicio: number;
  recomendado: string;
}

export const PATRONES: Pattern[] = [
  { id: 'recta', nombre: 'Recta / Junta corrida (a hilo)', desperdicio: 5, recomendado: 'Sirve para casi todos los materiales y formatos rectangulares grandes.' },
  { id: 'trabada50', nombre: 'Trabada 1/2 (a la española, ladrillo 50%)', desperdicio: 8, recomendado: 'Porcelanato, cerámica, SPC y laminado rectangular.' },
  { id: 'trabada33', nombre: 'Trabada 1/3', desperdicio: 10, recomendado: 'Porcelanato rectangular y madera/laminado de tablas largas.' },
  { id: 'trabada25', nombre: 'Trabada 1/4', desperdicio: 8, recomendado: 'Formatos grandes rectificados (porcelanato XL).' },
  { id: 'diagonal45', nombre: 'Diagonal 45°', desperdicio: 15, recomendado: 'Cerámica y porcelanato cuadrado; amplía visualmente espacios pequeños.' },
  { id: 'espina', nombre: 'Espina de pescado (Herringbone)', desperdicio: 20, recomendado: 'Madera, laminado y SPC en formato de tabla/listón.' },
  { id: 'cesta', nombre: 'Cesta / Basket weave', desperdicio: 15, recomendado: 'Madera y mosaico.' },
  { id: 'versalles', nombre: 'Versalles (combinación de formatos)', desperdicio: 12, recomendado: 'Piedra natural y porcelanato imitación piedra.' },
  { id: 'irregular', nombre: 'Espacio irregular / muchos cortes', desperdicio: 12, recomendado: 'Cualquier material en espacios con ángulos o formas en L.' },
];

const CONTINUOS = new Set([
  'Microcemento',
  'Resina Epóxica',
  'Concreto Pulido',
]);

export function isContinuo(material: MaterialInput): boolean {
  return CONTINUOS.has(material.tipo_acabado);
}

export function computeArea(espacio: EspacioInput): number {
  return espacio.segmentos.reduce((sum, seg) => sum + seg.largo * seg.ancho, 0);
}

export interface PiezasResult {
  piezasTotales: number;
  filas: number;
  columnas: number;
  areaComprada: number;
  areaNecesaria: number;
  desperdicioPct: number;
  orientacion: 'largo' | 'ancho';
}

export function piezasPorPatron(
  L: number,
  A: number,
  material: MaterialInput,
  patronId: string,
): PiezasResult {
  const pattern = PATRONES.find((p) => p.id === patronId);
  const desperdicioBase = pattern?.desperdicio ?? 5;

  let pL = (material.formato_largo ?? 60) / 100; // cm -> m
  let pA = (material.formato_ancho ?? 60) / 100; // cm -> m

  // Orientación: usar el lado mayor como referencia de instalación
  const orientacion: 'largo' | 'ancho' = pL >= pA ? 'largo' : 'ancho';

  // Para espina/trabada se considera que cada pieza se instala con el lado mayor a lo largo
  const piezaLargo = Math.max(pL, pA);
  const piezaAncho = Math.min(pL, pA);

  let columnas = Math.ceil(L / piezaLargo);
  let filas = Math.ceil(A / piezaAncho);

  if (patronId === 'diagonal45') {
    // En diagonal se requiere aproximadamente un 15% más de material
    const areaNecesaria = L * A;
    const areaPieza = piezaLargo * piezaAncho;
    const piezasTotales = Math.ceil((areaNecesaria / areaPieza) * (1 + desperdicioBase / 100));
    return {
      piezasTotales,
      filas: 0,
      columnas: 0,
      areaComprada: piezasTotales * areaPieza,
      areaNecesaria,
      desperdicioPct: desperdicioBase,
      orientacion,
    };
  }

  if (patronId === 'espina') {
    // En espina cada pieza se corta en dos mitades; se necesitan el doble de cortes
    const perimetroEfectivo = L + A;
    const piezasPorMetro = 1 / piezaAncho;
    const piezasTotales = Math.ceil(perimetroEfectivo * piezasPorMetro * 2 * (1 + desperdicioBase / 100));
    const areaPieza = piezaLargo * piezaAncho;
    return {
      piezasTotales,
      filas: 0,
      columnas: 0,
      areaComprada: piezasTotales * areaPieza,
      areaNecesaria: L * A,
      desperdicioPct: desperdicioBase,
      orientacion,
    };
  }

  if (patronId.startsWith('trabada')) {
    // Trabadas requieren un 8-10% adicional por los cortes escalonados
    columnas = Math.ceil((L / piezaLargo) * 1.05);
    filas = Math.ceil((A / piezaAncho) * 1.05);
  }

  const piezasTotales = filas * columnas;
  const areaNecesaria = L * A;
  const areaComprada = piezasTotales * piezaLargo * piezaAncho;
  const desperdicioReal = areaNecesaria > 0
    ? ((areaComprada - areaNecesaria) / areaNecesaria) * 100
    : 0;

  return {
    piezasTotales,
    filas,
    columnas,
    areaComprada,
    areaNecesaria,
    desperdicioPct: Math.max(desperdicioReal, desperdicioBase),
    orientacion,
  };
}

export interface InstalacionResult {
  areaNecesaria: number;
  areaComprada: number;
  desperdicioPct: number;
  piezas: number;
  orientacion: 'largo' | 'ancho';
  exacto: boolean;
  costoEstimado: number;
  cajasNecesarias?: number;
  m2PorCaja?: number;
}

export function calcularInstalacion(
  espacio: EspacioInput,
  material: MaterialInput,
  patronId: string,
  ajusteManual = 0,
): InstalacionResult {
  if (isContinuo(material)) {
    const area = computeArea(espacio);
    const precio = material.modo_precio === 'caja'
      ? (material.precio_caja ?? 0) / (material.m2_caja ?? 1)
      : (material.precio_m2 ?? 0);
    return {
      areaNecesaria: area,
      areaComprada: area,
      desperdicioPct: 0,
      piezas: 0,
      orientacion: 'largo',
      exacto: true,
      costoEstimado: area * precio,
    };
  }

  const areaNecesaria = computeArea(espacio);
  const base = piezasPorPatron(
    espacio.segmentos.reduce((sum, s) => sum + s.largo, 0),
    espacio.segmentos.reduce((sum, s) => sum + s.ancho, 0),
    material,
    patronId,
  );

  // Aplicar ajuste manual de desperdicio
  const desperdicioFinal = base.desperdicioPct + ajusteManual;
  const factor = 1 + desperdicioFinal / 100;
  const areaComprada = areaNecesaria * factor;

  // Recalcular piezas con el área comprada
  const pL = (material.formato_largo ?? 60) / 100;
  const pA = (material.formato_ancho ?? 60) / 100;
  const piezas = Math.max(base.piezasTotales, Math.ceil(areaComprada / (pL * pA)));

  // Costo estimado
  let costoEstimado = 0;
  if (material.modo_precio === 'm2') {
    costoEstimado = areaComprada * (material.precio_m2 ?? 0);
  } else if (material.modo_precio === 'caja' && material.m2_caja && material.precio_caja) {
    const cajas = Math.ceil(areaComprada / material.m2_caja);
    costoEstimado = cajas * material.precio_caja;
  }

  return {
    areaNecesaria,
    areaComprada,
    desperdicioPct: desperdicioFinal,
    piezas,
    orientacion: material.formato_largo && material.formato_ancho
      ? (material.formato_largo >= material.formato_ancho ? 'largo' : 'ancho')
      : base.orientacion,
    exacto: base.piezasTotales === Math.ceil(areaNecesaria / (pL * pA)),
    costoEstimado,
    cajasNecesarias: material.modo_precio === 'caja' && material.m2_caja
      ? Math.ceil(areaComprada / material.m2_caja)
      : undefined,
    m2PorCaja: material.m2_caja,
  };
}

export interface SobranteItem {
  ancho: number;
  alto: number;
  cantidad: number;
  origen: string;
}

export interface SobrantesResult {
  umbralCm: number;
  sobrantes: SobranteItem[];
  descartados: SobranteItem[];
  totalCortes: number;
}

export function umbralPorMaterial(material: MaterialInput): number {
  const tipo = material.tipo_acabado;
  if (['Microcemento', 'Resina Epóxica', 'Concreto Pulido'].includes(tipo)) return 0;
  if (['Cerámica', 'Porcelanato', 'Piedra Natural (Mármol/Granito/Travertino)'].includes(tipo)) return 10;
  return 15;
}

export function calcularSobrantesEspacio(
  espacio: EspacioInput,
  material: MaterialInput,
  usarLadoMayor = true,
): SobrantesResult {
  if (isContinuo(material)) {
    return { umbralCm: 0, sobrantes: [], descartados: [], totalCortes: 0 };
  }

  const umbralCm = umbralPorMaterial(material);
  const umbralM = umbralCm / 100;

  const pL = ((material.formato_largo ?? 60) / 100);
  const pA = ((material.formato_ancho ?? 60) / 100);
  const piezaLargo = Math.max(pL, pA);
  const piezaAncho = Math.min(pL, pA);

  const sobrantes: SobranteItem[] = [];
  const descartados: SobranteItem[] = [];
  let totalCortes = 0;

  for (const seg of espacio.segmentos) {
    const filas = Math.floor(seg.ancho / piezaAncho);
    const restoAncho = seg.ancho - filas * piezaAncho;
    const columnas = Math.floor(seg.largo / piezaLargo);
    const restoLargo = seg.largo - columnas * piezaLargo;

    totalCortes += filas + columnas;

    // Sobrantes de cortes por el lado largo
    if (restoLargo > 0) {
      const sobrante: SobranteItem = {
        ancho: restoLargo,
        alto: piezaAncho,
        cantidad: filas,
        origen: 'corte longitudinal',
      };
      if (sobrante.ancho >= umbralM && sobrante.alto >= umbralM) {
        sobrantes.push(sobrante);
      } else {
        descartados.push(sobrante);
      }
    }

    // Sobrantes de cortes por el lado ancho
    if (restoAncho > 0) {
      const sobrante: SobranteItem = {
        ancho: piezaLargo,
        alto: restoAncho,
        cantidad: columnas,
        origen: 'corte transversal',
      };
      if (sobrante.ancho >= umbralM && sobrante.alto >= umbralM) {
        sobrantes.push(sobrante);
      } else {
        descartados.push(sobrante);
      }
    }

    // Esquina sobrante
    if (restoLargo > 0 && restoAncho > 0) {
      const sobrante: SobranteItem = {
        ancho: restoLargo,
        alto: restoAncho,
        cantidad: 1,
        origen: 'esquina sobrante',
      };
      if (sobrante.ancho >= umbralM && sobrante.alto >= umbralM) {
        sobrantes.push(sobrante);
      } else {
        descartados.push(sobrante);
      }
    }
  }

  return { umbralCm, sobrantes, descartados, totalCortes };
}
