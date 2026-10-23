import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OdontogramaGridComponent } from './odontograma-grid';

describe('OdontogramaGridComponent', () => {
  let component: OdontogramaGridComponent;
  let fixture: ComponentFixture<OdontogramaGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OdontogramaGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OdontogramaGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('dientes', []);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
