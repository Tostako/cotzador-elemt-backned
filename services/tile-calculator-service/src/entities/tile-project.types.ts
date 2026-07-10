export interface Nivel {
  id: string;
  nombre: string;
  espacios: unknown[];
  conexiones: unknown[];
}

export interface Material {
  id: string;
  nombre: string;
  tipo_acabado: string;
  formato_largo?: number;
  formato_ancho?: number;
  formato_grosor?: number;
  color?: string;
  marca?: string;
  categoria: string;
  m2_caja?: number;
  peso_caja?: number;
  modo_precio: string;
  precio_m2?: number;
  precio_caja?: number;
  umbral_sobrante_cm?: number;
}

export interface Sobrante {
  id: string;
  material_id: string;
  ancho: number;
  alto: number;
  cantidad: number;
  origen_nivel_id: string;
  origen_space_id: string;
  patron_id: string;
  direccion: string;
  total_cortes?: number;
  tramo_index: number;
  origen: string;
  fecha: string;
}
