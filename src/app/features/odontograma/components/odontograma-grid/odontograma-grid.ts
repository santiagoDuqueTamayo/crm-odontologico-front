import { Component, input, output, computed } from '@angular/core';
// 1. Importamos el componente correcto
import { CuadranteComponent } from '../cuadrante/cuadrante';

@Component({
  selector: 'app-odontograma-grid',
  standalone: true,
  // 2. Colocamos el CuadranteComponent en los imports y quitamos el DienteGrafico
  imports: [CuadranteComponent],
  templateUrl: './odontograma-grid.html',
  styleUrl: './odontograma-grid.scss'
})
export class OdontogramaGridComponent {
  dientes = input.required<any[]>();

  cuadranteSupDer = computed(() => this.dientes().filter(d => d.numero >= 11 && d.numero <= 18).reverse());
  cuadranteSupIzq = computed(() => this.dientes().filter(d => d.numero >= 21 && d.numero <= 28));
  cuadranteInfDer = computed(() => this.dientes().filter(d => d.numero >= 41 && d.numero <= 48).reverse());
  cuadranteInfIzq = computed(() => this.dientes().filter(d => d.numero >= 31 && d.numero <= 38));

  dienteClickeado = output<number>();
  caraClickeada = output<{numero: number, cara: string}>();
}