import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DienteGraficoComponent } from './diente-grafico';

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
    fixture.componentRef.setInput('numeroDiente', 11);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a tooth silhouette without interactive surface zones', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.corona')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
  });

  it('should mark a tooth with a non-healthy general state in red', () => {
    fixture.componentRef.setInput('diente', {
      numero: 11,
      nombreColoquial: 'Diente 11',
      estadoGeneral: { estado: 'Restaurado', colorHex: '#3B82F6' },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Sano', colorHex: null },
        distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: null },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: null },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: null },
        oclusal_incisal: { etiquetaVisual: 'Incisal', estado: 'Sano', colorHex: null }
      }
    });

    expect(component.colorHallazgo()).toBe('#EF4444');
  });

  it('should not mark healthy or unspecified general states in red', () => {
    const caras = {
      mesial: { etiquetaVisual: 'Mesial', estado: 'Sano', colorHex: null },
      distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: null },
      vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: null },
      palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: null },
      oclusal_incisal: { etiquetaVisual: 'Incisal', estado: 'Sano', colorHex: null }
    };

    for (const estado of ['Sano', 'Presente', '']) {
      fixture.componentRef.setInput('diente', {
        numero: 11,
        nombreColoquial: 'Diente 11',
        estadoGeneral: { estado, colorHex: null },
        caras
      });

      expect(component.colorHallazgo()).toBeNull();
    }
  });
});
