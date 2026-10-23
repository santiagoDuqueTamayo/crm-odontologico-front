import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleDienteComponent } from './detalle-diente';

describe('DetalleDienteComponent', () => {
  let component: DetalleDienteComponent;
  let fixture: ComponentFixture<DetalleDienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleDienteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleDienteComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
