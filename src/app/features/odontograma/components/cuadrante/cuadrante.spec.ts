import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cuadrante } from './cuadrante';

describe('Cuadrante', () => {
  let component: Cuadrante;
  let fixture: ComponentFixture<Cuadrante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cuadrante]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cuadrante);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
