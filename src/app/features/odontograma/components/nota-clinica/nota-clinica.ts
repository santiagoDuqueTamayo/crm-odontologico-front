import { Component, OnDestroy, input, output, signal } from '@angular/core';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult extends ArrayLike<SpeechRecognitionAlternative> {
  isFinal: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

@Component({
  selector: 'app-nota-clinica',
  standalone: true,
  templateUrl: './nota-clinica.html',
  styleUrl: './nota-clinica.scss'
})
export class NotaClinicaComponent implements OnDestroy {
  readonly finalizada = input(false);
  readonly notaCambiada = output<string>();
  readonly finalizar = output<string>();

  protected readonly texto = signal('');
  protected readonly grabando = signal(false);
  protected readonly mensajeEstado = signal('');

  private reconocimiento: SpeechRecognitionLike | null = null;

  onNotaInput(evento: Event): void {
    const nota = (evento.target as HTMLTextAreaElement).value;
    this.texto.set(nota);
    this.notaCambiada.emit(nota);
  }

  alternarGrabacion(): void {
    if (this.grabando()) {
      this.reconocimiento?.stop();
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      this.mensajeEstado.set('El dictado por voz no está disponible en este navegador.');
      return;
    }

    const reconocimiento = new SpeechRecognitionConstructor();
    reconocimiento.lang = 'es-CO';
    reconocimiento.continuous = true;
    reconocimiento.interimResults = false;
    reconocimiento.onresult = (evento) => {
      const texto = Array.from(evento.results)
        .slice(evento.resultIndex)
        .filter((resultado) => resultado.isFinal)
        .map((resultado) => resultado[0]?.transcript.trim() ?? '')
        .filter(Boolean)
        .join(' ');

      if (texto) {
        const notaActual = this.texto().trimEnd();
        const nota = notaActual ? `${notaActual} ${texto}` : texto;
        this.texto.set(nota);
        this.notaCambiada.emit(nota);
        this.mensajeEstado.set('');
      }
    };
    reconocimiento.onerror = (evento) => {
      this.grabando.set(false);
      this.mensajeEstado.set(this.mensajeErrorVoz(evento.error));
    };
    reconocimiento.onend = () => {
      this.grabando.set(false);
      this.reconocimiento = null;
    };

    this.reconocimiento = reconocimiento;
    this.mensajeEstado.set('');
    this.grabando.set(true);

    try {
      reconocimiento.start();
    } catch (error) {
      this.grabando.set(false);
      this.reconocimiento = null;
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.mensajeEstado.set('No se concedió permiso para usar el micrófono.');
        return;
      }
      throw error;
    }
  }

  finalizarNota(): void {
    if (this.grabando()) {
      this.reconocimiento?.stop();
    }
    this.finalizar.emit(this.texto());
  }

  ngOnDestroy(): void {
    this.reconocimiento?.stop();
  }

  private mensajeErrorVoz(error: string): string {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      return 'No se concedió permiso para usar el micrófono.';
    }
    if (error === 'no-speech') {
      return 'No se detectó voz. Puedes volver a intentarlo.';
    }
    return 'No fue posible completar el dictado. Inténtalo de nuevo.';
  }
}
