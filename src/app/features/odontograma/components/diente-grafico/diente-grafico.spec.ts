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
    expect(fixture.nativeElement.querySelector('.raiz')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.diagrama-circular-svg .sector-cara')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
  });

  it('should keep root, crown, and 5-face circle in default color when the tooth is Sano', () => {
    const dienteSano: DienteData = {
      numero: 11,
      nombreColoquial: 'Incisivo central superior derecho',
      estadoGeneral: { estado: 'Sano', colorHex: '#22C55E' },
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

    expect(component.tieneHallazgo()).toBe(false);
    expect(component.colorCorona()).toBeNull();
    expect(component.colorRaiz()).toBeNull();
    expect(component.colorCaraCirculo('mesial')).toBe('#fffef9');
  });

  it('should paint only the crown (.corona) and affected circle faces (NOT the root) when Caries is present', () => {
    const dienteConCaries: DienteData = {
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

    fixture.componentRef.setInput('diente', dienteConCaries);
    fixture.detectChanges();

    expect(component.colorCorona()).toBe('#EF4444');
    expect(component.colorRaiz()).toBeNull();
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-crown-finding')).toBe(true);
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-root-finding')).toBe(false);

    expect(component.colorCaraCirculo('mesial')).toBe('#EF4444');
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#3B82F6');
    expect(component.colorCaraCirculo('distal')).toBe('#fffef9');
  });

  it('should paint ONLY the root (.raiz) and NOT the crown or circle when a root-exclusive lesion (e.g. Fractura Radicular) is present', () => {
    const dienteFracturaRadicular: DienteData = {
      numero: 21,
      nombreColoquial: 'Incisivo central superior izquierdo',
      estadoGeneral: { estado: 'Fractura Radicular', colorHex: '#B91C1C' },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Sano', colorHex: '#22C55E' },
        distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: '#22C55E' },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#22C55E' },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: '#22C55E' },
        oclusal_incisal: { etiquetaVisual: 'Incisal', estado: 'Sano', colorHex: '#22C55E' }
      }
    };

    fixture.componentRef.setInput('diente', dienteFracturaRadicular);
    fixture.detectChanges();

    expect(component.colorRaiz()).toBe('#B91C1C');
    expect(component.colorCorona()).toBeNull();
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-root-finding')).toBe(true);
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-crown-finding')).toBe(false);

    expect(component.colorCaraCirculo('mesial')).toBe('#fffef9');
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#fffef9');
  });

  it('should paint root, crown, and all 5 circle faces when Endodoncia (full-tooth with root) is active', () => {
    const dienteConEndodoncia: DienteData = {
      numero: 24,
      nombreColoquial: 'Primer premolar superior izquierdo',
      estadoGeneral: { estado: 'Endodoncia', colorHex: '#D946EF' },
      caras: {
        mesial: { etiquetaVisual: 'Mesial', estado: 'Endodoncia', colorHex: '#D946EF' },
        distal: { etiquetaVisual: 'Distal', estado: 'Endodoncia', colorHex: '#D946EF' },
        vestibular: { etiquetaVisual: 'Vestibular', estado: 'Endodoncia', colorHex: '#D946EF' },
        palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Endodoncia', colorHex: '#D946EF' },
        oclusal_incisal: { etiquetaVisual: 'Oclusal', estado: 'Endodoncia', colorHex: '#D946EF' }
      }
    };

    fixture.componentRef.setInput('diente', dienteConEndodoncia);
    fixture.detectChanges();

    expect(component.colorRaiz()).toBe('#D946EF');
    expect(component.colorCorona()).toBe('#D946EF');
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-root-finding')).toBe(true);
    expect(fixture.nativeElement.querySelector('.diente-container').classList.contains('has-crown-finding')).toBe(true);
    expect(component.colorCaraCirculo('oclusal_incisal')).toBe('#D946EF');
  });
});
