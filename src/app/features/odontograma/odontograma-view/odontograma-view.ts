
import { Component, signal } from '@angular/core';
import { OdontogramaGridComponent } from '../components/odontograma-grid/odontograma-grid';
import { DetalleDienteComponent } from '../components/detalle-diente/detalle-diente';

@Component({
  selector: 'app-odontograma-view',
  standalone: true,
  imports: [OdontogramaGridComponent, DetalleDienteComponent],
  templateUrl: './odontograma-view.html',
  styleUrl: './odontograma-view.scss'
})
export class OdontogramaViewComponent {

  // Signal principal que almacena el estado de toda la boca
  dientes = signal<any[]>(this.generarBocaCompleta());
  
  // Signal para manejar el diente seleccionado actualmente
  dienteSeleccionado = signal<any | null>(null);

  // Funciones que reaccionan a los clics del usuario
  onDienteSeleccionado(numero: number) {
    const diente = this.dientes().find(d => d.numero === numero);
    this.dienteSeleccionado.set(diente || null);
    console.log(`Seleccionaste el diente completo: ${numero}`);
  }

  onCaraSeleccionada(evento: {numero: number, cara: string}) {
    const diente = this.dientes().find(d => d.numero === evento.numero);
    this.dienteSeleccionado.set(diente || null);
    console.log(`Seleccionaste la cara ${evento.cara} del diente ${evento.numero}`);
  }

  // --- Helpers Privados --- //
  
  private generarBocaCompleta(): any[] {
    const boca: any[] = [];
    const cuadrantes = [
      { inicio: 11, fin: 18 },
      { inicio: 21, fin: 28 },
      { inicio: 31, fin: 38 },
      { inicio: 41, fin: 48 }
    ];

    cuadrantes.forEach(cuadrante => {
      for (let i = cuadrante.inicio; i <= cuadrante.fin; i++) {
        boca.push(this.crearDienteVacio(i));
      }
    });
    return boca;
  }

  private crearDienteVacio(numero: number) {
    return {
      numero: numero,
      nombreColoquial: `Diente ${numero}`,
      caras: {
        vestibular: { colorHex: '#FFFFFF', etiquetaVisual: 'Vestibular', estado: 'Sano' },
        palatino_lingual: { colorHex: '#FFFFFF', etiquetaVisual: 'Palatino/Lingual', estado: 'Sano' },
        mesial: { colorHex: '#FFFFFF', etiquetaVisual: 'Mesial', estado: 'Sano' },
        distal: { colorHex: '#FFFFFF', etiquetaVisual: 'Distal', estado: 'Sano' },
        oclusal_incisal: { colorHex: '#FFFFFF', etiquetaVisual: 'Oclusal/Incisal', estado: 'Sano' }
      }
    };
  }
}