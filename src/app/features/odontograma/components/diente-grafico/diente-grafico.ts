import { Component, input, output } from '@angular/core';
import { CarasDiente } from '../../models/odontograma.models';

@Component({
  selector: 'app-diente-grafico',
  standalone: true,
  templateUrl: './diente-grafico.html',
  styleUrl: './diente-grafico.scss'
})
export class DienteGraficoComponent {
  numeroDiente = input.required<number>();
  seleccionado = input(false);
  caras = input.required<CarasDiente>();

  dienteClickeado = output<number>();
  caraClickeada = output<{ numero: number; cara: string }>();

  onDienteClick(): void {
    this.dienteClickeado.emit(this.numeroDiente());
  }

  onCaraClick(cara: string, event: MouseEvent): void {
    event.stopPropagation();
    this.caraClickeada.emit({ numero: this.numeroDiente(), cara });
  }
}
