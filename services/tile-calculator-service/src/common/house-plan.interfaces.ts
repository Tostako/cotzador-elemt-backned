export interface Punto {
  x?: number;
  y?: number;
}

export interface Nodo extends Punto {
  id: string;
}

export interface Muro {
  a: string;
  b: string;
  abertura?: boolean;
  columnas?: number;
}

export interface Segmento {
  largo: number;
  ancho: number;
}

export interface Espacio {
  id: string;
  nombre: string;
  tipo: string;
  nodos?: Nodo[];
  muros?: Muro[];
  puntos?: Punto[];
  segmentos?: Segmento[];
  x?: number;
  y?: number;
  area?: number;
  perimetro?: number;
  perimetro_muro?: number;
  [key: string]: any;
}

export interface Conexion {
  id: string;
  a: string;
  b: string;
}

export interface Nivel {
  id: string;
  nombre: string;
  espacios?: Espacio[];
  conexiones?: Conexion[];
  [key: string]: any;
}
