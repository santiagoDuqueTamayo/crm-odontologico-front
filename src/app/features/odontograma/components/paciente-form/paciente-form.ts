import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, input, model, signal } from '@angular/core';
import type { jsPDF as JsPDFDocument } from 'jspdf';
import { SpeechTranscriptionService } from '../../services/speech-transcription.service';
import { OdontogramaApiService } from '../../services/odontograma-api.service';
import { crearPacienteVacio, DatosPaciente } from '../../models/paciente.models';
import {
  CarasDiente,
  DienteData,
  esEstadoExclusivoDeRaiz,
  resolverColorPorEstadoClinico
} from '../../models/odontograma.models';

type CampoPaciente = keyof DatosPaciente;
type CaraDientePdf = keyof CarasDiente;

const ORDEN_CARAS_PDF: ReadonlyArray<{
  cara: CaraDientePdf;
  posicion: 'arriba' | 'derecha' | 'abajo' | 'izquierda' | 'centro';
}> = [
  { cara: 'vestibular', posicion: 'arriba' },
  { cara: 'distal', posicion: 'derecha' },
  { cara: 'palatino_lingual', posicion: 'abajo' },
  { cara: 'mesial', posicion: 'izquierda' },
  { cara: 'oclusal_incisal', posicion: 'centro' }
];

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
  readonly odontograma = input<readonly DienteData[]>([]);
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
      pdf.setProperties({ title: 'Ficha del paciente', subject: 'Datos del paciente' });
      const iconoMarca = await this.cargarIconoMarca();
      await this.dibujarEncabezadoPdf(pdf, iconoMarca, anchoPagina);
      let posicionY = 48;

      const secciones: ReadonlyArray<{
        titulo: string;
        campos: ReadonlyArray<{ id: CampoPaciente; label: string; multiline?: boolean }>;
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
        if (posicionY + 17 > altoPagina - margen) {
          pdf.addPage();
          await this.dibujarEncabezadoPdf(pdf, iconoMarca, anchoPagina);
          posicionY = 48;
        }
        this.dibujarTituloSeccion(pdf, seccion.titulo, margen, posicionY, anchoContenido);
        posicionY += 14;
        let indiceCampo = 0;

        while (indiceCampo < seccion.campos.length) {
          const campo = seccion.campos[indiceCampo];
          const fila = campo.multiline
            ? [campo]
            : [
                campo,
                ...(!seccion.campos[indiceCampo + 1]?.multiline && seccion.campos[indiceCampo + 1]
                  ? [seccion.campos[indiceCampo + 1]]
                  : [])
              ];
          const anchoTarjeta =
            fila.length === 2 ? (anchoContenido - 6) / 2 : anchoContenido;
          const tarjetas = fila.map((dato) => {
            const valor = paciente[dato.id].trim() || 'No registrado';
            const lineas = pdf.splitTextToSize(valor, anchoTarjeta - 10) as string[];
            return { dato, lineas, alto: Math.max(19, lineas.length * 4.5 + 13) };
          });
          const altoFila = Math.max(...tarjetas.map((tarjeta) => tarjeta.alto));

          if (fila.length === 1 && tarjetas[0].lineas.length > 1) {
            let indiceLinea = 0;
            while (indiceLinea < tarjetas[0].lineas.length) {
              if (posicionY + 19 > altoPagina - 17) {
                posicionY = await this.abrirPaginaContinuacionPdf(
                  pdf,
                  iconoMarca,
                  anchoPagina,
                  margen,
                  anchoContenido,
                  seccion.titulo
                );
              }
              const maxLineas = Math.max(
                1,
                Math.floor((altoPagina - 17 - posicionY - 13) / 4.5)
              );
              const lineas = tarjetas[0].lineas.slice(indiceLinea, indiceLinea + maxLineas);
              const altoTarjeta = Math.max(19, lineas.length * 4.5 + 13);
              this.dibujarTarjetaCampo(
                pdf,
                indiceLinea === 0
                  ? tarjetas[0].dato.label
                  : `${tarjetas[0].dato.label} · continuación`,
                lineas,
                margen,
                posicionY,
                anchoContenido,
                altoTarjeta
              );
              posicionY += altoTarjeta + 5;
              indiceLinea += lineas.length;
            }
            indiceCampo += fila.length;
            continue;
          }

          if (posicionY + altoFila > altoPagina - 17) {
            posicionY = await this.abrirPaginaContinuacionPdf(
              pdf,
              iconoMarca,
              anchoPagina,
              margen,
              anchoContenido,
              seccion.titulo
            );
          }

          tarjetas.forEach((tarjeta, indiceTarjeta) => {
            const x =
              margen + indiceTarjeta * (anchoTarjeta + (fila.length === 2 ? 6 : 0));
            this.dibujarTarjetaCampo(
              pdf,
              tarjeta.dato.label,
              tarjeta.lineas,
              x,
              posicionY,
              anchoTarjeta,
              altoFila
            );
          });
          posicionY += altoFila + 5;
          indiceCampo += fila.length;
        }

        posicionY += 5;
      }

      await this.dibujarOdontogramaPdf(
        pdf,
        iconoMarca,
        anchoPagina,
        altoPagina,
        margen,
        anchoContenido
      );

      const nombreArchivo = `${paciente.nombres}-${paciente.apellidos}`
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'paciente';
      pdf.save(`ficha-${nombreArchivo}.pdf`);
      this.mensajeExportacion.set('La ficha y el odontograma se descargaron en PDF.');
    } catch (error) {
      console.error('No se pudo exportar la ficha del paciente a PDF.', error);
      this.mensajeExportacion.set('No se pudo generar el PDF. Inténtalo de nuevo.');
    }
  }

  private async abrirPaginaContinuacionPdf(
    pdf: JsPDFDocument,
    iconoMarca: string,
    anchoPagina: number,
    margen: number,
    anchoContenido: number,
    tituloSeccion: string
  ): Promise<number> {
    pdf.addPage();
    await this.dibujarEncabezadoPdf(pdf, iconoMarca, anchoPagina);
    this.dibujarTituloSeccion(
      pdf,
      `${tituloSeccion} · continuación`,
      margen,
      48,
      anchoContenido
    );
    return 62;
  }

  private async cargarIconoMarca(): Promise<string> {
    const respuesta = await fetch(new URL('sonrisa-clinica.svg', document.baseURI));
    if (!respuesta.ok) {
      throw new Error(`No se pudo cargar el icono de marca (${respuesta.status}).`);
    }

    const svg = await respuesta.text();
    if (!svg.includes('<svg')) {
      throw new Error('El archivo del icono de marca no contiene un SVG válido.');
    }
    return svg;
  }

  private async dibujarEncabezadoPdf(
    pdf: JsPDFDocument,
    iconoMarca: string,
    anchoPagina: number
  ): Promise<void> {
    const paciente = this.paciente();
    pdf.setFillColor(18, 59, 48);
    pdf.rect(0, 0, anchoPagina, 39, 'F');
    await pdf.addSvgAsImage(iconoMarca, 16, 8, 22, 22, 'sonrisa-clinica', true);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('Ficha del paciente', 44, 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(
      `${paciente.nombres} ${paciente.apellidos}`.trim() || 'Paciente sin nombre',
      44,
      25
    );
    pdf.setFontSize(9);
    pdf.text(`Generada: ${new Date().toLocaleDateString('es-CO')}`, anchoPagina - 18, 25, {
      align: 'right'
    });
  }

  private dibujarTituloSeccion(
    pdf: JsPDFDocument,
    titulo: string,
    x: number,
    y: number,
    ancho: number
  ): void {
    pdf.setFillColor(229, 244, 236);
    pdf.roundedRect(x, y, ancho, 8, 2, 2, 'F');
    pdf.setTextColor(23, 102, 79);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(titulo, x + 3, y + 5.5);
  }

  private dibujarTarjetaCampo(
    pdf: JsPDFDocument,
    etiqueta: string,
    lineas: string[],
    x: number,
    y: number,
    ancho: number,
    alto: number
  ): void {
    pdf.setFillColor(248, 251, 249);
    pdf.setDrawColor(224, 235, 229);
    pdf.roundedRect(x, y, ancho, alto, 2, 2, 'FD');
    pdf.setTextColor(83, 107, 96);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(etiqueta, x + 5, y + 6);
    pdf.setTextColor(25, 59, 50);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    lineas.forEach((linea, indice) => pdf.text(linea, x + 5, y + 11 + indice * 4.5));
  }

  private async dibujarOdontogramaPdf(
    pdf: JsPDFDocument,
    iconoMarca: string,
    anchoPagina: number,
    altoPagina: number,
    margen: number,
    anchoContenido: number
  ): Promise<void> {
    pdf.addPage();
    await this.dibujarEncabezadoPdf(pdf, iconoMarca, anchoPagina);
    this.dibujarTituloSeccion(pdf, 'Odontograma actual', margen, 48, anchoContenido);
    pdf.setTextColor(83, 107, 96);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(
      'Vista por superficies: vestibular arriba, mesial a la izquierda, distal a la derecha,',
      margen,
      63
    );
    pdf.text('palatino/lingual abajo y oclusal/incisal al centro.', margen, 68);

    const dientesPorNumero = new Map(this.odontograma().map((diente) => [diente.numero, diente]));
    const separacionCentral = 4;
    const anchoCelda = (anchoContenido - separacionCentral) / 16;
    const arcadas: ReadonlyArray<{
      titulo: string;
      numeros: number[];
      y: number;
    }> = [
      {
        titulo: 'MAXILAR SUPERIOR',
        numeros: [
          ...Array.from({ length: 8 }, (_, indice) => 18 - indice),
          ...Array.from({ length: 8 }, (_, indice) => 21 + indice)
        ],
        y: 76
      },
      {
        titulo: 'MANDÍBULA INFERIOR',
        numeros: [
          ...Array.from({ length: 8 }, (_, indice) => 48 - indice),
          ...Array.from({ length: 8 }, (_, indice) => 31 + indice)
        ],
        y: 110
      }
    ];

    for (const arcada of arcadas) {
      pdf.setTextColor(23, 102, 79);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(arcada.titulo, margen, arcada.y);
      arcada.numeros.forEach((numero, indice) => {
        const x =
          margen +
          indice * anchoCelda +
          (indice >= 8 ? separacionCentral : 0);
        const centroX = x + anchoCelda / 2;
        const diente = dientesPorNumero.get(numero);
        pdf.setDrawColor(224, 235, 229);
        pdf.setFillColor(248, 251, 249);
        pdf.roundedRect(x + 0.4, arcada.y + 2, anchoCelda - 0.8, 25, 1.5, 1.5, 'FD');
        pdf.setTextColor(35, 75, 59);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6);
        pdf.text(String(numero), centroX, arcada.y + 8, { align: 'center' });

        const centroY = arcada.y + 18;
        const tamanoCara = 2.2;
        for (const { cara, posicion } of ORDEN_CARAS_PDF) {
          const offset =
            posicion === 'arriba'
              ? ([0, -tamanoCara] as const)
              : posicion === 'derecha'
                ? ([tamanoCara, 0] as const)
                : posicion === 'abajo'
                  ? ([0, tamanoCara] as const)
                  : posicion === 'izquierda'
                    ? ([-tamanoCara, 0] as const)
                    : ([0, 0] as const);
          const estado = diente ? this.obtenerColorCaraPdf(diente, cara) : '#fffef9';
          const [rojo, verde, azul] = this.convertirColorRgb(estado);
          pdf.setFillColor(rojo, verde, azul);
          pdf.rect(
            centroX + offset[0] - tamanoCara / 2,
            centroY + offset[1] - tamanoCara / 2,
            tamanoCara,
            tamanoCara,
            'F'
          );
        }
      });
    }

    let posicionY = 148;
    this.dibujarTituloSeccion(pdf, 'Hallazgos por pieza', margen, posicionY, anchoContenido);
    posicionY += 14;
    const hallazgos = this.odontograma()
      .map((diente) => ({ diente, detalle: this.obtenerHallazgosDiente(diente) }))
      .filter(({ detalle }) => detalle.length > 0);

    if (hallazgos.length === 0) {
      pdf.setTextColor(83, 107, 96);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('No se registran hallazgos; todas las superficies figuran sanas.', margen, posicionY);
      return;
    }

    for (const { diente, detalle } of hallazgos) {
      const lineas = pdf.splitTextToSize(
        `${diente.numero} · ${detalle.join('; ')}`,
        anchoContenido - 8
      ) as string[];
      const alto = Math.max(12, lineas.length * 4.5 + 6);
      if (posicionY + alto > altoPagina - margen) {
        pdf.addPage();
        await this.dibujarEncabezadoPdf(pdf, iconoMarca, anchoPagina);
        this.dibujarTituloSeccion(
          pdf,
          'Hallazgos por pieza · continuación',
          margen,
          48,
          anchoContenido
        );
        posicionY = 62;
      }

      pdf.setFillColor(248, 251, 249);
      pdf.roundedRect(margen, posicionY, anchoContenido, alto, 2, 2, 'F');
      pdf.setTextColor(25, 59, 50);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      lineas.forEach((linea, indice) =>
        pdf.text(linea, margen + 4, posicionY + 5 + indice * 4.5)
      );
      posicionY += alto + 2;
    }
  }

  private obtenerColorCaraPdf(diente: DienteData, cara: CaraDientePdf): string {
    const estadoCara = diente.caras[cara];
    if (
      estadoCara &&
      !this.esEstadoSanoOPresente(estadoCara.estado) &&
      (diente.raiz !== undefined || !esEstadoExclusivoDeRaiz(estadoCara.estado))
    ) {
      return this.colorSeguroPdf(estadoCara.estado, estadoCara.colorHex);
    }

    const estadoGeneral = diente.estadoGeneral?.estado;
    if (
      diente.raiz === undefined &&
      !this.esEstadoSanoOPresente(estadoGeneral) &&
      !esEstadoExclusivoDeRaiz(estadoGeneral)
    ) {
      return this.colorSeguroPdf(estadoGeneral, diente.estadoGeneral?.colorHex);
    }
    return '#fffef9';
  }

  private obtenerHallazgosDiente(diente: DienteData): string[] {
    const hallazgos: string[] = [];
    if (!this.esEstadoSanoOPresente(diente.estadoGeneral?.estado)) {
      hallazgos.push(`Estado general: ${diente.estadoGeneral.estado}`);
    }
    for (const cara of Object.values(diente.caras)) {
      if (!this.esEstadoSanoOPresente(cara.estado)) {
        hallazgos.push(`${cara.etiquetaVisual}: ${cara.estado}`);
      }
    }
    if (diente.raiz && !this.esEstadoSanoOPresente(diente.raiz.estado)) {
      hallazgos.push(`Raíz: ${diente.raiz.estado}`);
    }
    return hallazgos;
  }

  private colorSeguroPdf(estado: string, colorHex: string | null): string {
    const color = resolverColorPorEstadoClinico(estado, colorHex);
    return /^#[\da-f]{6}$/i.test(color) ? color : '#F59E0B';
  }

  private convertirColorRgb(color: string): [number, number, number] {
    const valor = color.replace('#', '');
    return [
      Number.parseInt(valor.slice(0, 2), 16),
      Number.parseInt(valor.slice(2, 4), 16),
      Number.parseInt(valor.slice(4, 6), 16)
    ];
  }

  private esEstadoSanoOPresente(estado: string | null | undefined): boolean {
    const normalizado = estado?.trim().toLowerCase();
    return !normalizado || normalizado === 'sano' || normalizado === 'presente';
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
