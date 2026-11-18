import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import {
  ActualizarDienteRequest,
  construirDienteActualizado,
  DienteData,
  DienteFdiMetadata,
  OdontogramaUpdateResponse,
  VoiceCaptureRequest
} from '../models/odontograma.models';
import { DatosPaciente } from '../models/paciente.models';

@Injectable({
  providedIn: 'root'
})
export class OdontogramaApiService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly odontogramBaseUrl = '/api/v1/odontogramas';
  private readonly patientBaseUrl = '/api/v1/pacientes';

  /**
   * Envía la transcripción del paciente al backend para extraer y estructurar sus datos con IA.
   */
  procesarDictadoPaciente(textoCapturado: string): Observable<DatosPaciente> {
    if (!this.http) {
      return throwError(() => new Error('HttpClient no está configurado.'));
    }
    return this.http.post<DatosPaciente>(`${this.patientBaseUrl}/voice-capture`, { textoCapturado });
  }

  /**
   * Envía el texto capturado (por voz o escritura) al backend para procesarlo con IA
   * y recibir los dientes actualizados con sus estados clínicos y colores.
   */
  procesarDictadoVoz(request: VoiceCaptureRequest): Observable<OdontogramaUpdateResponse> {
    if (!this.http) {
      return throwError(() => new Error('HttpClient no está configurado.'));
    }
    return this.http.post<OdontogramaUpdateResponse>(`${this.odontogramBaseUrl}/voice-capture`, request);
  }

  /**
   * Contrato preparado para persistir la edición de las 5 caras y la raíz de un diente en el Backend
   * y retornar el OdontogramaUpdateResponse con los colores semánticos resueltos para pintar en el Frontend.
   */
  actualizarCarasDiente(
    odontogramaId: string,
    dienteActual: DienteData,
    request: ActualizarDienteRequest
  ): Observable<OdontogramaUpdateResponse> {
    const dienteActualizado = construirDienteActualizado(
      dienteActual,
      request.caras,
      request.raiz
    );
    return of({
      odontogramaId,
      dientes: [dienteActualizado]
    });
  }

  /**
   * Consulta el catálogo oficial FDI de 32 dientes permanentes con sus nombres coloquiales
   * y clasificación anatómica.
   */
  obtenerCatalogoFdi(): Observable<DienteFdiMetadata[]> {
    if (!this.http) {
      return throwError(() => new Error('HttpClient no está configurado.'));
    }
    return this.http.get<DienteFdiMetadata[]>(`${this.odontogramBaseUrl}/catalogo-fdi`);
  }
}
