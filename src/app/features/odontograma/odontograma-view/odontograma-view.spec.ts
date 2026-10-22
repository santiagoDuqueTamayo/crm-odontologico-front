import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OdontogramaView } from './odontograma-view';

describe('OdontogramaView', () => {
  let component: OdontogramaView;
  let fixture: ComponentFixture<OdontogramaView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OdontogramaView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OdontogramaView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
