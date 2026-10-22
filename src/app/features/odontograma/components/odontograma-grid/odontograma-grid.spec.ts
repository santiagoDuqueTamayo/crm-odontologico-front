import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OdontogramaGrid } from './odontograma-grid';

describe('OdontogramaGrid', () => {
  let component: OdontogramaGrid;
  let fixture: ComponentFixture<OdontogramaGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OdontogramaGrid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OdontogramaGrid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
