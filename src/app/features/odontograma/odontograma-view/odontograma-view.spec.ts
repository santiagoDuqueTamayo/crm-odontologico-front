import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OdontogramaViewComponent } from './odontograma-view';

describe('OdontogramaViewComponent', () => {
  let component: OdontogramaViewComponent;
  let fixture: ComponentFixture<OdontogramaViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OdontogramaViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OdontogramaViewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all 32 teeth and show the selected tooth details', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.diente-container')).toHaveLength(32);

    component.onDienteSeleccionado(11);
    fixture.detectChanges();

    expect(compiled.querySelector('.detalle-titulo')?.textContent).toContain('Diente 11');
  });
});
