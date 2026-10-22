import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DienteGrafico } from './diente-grafico';

describe('DienteGrafico', () => {
  let component: DienteGrafico;
  let fixture: ComponentFixture<DienteGrafico>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DienteGrafico]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DienteGrafico);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
