import { Component, computed, input, output } from '@angular/core';
import { CarasDiente, CaraVisual, DienteData } from '../../models/odontograma.models';

type FormaDiente = 'incisivo' | 'canino' | 'premolar' | 'molar';
export type CaraCirculoId = keyof CarasDiente;

export interface IndicadorCara {
  id: string;
  etiqueta: string;
  estado: string;
  colorHex: string;
}

const COLOR_POR_DEFECTO_CARA = '#fffef9';

const COLORES_POR_ESTADO: Record<string, string> = {
  sano: '#22C55E',
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
  corona: '#EAB308',
  'póntico': '#FBBF24',
  pontico: '#FBBF24',
  'prótesis removible': '#F472B6',
  'protesis removible': '#F472B6',
  implante: '#14B8A6',
  ausente: '#6B7280',
  'extraído': '#64748B',
  extraido: '#64748B',
  'resto radicular': '#78716C',
  retenido: '#A855F7',
  'en erupción': '#84CC16',
  'en erupcion': '#84CC16'
};

/**
 * Prioridad clínica para determinar el estado/color predominante en la figura del diente
 * cuando varias caras presentan distintos hallazgos (Patologías > Tratamientos > Prevención > Sano).
 */
const PRIORIDAD_CLINICA_POR_ESTADO: Record<string, number> = {
  caries: 100,
  fracturado: 95,
  'rest. defectuosa': 90,
  'desgaste/abfracción': 85,
  'desgaste/abfraccion': 85,
  'obturación temporal': 70,
  'obturacion temporal': 70,
  restaurado: 60,
  sellante: 50,
  sano: 10,
  presente: 0
};

const ETIQUETA_FALLBACK_POR_CARA: Record<CaraCirculoId, string> = {
  vestibular: 'Vestibular',
  palatino_lingual: 'Palatino/Lingual',
  mesial: 'Mesial',
  distal: 'Distal',
  oclusal_incisal: 'Oclusal/Incisal'
};

@Component({
  selector: 'app-diente-grafico',
  standalone: true,
  templateUrl: './diente-grafico.html',
  styleUrl: './diente-grafico.scss'
})
export class DienteGraficoComponent {
  numeroDiente = input.required<number>();
  estado = input('Sano');
  diente = input<DienteData | null>(null);
  seleccionado = input(false);

  dienteClickeado = output<number>();

  readonly forma = computed<FormaDiente>(() => {
    const unidad = this.numeroDiente() % 10;
    if (unidad === 1 || unidad === 2) {
      return 'incisivo';
    }
    if (unidad === 3) {
      return 'canino';
    }
    if (unidad === 4 || unidad === 5) {
      return 'premolar';
    }
    return 'molar';
  });

  /**
   * Lista de caras con hallazgos distintos de Sano/Presente ordenadas por prioridad clínica,
   * o indicador de pieza evaluada como Sana cuando fue diagnosticada por el Backend.
   */
  readonly carasConHallazgo = computed<IndicadorCara[]>(() => {
    const data = this.diente();
    if (!data?.caras) {
      return [];
    }

    const orden: Array<[CaraCirculoId, CaraVisual]> = [
      ['oclusal_incisal', data.caras.oclusal_incisal],
      ['vestibular', data.caras.vestibular],
      ['mesial', data.caras.mesial],
      ['distal', data.caras.distal],
      ['palatino_lingual', data.caras.palatino_lingual]
    ];

    const patologias = orden
      .filter(([, cara]) => cara && !this.esEstadoSanoOPresente(cara.estado))
      .map(([id, cara]) => ({
        id,
        etiqueta: cara.etiquetaVisual || ETIQUETA_FALLBACK_POR_CARA[id],
        estado: cara.estado,
        colorHex: this.resolverColorEstado(cara.estado, cara.colorHex),
        prioridad: this.obtenerPrioridadClinica(cara.estado)
      }))
      .sort((a, b) => b.prioridad - a.prioridad)
      .map(({ id, etiqueta, estado, colorHex }) => ({ id, etiqueta, estado, colorHex }));

    if (patologias.length > 0) {
      return patologias;
    }

    if (this.fueEvaluadoComoSano()) {
      return [
        {
          id: 'sano-evaluado',
          etiqueta: 'Diagnóstico',
          estado: 'Sano',
          colorHex: this.resolverColorEstado('Sano', data.estadoGeneral?.colorHex ?? '#22C55E')
        }
      ];
    }

    return [];
  });

  /**
   * Indica si el diente fue evaluado por el Backend (posee color clínico explícito distinto del blanco neutro inicial).
   */
  readonly fueEvaluadoComoSano = computed<boolean>(() => {
    const data = this.diente();
    if (!data) {
      return false;
    }
    if (this.tieneColorClinicoExplicito(data.estadoGeneral?.colorHex)) {
      return true;
    }
    if (!data.caras) {
      return false;
    }
    return Object.values(data.caras).some((cara) => this.tieneColorClinicoExplicito(cara?.colorHex));
  });

  /**
   * Determina si la figura principal del diente debe pintarse (porque tiene hallazgo o fue evaluado como Sano).
   */
  readonly tieneHallazgo = computed<boolean>(() => {
    const data = this.diente();
    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();
    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      return true;
    }
    if (this.carasConHallazgo().length > 0) {
      return true;
    }
    return this.fueEvaluadoComoSano();
  });

  /**
   * Indica si el diente está ausente o extraído para aplicar estilo visual correspondiente.
   */
  readonly esAusenteOExtraido = computed<boolean>(() => {
    const data = this.diente();
    const estadoGeneral = (data?.estadoGeneral?.estado ?? this.estado()).trim().toLowerCase();
    return estadoGeneral === 'ausente' || estadoGeneral === 'extraído' || estadoGeneral === 'extraido';
  });

  /**
   * Estado descriptivo principal del diente para accesibilidad y visualización.
   */
  readonly etiquetaEstado = computed<string>(() => {
    const data = this.diente();
    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();
    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      return estadoGeneral;
    }
    const hallazgos = this.carasConHallazgo();
    if (hallazgos.length > 0) {
      return hallazgos.map((h) => `${h.etiqueta}: ${h.estado}`).join(', ');
    }
    return 'Sano';
  });

  /**
   * Color hexadecimal predominante para la figura principal del diente (.diente-svg):
   * 1. Si existe un estado general de diente completo (ej. Corona, Endodoncia, Ausente), usa su color.
   * 2. Si existen caras afectadas, usa el color de la cara con mayor prioridad clínica (ej. Caries > Restaurado).
   * 3. Si el diente fue evaluado como Sano sin caras afectadas, usa verde (#22C55E).
   * 4. Antes de cualquier dictado, retorna null (manteniendo el color marfil inicial).
   */
  readonly colorHallazgo = computed<string | null>(() => {
    const data = this.diente();
    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();

    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      return this.resolverColorEstado(estadoGeneral, data?.estadoGeneral?.colorHex ?? null);
    }

    const hallazgos = this.carasConHallazgo();
    if (hallazgos.length > 0) {
      return hallazgos[0].colorHex;
    }

    if (this.fueEvaluadoComoSano()) {
      return this.resolverColorEstado('Sano', data?.estadoGeneral?.colorHex ?? '#22C55E');
    }

    return null;
  });

  /**
   * Resuelve el color de cada segmento en el diagrama circular de 5 caras (.diagrama-circular-svg):
   * - Si la cara tiene un hallazgo/patología (distinto de 'Sano' y 'Presente'), devuelve su colorHex exacto.
   * - Si el diente completo tiene un estado general activo (ej. Corona, Endodoncia, Ausente), pinta las 5 caras con ese color.
   * - Si la cara está en estado 'Sano' (o 'Presente'), conserva el color neutro por defecto (#fffef9).
   */
  colorCaraCirculo(caraId: CaraCirculoId): string {
    const data = this.diente();
    const cara = data?.caras?.[caraId];

    if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
      return this.resolverColorEstado(cara.estado, cara.colorHex);
    }

    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();
    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      return this.resolverColorEstado(estadoGeneral, data?.estadoGeneral?.colorHex ?? null);
    }

    return COLOR_POR_DEFECTO_CARA;
  }

  /**
   * Indica si una cara específica del diagrama circular presenta un estado activo (distinto de Sano/Presente).
   */
  caraTieneHallazgoCirculo(caraId: CaraCirculoId): boolean {
    return this.colorCaraCirculo(caraId) !== COLOR_POR_DEFECTO_CARA;
  }

  /**
   * Etiqueta descriptiva para el tooltip de cada segmento del diagrama circular.
   */
  tituloCaraCirculo(caraId: CaraCirculoId): string {
    const data = this.diente();
    const cara = data?.caras?.[caraId];
    const etiqueta = cara?.etiquetaVisual || ETIQUETA_FALLBACK_POR_CARA[caraId];
    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();

    if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
      return `${etiqueta}: ${cara.estado}`;
    }
    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      return `${etiqueta}: ${estadoGeneral}`;
    }
    return `${etiqueta}: ${cara?.estado || 'Sano'}`;
  }

  onDienteClick(): void {
    this.dienteClickeado.emit(this.numeroDiente());
  }

  private obtenerPrioridadClinica(estado: string | null | undefined): number {
    if (!estado) return 0;
    return PRIORIDAD_CLINICA_POR_ESTADO[estado.trim().toLowerCase()] ?? 75;
  }

  private esEstadoSanoOPresente(estado: string | null | undefined): boolean {
    if (!estado) return true;
    const norm = estado.trim().toLowerCase();
    return norm === 'sano' || norm === 'presente';
  }

  private tieneColorClinicoExplicito(colorHex: string | null | undefined): boolean {
    if (!colorHex) return false;
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);
    return !coloresNeutros.has(colorHex.trim().toLowerCase());
  }

  private resolverColorEstado(estado: string, colorHex: string | null): string {
    if (this.tieneColorClinicoExplicito(colorHex)) {
      return colorHex!;
    }
    return COLORES_POR_ESTADO[estado.trim().toLowerCase()] ?? '#F59E0B';
  }
}
