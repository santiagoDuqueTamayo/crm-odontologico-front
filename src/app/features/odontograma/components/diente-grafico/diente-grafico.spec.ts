import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DienteGraficoComponent } from './diente-grafico';
import { CarasDiente } from '../../models/odontograma.models';

describe('DienteGraficoComponent', () => {
  let component: DienteGraficoComponent;
  let fixture: ComponentFixture<DienteGraficoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DienteGraficoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DienteGraficoComponent);
    component = fixture.componentInstance;
    const caraSana = (etiquetaVisual: string) => ({
      colorHex: '#ffffff',
      etiquetaVisual,
      estado: 'Sano' as const
    });
    const caras: CarasDiente = {
      vestibular: caraSana('Vestibular'),
      palatino_lingual: caraSana('Palatino/Lingual'),
      mesial: caraSana('Mesial'),
      distal: caraSana('Distal'),
      oclusal_incisal: caraSana('Oclusal/Incisal')
    };
    fixture.componentRef.setInput('numeroDiente', 11);
    fixture.componentRef.setInput('caras', caras);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
