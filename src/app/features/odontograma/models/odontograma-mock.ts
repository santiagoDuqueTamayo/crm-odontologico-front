import {
  CarasDiente,
  DienteData,
  EstadoClinico,
  OdontogramaUpdateResponse
} from './odontograma.models';

type CaraDienteId = keyof CarasDiente;

const COLORES_ESTADO: Record<EstadoClinico, string | null> = {
  Sano: '#22C55E',
  Caries: '#EF4444',
  Restaurado: '#3B82F6',
  Fracturado: '#F97316',
  Ausente: '#6B7280',
  'Extraído': '#64748B',
  Retenido: '#A855F7',
  Corona: '#EAB308',
  Implante: '#14B8A6',
  Sellante: '#06B6D4',
  Presente: null
};

const ETIQUETAS_CARA: Record<CaraDienteId, string> = {
  mesial: 'Mesial',
  distal: 'Distal',
  vestibular: 'Vestibular',
  palatino_lingual: 'Palatino/Lingual',
  oclusal_incisal: 'Oclusal/Incisal'
};

function crearDienteMock(
  numero: number,
  estadoGeneral: EstadoClinico,
  hallazgos: Partial<Record<CaraDienteId, EstadoClinico>> = {}
): DienteData {
  const estadoCaraPorDefecto = estadoGeneral === 'Sano' ? 'Sano' : 'Presente';
  const crearCara = (id: CaraDienteId) => {
    const estado = hallazgos[id] ?? estadoCaraPorDefecto;
    return {
      etiquetaVisual: ETIQUETAS_CARA[id],
      estado,
      colorHex: COLORES_ESTADO[estado]
    };
  };

  const caras: CarasDiente = {
    mesial: crearCara('mesial'),
    distal: crearCara('distal'),
    vestibular: crearCara('vestibular'),
    palatino_lingual: crearCara('palatino_lingual'),
    oclusal_incisal: crearCara('oclusal_incisal')
  };

  return {
    numero,
    nombreColoquial: `Diente ${numero}`,
    cuadrante: Math.floor(numero / 10),
    estadoGeneral: {
      estado: estadoGeneral,
      colorHex: COLORES_ESTADO[estadoGeneral]
    },
    caras
  };
}

export const ODONTOGRAMA_RESPUESTA_MOCK: OdontogramaUpdateResponse = {
  odontogramaId: 'odont-demo',
  dientes: [
    crearDienteMock(16, 'Presente', {
      vestibular: 'Caries',
      oclusal_incisal: 'Sellante'
    }),
    crearDienteMock(14, 'Presente', { distal: 'Restaurado' }),
    crearDienteMock(22, 'Presente', { mesial: 'Fracturado' }),
    crearDienteMock(25, 'Corona'),
    crearDienteMock(31, 'Ausente'),
    crearDienteMock(41, 'Ausente'),
    crearDienteMock(36, 'Implante'),
    crearDienteMock(45, 'Retenido'),
    crearDienteMock(48, 'Extraído')
  ]
};
