import { Component, computed, input, output } from '@angular/core';
import {
  CarasDiente,
  CaraVisual,
  DienteData,
  esEstadoExclusivoDeRaiz
} from '../../models/odontograma.models';

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

/**
 * Estados de diente completo que involucran tanto la raíz (.raiz) como la corona (.corona) y las caras.
 */
const ESTADOS_DIENTE_COMPLETO_CON_RAIZ = new Set<string>([
  'endodoncia',
  'núcleo/poste',
  'nucleo/poste',
  'implante',
  'ausente',
  'extraído',
  'extraido',
  'retenido',
  'en erupción',
  'en erupcion'
]);

/**
 * Prioridad clínica para determinar el estado/color predominante en la parte baja/visible del diente (.corona)
 * cuando varias caras presentan distintos hallazgos (Patologías > Tratamientos > Prevención).
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
   * Lista de caras coronales con novedades distintas de Sano/Presente y que no sean exclusivas de raíz,
   * ordenadas por prioridad clínica descendente.
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

    return orden
      .filter(
        ([, cara]) =>
          cara &&
          !this.esEstadoSanoOPresente(cara.estado) &&
          (data.raiz !== undefined || !esEstadoExclusivoDeRaiz(cara.estado))
      )
      .map(([id, cara]) => ({
        id,
        etiqueta: cara.etiquetaVisual || ETIQUETA_FALLBACK_POR_CARA[id],
        estado: cara.estado,
        colorHex: this.resolverColorEstado(cara.estado, cara.colorHex),
        prioridad: this.obtenerPrioridadClinica(cara.estado)
      }))
      .sort((a, b) => b.prioridad - a.prioridad)
      .map(({ id, etiqueta, estado, colorHex }) => ({ id, etiqueta, estado, colorHex }));
  });

  /**
   * Color hexadecimal exclusivo para la parte alargada del SVG que representa la RAÍZ (.raiz).
   * Solo se pinta cuando el diente presenta una lesión radicular, un estado en su cara 'raiz'
   * o un estado de diente completo con raíz.
   */
  readonly colorRaiz = computed<string | null>(() => {
    const data = this.diente();
    if (data?.raiz !== undefined) {
      if (!this.esEstadoSanoOPresente(data.raiz.estado)) {
        return this.resolverColorEstado(data.raiz.estado, data.raiz.colorHex);
      }
      return null;
    }
    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();
    if (this.afectaRaiz(estadoGeneral)) {
      return this.resolverColorEstado(estadoGeneral, data?.estadoGeneral?.colorHex ?? null);
    }
    return null;
  });

  /**
   * Color hexadecimal para la parte baja/visible del SVG que representa el DIENTE/CORONA (.corona).
   * Se pinta cuando existen hallazgos en las caras coronales o estados generales que afectan la corona
   * (ej. Caries, Restaurado, Corona, Endodoncia). No se pinta si la lesión es exclusiva de la raíz.
   */
  readonly colorCorona = computed<string | null>(() => {
    const data = this.diente();
    const hallazgos = this.carasConHallazgo();

    if (data?.raiz !== undefined) {
      if (hallazgos.length > 0) {
        return hallazgos[0].colorHex;
      }
      const estadoRaizNorm = (data.raiz.estado ?? '').trim().toLowerCase();
      if (ESTADOS_DIENTE_COMPLETO_CON_RAIZ.has(estadoRaizNorm)) {
        return this.resolverColorEstado(data.raiz.estado, data.raiz.colorHex);
      }
      return null;
    }

    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();

    if (
      !this.esEstadoSanoOPresente(estadoGeneral) &&
      !esEstadoExclusivoDeRaiz(estadoGeneral)
    ) {
      return this.resolverColorEstado(estadoGeneral, data?.estadoGeneral?.colorHex ?? null);
    }

    if (hallazgos.length > 0) {
      return hallazgos[0].colorHex;
    }

    return null;
  });

  /**
   * Determina si el diente tiene alguna novedad (ya sea en la corona o en la raíz).
   */
  readonly tieneHallazgo = computed<boolean>(() => {
    return this.colorCorona() !== null || this.colorRaiz() !== null;
  });

  /**
   * Color principal de hallazgo del diente (priorizando corona y luego raíz para compatibilidad).
   */
  readonly colorHallazgo = computed<string | null>(() => {
    return this.colorCorona() ?? this.colorRaiz();
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
    const partes: string[] = [];

    if (!this.esEstadoSanoOPresente(estadoGeneral)) {
      partes.push(estadoGeneral);
    }
    const hallazgos = this.carasConHallazgo();
    if (hallazgos.length > 0 && ! ESTADOS_DIENTE_COMPLETO_CON_RAIZ.has(estadoGeneral.trim().toLowerCase())) {
      partes.push(...hallazgos.map((h) => `${h.etiqueta}: ${h.estado}`));
    }
    return partes.length > 0 ? partes.join(', ') : 'Sano';
  });

  /**
   * Resuelve el color de cada segmento en el diagrama circular de 5 caras (.diagrama-circular-svg):
   * - Si la cara tiene un hallazgo coronal (distinto de 'Sano', 'Presente' y no exclusivo de raíz), usa su colorHex.
   * - Si el diente tiene un estado general que afecta las caras coronales (ej. Endodoncia, Corona), pinta las 5 caras.
   * - Si el diente solo tiene una lesión de raíz (ej. Fractura Radicular) o la cara está Sana, conserva #fffef9.
   */
  colorCaraCirculo(caraId: CaraCirculoId): string {
    const data = this.diente();
    const cara = data?.caras?.[caraId];

    if (data?.raiz !== undefined) {
      if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
        return this.resolverColorEstado(cara.estado, cara.colorHex);
      }
      return COLOR_POR_DEFECTO_CARA;
    }

    if (
      cara &&
      !this.esEstadoSanoOPresente(cara.estado) &&
      !esEstadoExclusivoDeRaiz(cara.estado)
    ) {
      return this.resolverColorEstado(cara.estado, cara.colorHex);
    }

    const estadoGeneral = data?.estadoGeneral?.estado ?? this.estado();
    if (
      !this.esEstadoSanoOPresente(estadoGeneral) &&
      !esEstadoExclusivoDeRaiz(estadoGeneral)
    ) {
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

    if (data?.raiz !== undefined) {
      if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
        return `${etiqueta}: ${cara.estado}`;
      }
      return `${etiqueta}: Sano`;
    }

    if (
      cara &&
      !this.esEstadoSanoOPresente(cara.estado) &&
      !esEstadoExclusivoDeRaiz(cara.estado)
    ) {
      return `${etiqueta}: ${cara.estado}`;
    }
    if (
      !this.esEstadoSanoOPresente(estadoGeneral) &&
      !esEstadoExclusivoDeRaiz(estadoGeneral)
    ) {
      return `${etiqueta}: ${estadoGeneral}`;
    }
    return `${etiqueta}: Sano`;
  }

  onDienteClick(): void {
    this.dienteClickeado.emit(this.numeroDiente());
  }

  private afectaRaiz(estado: string | null | undefined): boolean {
    if (!estado) return false;
    const norm = estado.trim().toLowerCase();
    return esEstadoExclusivoDeRaiz(norm) || ESTADOS_DIENTE_COMPLETO_CON_RAIZ.has(norm);
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
