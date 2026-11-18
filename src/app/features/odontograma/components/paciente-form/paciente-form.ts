import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, model, signal } from '@angular/core';
import { SpeechTranscriptionService } from '../../services/speech-transcription.service';
import { OdontogramaApiService } from '../../services/odontograma-api.service';
import { crearPacienteVacio, DatosPaciente } from '../../models/paciente.models';

type CampoPaciente = keyof DatosPaciente;

@Component({
  selector: 'app-paciente-form',
  standalone: true,
  templateUrl: './paciente-form.html',
  styleUrl: './paciente-form.scss'
})
export class PacienteFormComponent implements OnDestroy {
  private readonly speechTranscription = inject(SpeechTranscriptionService);
  private readonly odontogramaApi = inject(OdontogramaApiService);

  readonly paciente = model<DatosPaciente>(crearPacienteVacio());
  protected readonly grabando = signal(false);
  protected readonly iniciandoGrabacion = signal(false);
  protected readonly transcribiendo = signal(false);
  protected readonly mensajeEstado = signal('');
  protected readonly mensajeExportacion = signal('');
  protected readonly transcripcion = signal('');

  protected readonly campos: ReadonlyArray<{ id: CampoPaciente; label: string; multiline?: boolean }> = [
    { id: 'nombres', label: 'Nombres' },
    { id: 'apellidos', label: 'Apellidos' },
    { id: 'identificacion', label: 'Documento de identidad' },
    { id: 'edad', label: 'Edad' },
    { id: 'genero', label: 'Género' },
    { id: 'telefono', label: 'Teléfono' },
    { id: 'correo', label: 'Correo electrónico' },
    { id: 'direccion', label: 'Dirección' },
    { id: 'ocupacion', label: 'Ocupación' },
    { id: 'aseguradora', label: 'Aseguradora / plan de salud' },
    { id: 'contactoEmergencia', label: 'Contacto de emergencia' },
    { id: 'alergias', label: 'Alergias', multiline: true },
    { id: 'medicamentos', label: 'Medicamentos actuales', multiline: true },
    { id: 'antecedentesMedicos', label: 'Antecedentes médicos', multiline: true },
    { id: 'antecedentesOdontologicos', label: 'Antecedentes odontológicos', multiline: true }
  ];

  private grabadora: MediaRecorder | null = null;
  private flujoMicrofono: MediaStream | null = null;
  private fragmentosAudio: Blob[] = [];
  private intentoCaptura = 0;

  protected actualizarCampo(campo: CampoPaciente, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.paciente.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected async exportarPdf(): Promise<void> {
    this.mensajeExportacion.set('');

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const anchoPagina = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      const margen = 18;
      const anchoContenido = anchoPagina - margen * 2;
      const paciente = this.paciente();
      let posicionY = 20;

      pdf.setProperties({ title: 'Ficha del paciente', subject: 'Datos del paciente' });
      pdf.setFillColor(23, 102, 79);
      pdf.rect(0, 0, anchoPagina, 34, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Ficha del paciente', margen, 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(
        `${paciente.nombres} ${paciente.apellidos}`.trim() || 'Paciente sin nombre',
        margen,
        25
      );
      pdf.setFontSize(9);
      pdf.text(`Generada: ${new Date().toLocaleDateString('es-CO')}`, anchoPagina - margen, 25, {
        align: 'right'
      });
      posicionY = 46;

      const secciones: ReadonlyArray<{
        titulo: string;
        campos: ReadonlyArray<{ id: CampoPaciente; label: string }>;
      }> = [
        {
          titulo: 'Datos personales',
          campos: this.campos.filter((campo) =>
            ['nombres', 'apellidos', 'identificacion', 'edad', 'genero', 'ocupacion'].includes(
              campo.id
            )
          )
        },
        {
          titulo: 'Información de contacto',
          campos: this.campos.filter((campo) =>
            ['telefono', 'correo', 'direccion', 'aseguradora', 'contactoEmergencia'].includes(
              campo.id
            )
          )
        },
        {
          titulo: 'Información clínica',
          campos: this.campos.filter((campo) =>
            ['alergias', 'medicamentos', 'antecedentesMedicos', 'antecedentesOdontologicos'].includes(
              campo.id
            )
          )
        }
      ];

      for (const seccion of secciones) {
        if (posicionY + 13 > altoPagina - margen) {
          pdf.addPage();
          posicionY = margen;
        }

        pdf.setFillColor(229, 244, 236);
        pdf.roundedRect(margen, posicionY, anchoContenido, 9, 2, 2, 'F');
        pdf.setTextColor(23, 102, 79);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(seccion.titulo, margen + 3, posicionY + 6);
        posicionY += 15;

        for (const campo of seccion.campos) {
          const valor = paciente[campo.id].trim() || 'No registrado';
          const lineas = pdf.splitTextToSize(valor, anchoContenido);

          if (posicionY + 11 > altoPagina - margen) {
            pdf.addPage();
            posicionY = margen;
          }

          pdf.setTextColor(83, 107, 96);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(campo.label, margen, posicionY);
          posicionY += 5;

          pdf.setTextColor(25, 59, 50);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          for (const linea of lineas) {
            if (posicionY + 5 > altoPagina - margen) {
              pdf.addPage();
              posicionY = margen;
            }
            pdf.text(linea, margen, posicionY);
            posicionY += 5;
          }
          posicionY += 5;
        }

        posicionY += 3;
      }

      const nombreArchivo = `${paciente.nombres}-${paciente.apellidos}`
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'paciente';
      pdf.save(`ficha-${nombreArchivo}.pdf`);
      this.mensajeExportacion.set('La ficha del paciente se descargó en PDF.');
    } catch (error) {
      console.error('No se pudo exportar la ficha del paciente a PDF.', error);
      this.mensajeExportacion.set('No se pudo generar el PDF. Inténtalo de nuevo.');
    }
  }

  protected async iniciarDictado(): Promise<void> {
    this.cancelarCaptura();
    this.mensajeEstado.set('');
    this.transcripcion.set('');

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.mensajeEstado.set('El dictado por voz no está disponible en este navegador.');
      return;
    }

    const intento = this.intentoCaptura;
    this.iniciandoGrabacion.set(true);

    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (intento !== this.intentoCaptura) {
        flujo.getTracks().forEach((pista) => pista.stop());
        return;
      }

      this.flujoMicrofono = flujo;
      const mimeType = this.tipoAudioCompatible();
      const grabadora = new MediaRecorder(flujo, mimeType ? { mimeType } : undefined);
      this.grabadora = grabadora;
      this.fragmentosAudio = [];

      grabadora.ondataavailable = (evento) => {
        if (evento.data.size > 0) this.fragmentosAudio.push(evento.data);
      };
      grabadora.onerror = () => {
        grabadora.onstop = null;
        this.mensajeEstado.set('Ocurrió un error al grabar el audio. Inténtalo de nuevo.');
        this.liberarMicrofono();
        this.grabando.set(false);
      };
      grabadora.onstop = () => {
        const audio = new Blob(this.fragmentosAudio, {
          type: grabadora.mimeType || 'audio/webm'
        });
        this.fragmentosAudio = [];
        this.liberarMicrofono();
        this.grabando.set(false);
        this.transcribirAudio(audio, intento);
      };

      grabadora.start();
      this.iniciandoGrabacion.set(false);
      this.grabando.set(true);
    } catch (error) {
      if (intento !== this.intentoCaptura) return;
      this.liberarMicrofono();
      this.iniciandoGrabacion.set(false);
      this.grabando.set(false);
      this.mensajeEstado.set(this.mensajeErrorInicio(error));
    }
  }

  protected detenerDictado(): void {
    if (this.grabadora?.state === 'recording') this.grabadora.stop();
  }

  ngOnDestroy(): void {
    this.cancelarCaptura();
  }

  private cancelarCaptura(): void {
    this.intentoCaptura++;
    if (this.grabadora && this.grabadora.state !== 'inactive') {
      this.grabadora.onstop = null;
      this.grabadora.stop();
    }
    this.liberarMicrofono();
    this.grabadora = null;
    this.fragmentosAudio = [];
    this.grabando.set(false);
    this.iniciandoGrabacion.set(false);
    this.transcribiendo.set(false);
  }

  private liberarMicrofono(): void {
    this.flujoMicrofono?.getTracks().forEach((pista) => pista.stop());
    this.flujoMicrofono = null;
    this.grabadora = null;
  }

  private tipoAudioCompatible(): string | null {
    const formatos = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    return formatos.find((formato) => MediaRecorder.isTypeSupported(formato)) ?? null;
  }

  private transcribirAudio(audio: Blob, intento: number): void {
    if (intento !== this.intentoCaptura) return;
    if (!audio.size) {
      this.mensajeEstado.set('No se capturó audio. Puedes volver a intentarlo.');
      return;
    }

    this.transcribiendo.set(true);
    this.speechTranscription.transcribir(audio).subscribe({
      next: (texto) => {
        if (intento !== this.intentoCaptura) return;
        this.transcripcion.set(texto);
        this.mensajeEstado.set('Organizando los datos mencionados en sus campos…');
        this.odontogramaApi.procesarDictadoPaciente(texto).subscribe({
          next: (datos) => {
            if (intento !== this.intentoCaptura) return;
            const datosMencionados = Object.fromEntries(
              Object.entries(datos).filter(([, valor]) => typeof valor === 'string' && valor.trim())
            ) as Partial<DatosPaciente>;
            this.paciente.update((actual) => ({ ...actual, ...datosMencionados }));
            const cantidad = Object.keys(datosMencionados).length;
            this.mensajeEstado.set(
              cantidad
                ? `Se organizaron ${cantidad} datos. Revisa y corrige los campos antes de continuar.`
                : 'No se identificaron datos para completar. Revisa la transcripción e inténtalo de nuevo.'
            );
            this.transcribiendo.set(false);
          },
          error: (error: unknown) => {
            if (intento !== this.intentoCaptura) return;
            this.transcribiendo.set(false);
            this.mensajeEstado.set(
              `${this.mensajeErrorExtraccion(error)} La transcripción completa queda disponible para copiar manualmente.`
            );
          }
        });
      },
      error: (error: unknown) => {
        if (intento !== this.intentoCaptura) return;
        this.transcribiendo.set(false);
        this.mensajeEstado.set(this.mensajeErrorTranscripcion(error));
      }
    });
  }

  private mensajeErrorInicio(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return 'No se concedió permiso para usar el micrófono. Verifica también que estés en una conexión segura (HTTPS o localhost).';
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return 'No se encontró un micrófono disponible.';
      }
    }
    return 'No se pudo iniciar el dictado. Verifica el permiso del micrófono e inténtalo de nuevo.';
  }

  private mensajeErrorTranscripcion(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const mensaje = error.error?.message;
      if (typeof mensaje === 'string' && mensaje.trim()) return mensaje;
      if (error.status === 0) {
        return 'No se pudo conectar con el servicio de transcripción. Revisa tu conexión.';
      }
      if (error.status === 413) {
        return 'El audio supera el límite de tamaño permitido. Graba un dictado más corto.';
      }
    }
    return 'No fue posible transcribir el audio. Inténtalo de nuevo.';
  }

  private mensajeErrorExtraccion(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 200 && error.error instanceof SyntaxError) {
        return 'El servidor devolvió HTML en lugar del JSON del backend clínico. Verifica que /api/v1 esté dirigido al backend Java.';
      }
      const detail = error.error?.detail;
      if (typeof detail === 'string' && detail.trim()) return detail;
      const message = error.error?.message;
      if (typeof message === 'string' && message.trim()) return message;
      if (error.status === 0) {
        return 'No se pudo conectar con el backend clínico. Verifica que el servicio esté disponible.';
      }
    }
    return 'No fue posible organizar los datos del paciente. Inténtalo de nuevo.';
  }
}
