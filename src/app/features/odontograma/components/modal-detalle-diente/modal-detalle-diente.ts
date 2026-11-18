import { Component, HostListener, input, output } from '@angular/core';
import { DetallePiezaComponent, CaraDienteId } from '../detalle-pieza/detalle-pieza';
import { ActualizarDienteRequest, DienteData } from '../../models/odontograma.models';

@Component({
  selector: 'app-modal-detalle-diente',
  standalone: true,
  imports: [DetallePiezaComponent],
  templateUrl: './modal-detalle-diente.html',
  styleUrl: './modal-detalle-diente.scss'
})
export class ModalDetalleDienteComponent {
  readonly diente = input.required<DienteData>();
  readonly caraSeleccionada = input<CaraDienteId | null>(null);

  readonly caraClickeada = output<CaraDienteId>();
  readonly actualizarDiente = output<ActualizarDienteRequest>();
  readonly cerrar = output<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cerrar.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  onCerrarClick(): void {
    this.cerrar.emit();
  }
}
