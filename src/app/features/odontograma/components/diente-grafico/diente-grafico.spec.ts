import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DienteData } from '../../models/odontograma.models';
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

  it('should render a tooth silhouette and the 5-face circular diagram', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.corona')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.diagrama-circular-svg .sector-cara')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
  });

  it('should paint the tooth green (#22C55E) and keep the 5-face circle in default color (#fffef9) when evaluated as Sano', () => {
    const dienteSano: DienteData = {
      numero: 11,
      nombreColoquial: 'Incisivo central superior derecho',
      estadoGeneral: { estado: 'Presente', colorHex: null },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Sano', colorHex: '#22C55E' },
        distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: '#22C55E' },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#22C55E' },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: '#22C55E' },
        oclusal_incisal: { etiquetaVisual: 'Incisal', estado: 'Sano', colorHex: '#22C55E' }
      }
    };

    fixture.componentRef.setInput('diente', dienteSano);
    fixture.detectChanges();

    expect(component.tieneHallazgo()).toBe(true);
    expect(component.colorHallazgo()).toBe('#22C55E');
    expect(component.colorCaraCirculo('mesial')).toBe('#fffef9');
    expect(component.colorCaraCirculo('distal')).toBe('#fffef9');
    expect(component.colorCaraCirculo('vestibular')).toBe('#fffef9');
    expect(component.colorCaraCirculo('palatino_lingual')).toBe('#fffef9');
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#fffef9');
  });

  it('should paint only affected faces in the circle and apply clinical priority to the main tooth diagram', () => {
    const dienteConHallazgos: DienteData = {
      numero: 16,
      nombreColoquial: 'Primer molar superior derecho',
      estadoGeneral: { estado: 'Presente', colorHex: null },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Caries', colorHex: '#EF4444' },
        distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: '#22C55E' },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#22C55E' },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: '#22C55E' },
        oclusal_incisal: { etiquetaVisual: 'Oclusal', estado: 'Restaurado', colorHex: '#3B82F6' }
      }
    };

    fixture.componentRef.setInput('diente', dienteConHallazgos);
    fixture.detectChanges();

    // Prioridad clínica: Caries (#EF4444) predomina sobre Restaurado (#3B82F6) en el diente principal
    expect(component.colorHallazgo()).toBe('#EF4444');

    // En el círculo solo se pintan las caras afectadas con su color respectivo; las sanas quedan en #fffef9
    expect(component.colorCaraCirculo('mesial')).toBe('#EF4444');
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#3B82F6');
    expect(component.colorCaraCirculo('distal')).toBe('#fffef9');
    expect(component.colorCaraCirculo('vestibular')).toBe('#fffef9');
    expect(component.colorCaraCirculo('palatino_lingual')).toBe('#fffef9');
  });

  it('should paint both the main tooth diagram and all 5 circle faces when a whole-tooth state is active', () => {
    const dienteConCorona: DienteData = {
      numero: 15,
      nombreColoquial: 'Segundo premolar superior derecho',
      estadoGeneral: { estado: 'Corona', colorHex: '#EAB308' },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Corona', colorHex: '#EAB308' },
        distal: { etiquetaVisual: 'Distal', estado: 'Corona', colorHex: '#EAB308' },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Corona', colorHex: '#EAB308' },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Corona', colorHex: '#EAB308' },
        oclusal_incisal: { etiquetaVisual: 'Oclusal', estado: 'Corona', colorHex: '#EAB308' }
      }
    };

    fixture.componentRef.setInput('diente', dienteConCorona);
    fixture.detectChanges();

    expect(component.colorHallazgo()).toBe('#EAB308');
    expect(component.colorCaraCirculo('mesial')).toBe('#EAB308');
    expect(component.colorCaraCirculo('distal')).toBe('#EAB308');
    expect(component.colorCaraCirculo('vestibular')).toBe('#EAB308');
    expect(component.colorCaraCirculo('palatino_lingual')).toBe('#EAB308');
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#EAB308');
  });
});
