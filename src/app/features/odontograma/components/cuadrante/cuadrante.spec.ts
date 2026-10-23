import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CuadranteComponent } from './cuadrante';

describe('CuadranteComponent', () => {
  let component: CuadranteComponent;
  let fixture: ComponentFixture<CuadranteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuadranteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CuadranteComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('dientes', []);
    fixture.componentRef.setInput('orientacion', 'superior-derecho');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
