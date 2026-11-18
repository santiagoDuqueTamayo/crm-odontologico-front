import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DienteData } from '../../models/odontograma.models';
import { ModalDetalleDienteComponent } from './modal-detalle-diente';

describe('ModalDetalleDienteComponent', () => {
  let fixture: ComponentFixture<ModalDetalleDienteComponent>;
  let component: ModalDetalleDienteComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalDetalleDienteComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalDetalleDienteComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('diente', crearDienteMock());
    await fixture.whenStable();
  });

  it('should create and render the modal dialog with the 5 crown faces plus root', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(component).toBeTruthy();
    expect(el.querySelector('.modal-backdrop')).toBeTruthy();
    expect(el.querySelector('.modal-dialog')).toBeTruthy();
    expect(el.querySelectorAll('.resumen-cara-pill')).toHaveLength(6);
    expect(el.querySelector('.estado-cara .btn-actualizar-cara')?.textContent).toContain(
      'Actualizar información'
    );
  });

  it('should emit cerrar when clicking the close button or backdrop', () => {
    fixture.detectChanges();
    const onCerrar = vi.fn();
    component.cerrar.subscribe(onCerrar);

    const closeBtn = fixture.nativeElement.querySelector('.modal-close-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(onCerrar).toHaveBeenCalledTimes(1);

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});

function crearDienteMock(numero = 11): DienteData {
  const cara = (etiquetaVisual: string) => ({
    etiquetaVisual,
    estado: 'Sano',
    colorHex: '#ffffff'
  });

  return {
    numero,
    nombreColoquial: `Diente ${numero}`,
    estadoGeneral: { estado: 'Sano', colorHex: '#ffffff' },
    caras: {
      vestibular: cara('Vestibular'),
      distal: cara('Distal'),
      mesial: cara('Mesial'),
      palatino_lingual: cara('Palatino'),
      oclusal_incisal: cara('Incisal')
    }
  };
}
