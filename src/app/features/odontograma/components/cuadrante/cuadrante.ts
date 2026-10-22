import { Component, input, output } from '@angular/core';
import { DienteGraficoComponent } from '../diente-grafico/diente-grafico';

@Component({
  selector: 'app-cuadrante',
  standalone: true,
  imports: [DienteGraficoComponent],
  templateUrl: './cuadrante.html',
  styleUrl: './cuadrante.scss'
})
export class CuadranteComponent {
  // Recibe la porción de dientes (ej. los 8 dientes superiores derechos)
  dientes = input.required<any[]>();

  // Burbujeo de eventos hacia la grilla
  dienteClickeado = output<number>();
  caraClickeada = output<{numero: number, cara: string}>();
}