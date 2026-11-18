// features/odontograma/models/odontograma.models.ts

/**
 * Union Type con los estados clínicos permitidos. 
 * Esto asegura que el compilador arroje error si intentamos asignar un estado que no existe.
 */
export type EstadoClinico = 
  | 'Sano' 
  | 'Presente'
  | 'Sellante'
  | 'Caries' 
  | 'Fracturado' 
  | 'Desgaste/Abfracción'
  | 'Rest. Defectuosa'
  | 'Restaurado' 
  | 'Obturación Temporal'
  | 'Endodoncia'
  | 'Núcleo/Poste'
  | 'Apicectomía'
  | 'Lesión Periapical'
  | 'Fractura Radicular'
  | 'Perforación Radicular'
  | 'Lesión de Furca'
  | 'Recesión Gingival'
  | 'Cálculo Subgingival'
  | 'Reabsorción Radicular'
  | 'Anomalía Radicular'
  | 'Resto Radicular'
  | 'Corona' 
  | 'Póntico'
  | 'Prótesis Removible'
  | 'Implante'
  | 'Ausente' 
  | 'Extraído' 
  | 'Retenido'
  | 'En Erupción';

export type GrupoDental = 'ANTERIOR' | 'POSTERIOR';
export type ArcadaDental = 'SUPERIOR' | 'INFERIOR';

/**
 * Representa el estado individual de una de las 5 caras del diente
 */
export interface CaraVisual {
  etiquetaVisual: string; // ej: "Mesial", "Oclusal", "Palatino"
  estado: EstadoClinico | string; // Se permite string como fallback por si el backend envía algo nuevo
  colorHex: string | null; // ej: "#EF4444" o null
}

/**
 * Agrupa las 5 caras exactas que envía el backend
 */
export interface CarasDiente {
  mesial: CaraVisual;
  distal: CaraVisual;
  vestibular: CaraVisual;
  palatino_lingual: CaraVisual;
  oclusal_incisal: CaraVisual;
}

export type SuperficieDentalId = keyof CarasDiente | 'raiz';

/**
 * Representa el estado a nivel del diente completo o de su raíz
 */
export interface EstadoGeneral {
  estado: EstadoClinico | string;
  colorHex: string | null;
}

/**
 * Estructura central de un Diente
 */
export interface DienteData {
  numero: number;
  nombreColoquial: string;
  cuadrante?: number;
  grupoDental?: GrupoDental | string;
  estadoGeneral: EstadoGeneral;
  caras: CarasDiente;
  raiz?: CaraVisual;
}

/**
 * Opción de estado clínico con su color semántico oficial para desplegables de edición
 */
export interface OpcionEstadoClinico {
  estado: EstadoClinico;
  colorHex: string;
  exclusivoDeRaiz?: boolean;
  dienteCompleto?: boolean;
  afectaRaiz?: boolean;
}

/**
 * Catálogo oficial de estados clínicos y sus colores hexadecimales sincronizado con el Backend
 */
export const CATALOGO_ESTADOS_CLINICOS: readonly OpcionEstadoClinico[] = [
  { estado: 'Sano', colorHex: '#22C55E' },
  { estado: 'Presente', colorHex: '#22C55E' },
  { estado: 'Sellante', colorHex: '#06B6D4' },
  { estado: 'Caries', colorHex: '#EF4444' },
  { estado: 'Fracturado', colorHex: '#F97316' },
  { estado: 'Desgaste/Abfracción', colorHex: '#FDBA74' },
  { estado: 'Rest. Defectuosa', colorHex: '#E11D48' },
  { estado: 'Restaurado', colorHex: '#3B82F6' },
  { estado: 'Obturación Temporal', colorHex: '#94A3B8' },
  { estado: 'Endodoncia', colorHex: '#D946EF', dienteCompleto: true, afectaRaiz: true },
  { estado: 'Núcleo/Poste', colorHex: '#8B5CF6', dienteCompleto: true, afectaRaiz: true },
  { estado: 'Apicectomía', colorHex: '#C026D3', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Lesión Periapical', colorHex: '#991B1B', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Fractura Radicular', colorHex: '#B91C1C', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Perforación Radicular', colorHex: '#BE123C', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Lesión de Furca', colorHex: '#B45309', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Recesión Gingival', colorHex: '#D97706', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Cálculo Subgingival', colorHex: '#92400E', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Reabsorción Radicular', colorHex: '#7C2D12', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Anomalía Radicular', colorHex: '#0369A1', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Resto Radicular', colorHex: '#78716C', exclusivoDeRaiz: true, afectaRaiz: true },
  { estado: 'Corona', colorHex: '#EAB308', dienteCompleto: true },
  { estado: 'Póntico', colorHex: '#FBBF24', dienteCompleto: true },
  { estado: 'Prótesis Removible', colorHex: '#F472B6', dienteCompleto: true },
  { estado: 'Implante', colorHex: '#14B8A6', dienteCompleto: true, afectaRaiz: true },
  { estado: 'Ausente', colorHex: '#6B7280', dienteCompleto: true, afectaRaiz: true },
  { estado: 'Extraído', colorHex: '#64748B', dienteCompleto: true, afectaRaiz: true },
  { estado: 'Retenido', colorHex: '#A855F7', dienteCompleto: true, afectaRaiz: true },
  { estado: 'En Erupción', colorHex: '#84CC16', dienteCompleto: true, afectaRaiz: true }
];

export const MAPA_COLORES_POR_ESTADO: Record<string, string> = {
  sano: '#22C55E',
  presente: '#22C55E',
  sellante: '#06B6D4',
  caries: '#EF4444',
  fracturado: '#F97316',
  'desgaste/abfracción': '#FDBA74',
  'desgaste/abfraccion': '#FDBA74',
  'rest. defectuosa': '#E11D48',
  restaurado: '#3B82F6',
  'obturación temporal': '#94A3B8',
  'obturacion temporal': '#94A3B8',
  endodoncia: '#D946EF',
  'núcleo/poste': '#8B5CF6',
  'nucleo/poste': '#8B5CF6',
  'apicectomía': '#C026D3',
  apicectomia: '#C026D3',
  'lesión periapical': '#991B1B',
  'lesion periapical': '#991B1B',
  'fractura radicular': '#B91C1C',
  'perforación radicular': '#BE123C',
  'perforacion radicular': '#BE123C',
  'lesión de furca': '#B45309',
  'lesion de furca': '#B45309',
  'recesión gingival': '#D97706',
  'recesion gingival': '#D97706',
  'cálculo subgingival': '#92400E',
  'calculo subgingival': '#92400E',
  'reabsorción radicular': '#7C2D12',
  'reabsorcion radicular': '#7C2D12',
  'anomalía radicular': '#0369A1',
  'anomalia radicular': '#0369A1',
  'resto radicular': '#78716C',
  corona: '#EAB308',
  'póntico': '#FBBF24',
  pontico: '#FBBF24',
  'prótesis removible': '#F472B6',
  'protesis removible': '#F472B6',
  implante: '#14B8A6',
  ausente: '#6B7280',
  'extraído': '#64748B',
  extraido: '#64748B',
  retenido: '#A855F7',
  'en erupción': '#84CC16',
  'en erupcion': '#84CC16'
};

export function resolverColorPorEstadoClinico(estado: string | null | undefined, colorHexExplicito?: string | null): string {
  const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);
  if (colorHexExplicito && !coloresNeutros.has(colorHexExplicito.trim().toLowerCase())) {
    return colorHexExplicito;
  }
  if (!estado) {
    return '#22C55E';
  }
  return MAPA_COLORES_POR_ESTADO[estado.trim().toLowerCase()] ?? '#F59E0B';
}

/**
 * Metadatos del catálogo oficial FDI de 32 dientes permanentes
 */
export interface DienteFdiMetadata {
  numero: number;
  cuadrante: number;
  posicion: number;
  nombreColoquial: string;
  arcada: ArcadaDental | string;
  grupo: GrupoDental | string;
}

// ==========================================
// CONTRATOS DE TRANSFERENCIA (DTOS)
// ==========================================

/**
 * Contrato de Entrada: JSON que llega del Backend hacia el Frontend 
 * para actualizar el odontograma tras procesar la IA.
 */
export interface OdontogramaUpdateResponse {
  odontogramaId: string;
  dientes: DienteData[];
  diente?: DienteData; // Fallback opcional por si algún mock envía singular
}

/**
 * Contrato de Salida: JSON que envía el Frontend hacia el Backend
 * cuando el micrófono termina de capturar la frase o se envía el texto.
 */
export interface VoiceCaptureRequest {
  odontogramaId: string;
  textoCapturado: string;
  prompt?: string | null;
}

/**
 * Contrato de Salida para persistir la edición manual de las caras y raíz de un diente en el Backend.
 */
export interface ActualizarDienteRequest {
  odontogramaId?: string;
  numeroDiente: number;
  caras: Record<keyof CarasDiente, EstadoClinico | string>;
  raiz: EstadoClinico | string;
}

const PRIORIDAD_CLINICA_ESTADOS: Record<string, number> = {
  ausente: 110,
  'extraído': 110,
  extraido: 110,
  caries: 100,
  fracturado: 95,
  'fractura radicular': 94,
  'lesión periapical': 92,
  'lesion periapical': 92,
  'perforación radicular': 91,
  'perforacion radicular': 91,
  'rest. defectuosa': 90,
  'desgaste/abfracción': 85,
  'desgaste/abfraccion': 85,
  endodoncia: 80,
  'núcleo/poste': 78,
  'nucleo/poste': 78,
  corona: 76,
  implante: 75,
  'obturación temporal': 70,
  'obturacion temporal': 70,
  restaurado: 60,
  sellante: 50,
  sano: 10,
  presente: 0
};

function esSanoOPresente(estado: string | null | undefined): boolean {
  if (!estado) return true;
  const norm = estado.trim().toLowerCase();
  return norm === 'sano' || norm === 'presente';
}

/**
 * Construye el DienteData actualizado con sus colores semánticos resueltos
 * (simulando la respuesta enriquecida del Backend tras editar caras/raíz).
 */
export function construirDienteActualizado(
  dienteBase: DienteData,
  cambiosCaras: Record<keyof CarasDiente, EstadoClinico | string>,
  estadoRaiz: EstadoClinico | string
): DienteData {
  const construirCara = (id: keyof CarasDiente): CaraVisual => {
    const etiquetaVisual = dienteBase.caras[id]?.etiquetaVisual || id;
    const estado = cambiosCaras[id] ?? dienteBase.caras[id]?.estado ?? 'Sano';
    const colorHex = esSanoOPresente(estado)
      ? '#ffffff'
      : resolverColorPorEstadoClinico(estado);
    return { etiquetaVisual, estado, colorHex };
  };

  const nuevasCaras: CarasDiente = {
    vestibular: construirCara('vestibular'),
    palatino_lingual: construirCara('palatino_lingual'),
    mesial: construirCara('mesial'),
    distal: construirCara('distal'),
    oclusal_incisal: construirCara('oclusal_incisal')
  };

  const nuevaRaiz: CaraVisual = {
    etiquetaVisual: dienteBase.raiz?.etiquetaVisual || 'Raíz',
    estado: estadoRaiz || 'Sano',
    colorHex: esSanoOPresente(estadoRaiz)
      ? '#ffffff'
      : resolverColorPorEstadoClinico(estadoRaiz)
  };

  // Determinar estadoGeneral predominante para el resumen del diente
  const todasLasSuperficies: CaraVisual[] = [
    nuevasCaras.oclusal_incisal,
    nuevasCaras.vestibular,
    nuevasCaras.mesial,
    nuevasCaras.distal,
    nuevasCaras.palatino_lingual,
    nuevaRaiz
  ];

  const conHallazgo = todasLasSuperficies
    .filter((c) => !esSanoOPresente(c.estado))
    .sort(
      (a, b) =>
        (PRIORIDAD_CLINICA_ESTADOS[b.estado.trim().toLowerCase()] ?? 65) -
        (PRIORIDAD_CLINICA_ESTADOS[a.estado.trim().toLowerCase()] ?? 65)
    );

  const estadoGeneral: EstadoGeneral =
    conHallazgo.length > 0
      ? {
          estado: conHallazgo[0].estado,
          colorHex: resolverColorPorEstadoClinico(conHallazgo[0].estado, conHallazgo[0].colorHex)
        }
      : {
          estado: 'Sano',
          colorHex: '#ffffff'
        };

  return {
    ...dienteBase,
    estadoGeneral,
    caras: nuevasCaras,
    raiz: nuevaRaiz
  };
}
