import { Component, computed, input } from '@angular/core';
import { DienteData } from '../../models/odontograma.models';

@Component({
  selector: 'app-detalle-diente',
  standalone: true,
  templateUrl: './detalle-diente.html',
  styleUrl: './detalle-diente.scss'
})
export class DetalleDienteComponent {
  diente = input<DienteData | null>(null);
  caraSeleccionada = input<string | null>(null);

  readonly caras = computed(() => {
    const diente = this.diente();
    if (!diente) {
      return [];
    }

    return Object.entries(diente.caras).map(([id, cara]) => ({
      id,
      nombre: cara.etiquetaVisual,
      estado: cara.estado
    }));
  });
}
