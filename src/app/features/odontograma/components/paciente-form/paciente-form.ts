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
    await this.dibujarSvgAltaResolucion(
      pdf,
      iconoMarca,
      16,
      7,
      23,
      23,
      'sonrisa-clinica'
    );
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('SONRISA CLÍNICA', 45, 12);
    pdf.setFontSize(16);
    pdf.text('Ficha del paciente', 45, 22);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(
      `${paciente.nombres} ${paciente.apellidos}`.trim() || 'Paciente sin nombre',
      45,
      31
    );
    pdf.setFontSize(8);
    pdf.text(`Generada: ${new Date().toLocaleDateString('es-CO')}`, anchoPagina - 18, 31, {
      align: 'right'
    });
  }

  private async dibujarSvgAltaResolucion(
    pdf: JsPDFDocument,
    svg: string,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    alias: string
  ): Promise<void> {
    const escala = 10;
    pdf.saveGraphicsState();
    pdf.setCurrentTransformationMatrix(
      pdf.Matrix(1 / escala, 0, 0, 1 / escala, 0, 0)
    );
    try {
      await pdf.addSvgAsImage(
        svg,
        x * escala,
        y * escala,
        ancho * escala,
        alto * escala,
        alias,
        true
      );
    } finally {
      pdf.restoreGraphicsState();
    }
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

    const odontogramaSvg = this.crearOdontogramaSvg();
    await this.dibujarSvgAltaResolucion(
      pdf,
      odontogramaSvg,
      margen,
      72,
      anchoContenido,
      57,
      'odontograma-actual'
    );

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

  private crearOdontogramaSvg(): string {
      const dientesPorNumero = new Map(this.odontograma().map((diente) => [diente.numero, diente]));
      const arcadas = [
        {
          titulo: 'MAXILAR SUPERIOR',
          numeros: [
            ...Array.from({ length: 8 }, (_, indice) => 18 - indice),
            ...Array.from({ length: 8 }, (_, indice) => 21 + indice)
          ],
          etiquetaY: 19,
          dienteY: 25
        },
        {
          titulo: 'MANDÍBULA INFERIOR',
          numeros: [
            ...Array.from({ length: 8 }, (_, indice) => 48 - indice),
            ...Array.from({ length: 8 }, (_, indice) => 31 + indice)
          ],
          etiquetaY: 166,
          dienteY: 172
        }
      ];
      const superficies = [
        { cara: 'vestibular' as const, path: 'M 18.89 18.89 A 44 44 0 0 1 81.11 18.89 L 62.73 37.27 A 18 18 0 0 0 37.27 37.27 Z' },
        { cara: 'distal' as const, path: 'M 81.11 18.89 A 44 44 0 0 1 81.11 81.11 L 62.73 62.73 A 18 18 0 0 0 62.73 37.27 Z' },
        { cara: 'palatino_lingual' as const, path: 'M 81.11 81.11 A 44 44 0 0 1 18.89 81.11 L 37.27 62.73 A 18 18 0 0 0 62.73 62.73 Z' },
        { cara: 'mesial' as const, path: 'M 18.89 81.11 A 44 44 0 0 1 18.89 18.89 L 37.27 37.27 A 18 18 0 0 0 37.27 62.73 Z' }
      ];
      const contenidoArcadas = arcadas
        .map((arcada) => {
          const dientesSvg = arcada.numeros
            .map((numero, indice) => {
              const x = 35 + indice * 60 + (indice >= 8 ? 18 : 0);
              return this.crearDienteSvg(numero, dientesPorNumero.get(numero), x, arcada.dienteY, superficies);
            })
            .join('');
          return `<text class="arcada" x="35" y="${arcada.etiquetaY}">${arcada.titulo}</text>${dientesSvg}`;
        })
        .join('');

      return `<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="320" viewBox="0 0 1050 320">
        <style>
          .arcada{font:700 15px Arial,sans-serif;letter-spacing:1px;fill:#17664f}
          .numero{font:600 13px Arial,sans-serif;fill:#355749}
          .pieza{stroke:#b7a99a;stroke-width:3;stroke-linejoin:round}
          .raiz{stroke:#b7a99a;stroke-width:3;stroke-linejoin:round}
        </style>
        <rect width="1050" height="320" rx="14" fill="#fff"/>
        ${contenidoArcadas}
      </svg>`;
  }

  private crearDienteSvg(
    numero: number,
    diente: DienteData | undefined,
    x: number,
    y: number,
    superficies: ReadonlyArray<{ cara: CaraDientePdf; path: string }>
  ): string {
    const unidad = numero % 10;
    const forma =
      unidad <= 2
        ? {
            raiz: 'M29 51c2 19 6 40 14 57 3 5 7 5 9-1 7-20 11-39 13-57',
            corona: 'M27 52c-12-5-17-16-13-29C18 8 34 8 50 11c17-3 32-3 37 12 4 13-1 24-14 29-11 5-35 5-46 0Z'
          }
        : unidad === 3
          ? {
              raiz: 'M34 43c1 24 5 47 12 67 2 7 7 7 9 0 8-21 11-44 12-67',
              corona: 'M27 48C12 41 13 23 23 15c7-6 15-3 27-12 12 9 20 6 27 12 10 8 11 26-4 33-10 5-36 5-46 0Z'
            }
          : unidad === 4 || unidad === 5
            ? {
                raiz: 'M28 52c0 21 5 37 13 52 3 5 8 5 10 0 2-6 4-6 7 0 3 5 8 5 10 0 8-15 13-31 13-52',
                corona: 'M28 53C15 49 12 35 17 21 22 8 36 8 50 14c14-6 28-6 33 7 5 14 2 28-11 32-12 5-32 5-44 0Z'
              }
            : {
                raiz: 'M23 51c-1 18 2 34 9 48 3 6 8 6 11 0l7-15 7 15c3 6 8 6 11 0 7-14 10-30 9-48',
                corona: 'M24 54C9 48 8 31 16 19 24 7 37 10 50 16 63 10 76 7 84 19c8 12 7 29-8 35-13 6-39 6-52 0Z'
              };

    const colorCorona = diente ? this.obtenerColorCoronaPdf(diente) : '#fffef9';
    const colorRaiz = diente ? this.obtenerColorRaizPdf(diente) : '#f7f3e8';
    const ausente = ['ausente', 'extraído', 'extraido'].includes(
      diente?.estadoGeneral.estado.trim().toLowerCase() ?? ''
    );
    const transformar = numero < 30 ? 'transform="rotate(180 50 65)"' : '';
    const carasSvg = superficies
      .map(({ cara, path }) => {
        const color = diente ? this.obtenerColorCaraPdf(diente, cara) : '#fffef9';
        return `<path d="${path}" fill="${color}" stroke="#b7a99a" stroke-width="2.5"/>`;
      })
      .join('');

    return `<g>
        <rect x="${x}" y="${y}" width="54" height="135" rx="9" fill="#f8fbf9" stroke="#dfeae4" stroke-width="2"/>
        <text class="numero" x="${x + 27}" y="${y + 17}" text-anchor="middle">${numero}</text>
        <svg x="${x + 8}" y="${y + 21}" width="38" height="61" viewBox="0 0 100 130" ${transformar}>
          <path class="raiz" d="${forma.raiz}" fill="${colorRaiz}"/>
          <path class="pieza" d="${forma.corona}" fill="${colorCorona}"/>
          ${ausente ? '<path d="M22 18L78 54M78 18L22 54" fill="none" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>' : ''}
        </svg>
        <svg x="${x + 13}" y="${y + 87}" width="28" height="28" viewBox="0 0 100 100">
          ${carasSvg}
          <circle cx="50" cy="50" r="18" fill="${diente ? this.obtenerColorCaraPdf(diente, 'oclusal_incisal') : '#fffef9'}" stroke="#b7a99a" stroke-width="2.5"/>
          ${ausente ? '<path d="M24 24L76 76M76 24L24 76" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>' : ''}
        </svg>
      </g>`;
  }

  private obtenerColorCoronaPdf(diente: DienteData): string {
    const hallazgoCara = ORDEN_CARAS_PDF
      .map(({ cara }) => diente.caras[cara])
      .find((cara) => !this.esEstadoSanoOPresente(cara.estado));
    if (hallazgoCara) {
      return this.colorSeguroPdf(hallazgoCara.estado, hallazgoCara.colorHex);
    }

    const estadoGeneral = diente.estadoGeneral.estado;
    return this.esEstadoSanoOPresente(estadoGeneral) || esEstadoExclusivoDeRaiz(estadoGeneral)
      ? '#fffef9'
      : this.colorSeguroPdf(estadoGeneral, diente.estadoGeneral.colorHex);
  }

  private obtenerColorRaizPdf(diente: DienteData): string {
    if (diente.raiz && !this.esEstadoSanoOPresente(diente.raiz.estado)) {
      return this.colorSeguroPdf(diente.raiz.estado, diente.raiz.colorHex);
    }

    const estadoGeneral = diente.estadoGeneral.estado;
    if (
      diente.raiz === undefined &&
      ['endodoncia', 'núcleo/poste', 'nucleo/poste', 'implante', 'ausente', 'extraído', 'extraido'].includes(
        estadoGeneral.trim().toLowerCase()
      )
    ) {
      return this.colorSeguroPdf(estadoGeneral, diente.estadoGeneral.colorHex);
    }
    return '#f7f3e8';
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
