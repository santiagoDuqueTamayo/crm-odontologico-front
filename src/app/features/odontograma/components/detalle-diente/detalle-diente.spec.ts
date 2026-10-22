import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleDiente } from './detalle-diente';

describe('DetalleDiente', () => {
  let component: DetalleDiente;
  let fixture: ComponentFixture<DetalleDiente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleDiente]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleDiente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
