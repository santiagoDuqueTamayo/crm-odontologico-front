import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { OdontogramaGridComponent } from '../components/odontograma-grid/odontograma-grid';
import { CaraDienteId } from '../components/detalle-pieza/detalle-pieza';
import { ModalDetalleDienteComponent } from '../components/modal-detalle-diente/modal-detalle-diente';
import { NotaClinicaComponent } from '../components/nota-clinica/nota-clinica';
import { PacienteFormComponent } from '../components/paciente-form/paciente-form';
import { crearPacienteVacio, DatosPaciente } from '../models/paciente.models';
import {
  ActualizarDienteRequest,
  CarasDiente,
  DienteData,
  OdontogramaUpdateResponse
} from '../models/odontograma.models';
import { OdontogramaApiService } from '../services/odontograma-api.service';

@Component({
  selector: 'app-odontograma-view',
  standalone: true,
  imports: [OdontogramaGridComponent, ModalDetalleDienteComponent, NotaClinicaComponent, PacienteFormComponent],
  templateUrl: './odontograma-view.html',
  styleUrl: './odontograma-view.scss'
})
export class OdontogramaViewComponent {
  private readonly odontogramaApi = inject(OdontogramaApiService);

  readonly estadosClinicos = [
    { nombre: 'Sano', color: '#22C55E' },
    { nombre: 'Presente', color: null },
    { nombre: 'Sellante', color: '#06B6D4' },
    { nombre: 'Caries', color: '#EF4444' },
    { nombre: 'Fracturado', color: '#F97316' },
    { nombre: 'Desgaste/Abfracción', color: '#FDBA74' },
    { nombre: 'Rest. Defectuosa', color: '#E11D48' },
    { nombre: 'Restaurado', color: '#3B82F6' },
    { nombre: 'Obturación Temporal', color: '#94A3B8' },
    { nombre: 'Endodoncia', color: '#D946EF' },
    { nombre: 'Núcleo/Poste', color: '#8B5CF6' },
    { nombre: 'Apicectomía', color: '#C026D3' },
    { nombre: 'Lesión Periapical', color: '#991B1B' },
    { nombre: 'Fractura Radicular', color: '#B91C1C' },
    { nombre: 'Perforación Radicular', color: '#BE123C' },
    { nombre: 'Lesión de Furca', color: '#B45309' },
    { nombre: 'Recesión Gingival', color: '#D97706' },
    { nombre: 'Cálculo Subgingival', color: '#92400E' },
    { nombre: 'Reabsorción Radicular', color: '#7C2D12' },
    { nombre: 'Anomalía Radicular', color: '#0369A1' },
    { nombre: 'Resto Radicular', color: '#78716C' },
    { nombre: 'Corona', color: '#EAB308' },
    { nombre: 'Póntico', color: '#FBBF24' },
    { nombre: 'Prótesis Removible', color: '#F472B6' },
    { nombre: 'Implante', color: '#14B8A6' },
    { nombre: 'Ausente', color: '#6B7280' },
    { nombre: 'Extraído', color: '#64748B' },
    { nombre: 'Retenido', color: '#A855F7' },
    { nombre: 'En Erupción', color: '#84CC16' }
  ] as const;

  readonly vistaActual = signal<'odontograma' | 'paciente'>('odontograma');
  readonly odontogramaId = signal('odont-001');
  readonly datosPaciente = signal<DatosPaciente>(crearPacienteVacio());
  readonly dientes = signal<DienteData[]>(this.generarBocaCompleta());
  readonly numeroSeleccionado = signal<number | null>(null);
  readonly dienteSeleccionado = computed<DienteData | null>(() => {
    const numero = this.numeroSeleccionado();
    if (numero === null) {
      return null;
    }
    return this.dientes().find((pieza) => pieza.numero === numero) ?? null;
  });
  readonly caraSeleccionada = signal<CaraDienteId | null>(null);
  readonly notaClinica = signal('');
  readonly consultaFinalizada = signal(false);
  readonly procesandoDictado = signal(false);
  readonly errorDictado = signal<string | null>(null);
  readonly resumenActualizacion = signal<string | null>(null);
  readonly mensajeConfirmacionEdicion = signal<string | null>(null);
  private temporizadorConfirmacion: ReturnType<typeof setTimeout> | null = null;

  mostrarOdontograma(): void {
    this.vistaActual.set('odontograma');
  }

  mostrarPaciente(): void {
    this.vistaActual.set('paciente');
  }

  onDienteSeleccionado(numero: number): void {
    this.numeroSeleccionado.set(numero);
    this.caraSeleccionada.set(null);
    this.consultaFinalizada.set(false);
  }

  onCerrarModalDiente(): void {
    this.numeroSeleccionado.set(null);
    this.caraSeleccionada.set(null);
  }

  cerrarMensajeConfirmacion(): void {
    if (this.temporizadorConfirmacion) {
      clearTimeout(this.temporizadorConfirmacion);
      this.temporizadorConfirmacion = null;
    }
    this.mensajeConfirmacionEdicion.set(null);
  }

  onCaraSeleccionada(cara: CaraDienteId): void {
    this.caraSeleccionada.set(cara);
    this.consultaFinalizada.set(false);
  }

  onActualizarDiente(request: ActualizarDienteRequest): void {
    const dienteActual = this.dientes().find((pieza) => pieza.numero === request.numeroDiente);
    if (!dienteActual) {
      return;
    }

    this.odontogramaApi
      .actualizarCarasDiente(this.odontogramaId(), dienteActual, request)
      .subscribe((response) => {
        this.aplicarRespuestaBackend(response);
        this.onCerrarModalDiente();
        this.mostrarConfirmacionEdicion(
          `Se ha actualizado correctamente el estado del diente ${request.numeroDiente}.`
        );
      });
  }

  private mostrarConfirmacionEdicion(mensaje: string): void {
    if (this.temporizadorConfirmacion) {
      clearTimeout(this.temporizadorConfirmacion);
    }
    this.mensajeConfirmacionEdicion.set(mensaje);
    this.temporizadorConfirmacion = setTimeout(() => {
      this.mensajeConfirmacionEdicion.set(null);
      this.temporizadorConfirmacion = null;
    }, 4500);
  }

  onNotaCambiada(nota: string): void {
    this.notaClinica.set(nota);
    this.consultaFinalizada.set(false);
    this.errorDictado.set(null);
  }

  finalizarConsulta(nota: string): void {
    const textoLimpio = nota.trim();
    this.notaClinica.set(textoLimpio);
    this.errorDictado.set(null);

    if (!textoLimpio) {
      this.errorDictado.set('Por favor ingresa o dicta una descripción clínica antes de procesar.');
      this.consultaFinalizada.set(false);
      return;
    }

    this.procesandoDictado.set(true);
    this.consultaFinalizada.set(false);

    this.odontogramaApi
      .procesarDictadoVoz({
        odontogramaId: this.odontogramaId(),
        textoCapturado: textoLimpio
      })
      .subscribe({
        next: (response) => {
          this.procesandoDictado.set(false);
          this.aplicarRespuestaBackend(response);
          this.consultaFinalizada.set(true);
        },
        error: (err: unknown) => {
          this.procesandoDictado.set(false);
          this.consultaFinalizada.set(false);
          this.errorDictado.set(this.extraerMensajeError(err));
        }
      });
  }

  /**
   * Fusiona los dientes actualizados provenientes del Backend sobre las 32 piezas del odontograma
   * para pintar sus estados en el diagrama sin abrir ningún modal por defecto.
   */
  aplicarRespuestaBackend(response: OdontogramaUpdateResponse): void {
    if (response.odontogramaId) {
      this.odontogramaId.set(response.odontogramaId);
    }

    const dientesRecibidos = response.dientes?.length
      ? response.dientes
      : response.diente
        ? [response.diente]
        : [];

    if (dientesRecibidos.length === 0) {
      return;
    }

    const mapaActualizados = new Map<number, DienteData>(
      dientesRecibidos.map((diente) => [diente.numero, diente])
    );

    this.dientes.update((actuales) =>
      actuales.map((pieza) => mapaActualizados.get(pieza.numero) ?? pieza)
    );

    const dientesConHallazgo = dientesRecibidos.filter(
      (d) => this.primeraCaraConHallazgo(d) !== null || !this.esEstadoSanoOPresente(d.estadoGeneral?.estado)
    );
    const reportados = dientesConHallazgo.length > 0 ? dientesConHallazgo : dientesRecibidos;
    const numerosModificados = reportados.map((d) => d.numero).join(', ');
    this.resumenActualizacion.set(
      `Odontograma actualizado (${reportados.length} ${
        reportados.length === 1 ? 'pieza modificada' : 'piezas modificadas'
      }: ${numerosModificados}).`
    );
  }

  private esEstadoSanoOPresente(estado: string | null | undefined): boolean {
    if (!estado) return true;
    const norm = estado.trim().toLowerCase();
    return norm === 'sano' || norm === 'presente';
  }

  private primeraCaraConHallazgo(diente: DienteData): CaraDienteId | null {
    const orden: Array<keyof CarasDiente> = [
      'oclusal_incisal',
      'vestibular',
      'mesial',
      'distal',
      'palatino_lingual'
    ];
    for (const id of orden) {
      const estado = diente.caras[id]?.estado?.trim().toLowerCase();
      if (estado && estado !== 'sano' && estado !== 'presente') {
        return id;
      }
    }
    const estadoRaiz = diente.raiz?.estado?.trim().toLowerCase();
    if (estadoRaiz && estadoRaiz !== 'sano' && estadoRaiz !== 'presente') {
      return 'raiz';
    }
    return null;
  }

  private extraerMensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const backendBody = err.error;
      if (backendBody && typeof backendBody === 'object') {
        if (typeof backendBody.message === 'string' && backendBody.message.trim()) {
          return backendBody.message;
        }
        if (typeof backendBody.detail === 'string' && backendBody.detail.trim()) {
          return backendBody.detail;
        }
      }
      if (err.status === 0) {
        return 'No se pudo conectar con el backend en http://localhost:8080. Verifica que el servidor Java esté en ejecución.';
      }
    }
    return 'No fue posible procesar el dictado clínico en el servidor. Inténtalo de nuevo.';
  }

  private generarBocaCompleta(): DienteData[] {
    const numeros = [
      ...Array.from({ length: 8 }, (_, index) => 18 - index),
      ...Array.from({ length: 8 }, (_, index) => 21 + index),
      ...Array.from({ length: 8 }, (_, index) => 31 + index),
      ...Array.from({ length: 8 }, (_, index) => 41 + index)
    ];

    return numeros.map((numero) => this.crearDienteVacio(numero));
  }

  private crearDienteVacio(numero: number): DienteData {
    const esSuperior = numero < 30;
    const posicion = numero % 10;
    const esAnterior = posicion >= 1 && posicion <= 3;

    const caraSana = (etiquetaVisual: string) => ({
      colorHex: '#ffffff',
      etiquetaVisual,
      estado: 'Sano' as const
    });

    const caras: CarasDiente = {
      vestibular: caraSana('Vestibular'),
      palatino_lingual: caraSana(esSuperior ? 'Palatino' : 'Lingual'),
      mesial: caraSana('Mesial'),
      distal: caraSana('Distal'),
      oclusal_incisal: caraSana(esAnterior ? 'Incisal' : 'Oclusal')
    };

    return {
      numero,
      nombreColoquial: `Diente ${numero}`,
      cuadrante: Math.floor(numero / 10),
      grupoDental: esAnterior ? 'ANTERIOR' : 'POSTERIOR',
      estadoGeneral: { estado: 'Sano', colorHex: '#ffffff' },
      caras
    };
  }
}
