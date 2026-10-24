import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotaClinicaComponent } from './nota-clinica';

describe('NotaClinicaComponent', () => {
  let component: NotaClinicaComponent;
  let fixture: ComponentFixture<NotaClinicaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotaClinicaComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NotaClinicaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should emit text entered in the clinical note', () => {
    const onNotaCambiada = vi.fn();
    component.notaCambiada.subscribe(onNotaCambiada);
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Paciente presenta sensibilidad';
    textarea.dispatchEvent(new Event('input'));

    expect(onNotaCambiada).toHaveBeenCalledWith('Paciente presenta sensibilidad');
  });

  it('should render the textarea without whitespace text nodes', () => {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.textContent).toBe('');
  });

  it('should emit the complete note when the consultation is finalized', () => {
    const onFinalizar = vi.fn();
    component.finalizar.subscribe(onFinalizar);
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Dolor en pieza 16';
    textarea.dispatchEvent(new Event('input'));

    component.finalizarNota();

    expect(onFinalizar).toHaveBeenCalledWith('Dolor en pieza 16');
  });
});
