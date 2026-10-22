import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-diente-grafico',
  standalone: true,
  templateUrl: './diente-grafico.html',
  styleUrl: './diente-grafico.scss'
})
export class DienteGraficoComponent {
  // Signal Input requerido: Angular arrojará error si el padre no lo provee
  numeroDiente = input.required<number>();
  
  // Signal Input con valor por defecto
  caras = input<any>({
    vestibular: { colorHex: '#FFFFFF', etiquetaVisual: 'Vestibular' },
    palatino_lingual: { colorHex: '#FFFFFF', etiquetaVisual: 'Palatino/Lingual' },
    mesial: { colorHex: '#FFFFFF', etiquetaVisual: 'Mesial' },
    distal: { colorHex: '#FFFFFF', etiquetaVisual: 'Distal' },
    oclusal_incisal: { colorHex: '#FFFFFF', etiquetaVisual: 'Oclusal/Incisal' }
  });

  // Signal Outputs: Reemplazan a @Output() y EventEmitter
  dienteClickeado = output<number>();
  caraClickeada = output<{numero: number, cara: string}>();

  onDienteClick() {
    // Al ser Signals, leemos su valor ejecutándolos con ()
    this.dienteClickeado.emit(this.numeroDiente());
  }

  onCaraClick(cara: string, event: MouseEvent) {
    event.stopPropagation(); // Evita que el clic en la cara dispare también el clic del diente
    this.caraClickeada.emit({ numero: this.numeroDiente(), cara });
  }
}