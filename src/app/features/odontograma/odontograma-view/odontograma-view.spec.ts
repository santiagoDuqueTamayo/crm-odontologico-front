import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { OdontogramaViewComponent } from './odontograma-view';
import { OdontogramaApiService } from '../services/odontograma-api.service';
import { OdontogramaUpdateResponse } from '../models/odontograma.models';
import { PacienteFormComponent } from '../components/paciente-form/paciente-form';

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

  it('should render compact left navigation and a separate clinical note rail', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    const nav = compiled.querySelector('.sidebar nav[aria-label="Navegación principal"]');
    expect(nav).toBeTruthy();
    expect(nav?.querySelectorAll('button')).toHaveLength(2);
    expect(compiled.querySelector('.workspace-grid #odontograma')).toBeTruthy();
    expect(compiled.querySelector('.note-rail app-nota-clinica')).toBeTruthy();
  });

  it('should show the no-findings message while the odontogram has only its default healthy states', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.legend-empty')?.textContent?.trim()).toBe(
      'No se tienen novedades en los dientes'
    );
  });

  it('should show the odontogram by default and open the patient form only from navigation', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-paciente-form')).toBeNull();
    expect(compiled.querySelector('.workspace-grid #odontograma')).toBeTruthy();

    const patientLink = [...compiled.querySelectorAll('nav button')].find((button) =>
      button.textContent?.includes('Paciente')
    );
    patientLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('app-paciente-form')).toBeTruthy();
    expect(compiled.querySelector('.workspace-grid #odontograma')).toBeNull();
    expect(
      fixture.debugElement.query(By.directive(PacienteFormComponent)).componentInstance.odontograma()
    ).toHaveLength(32);

    const odontogramLink = [...compiled.querySelectorAll('nav button')].find((button) =>
      button.textContent?.includes('Odontograma')
    );
    odontogramLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('app-paciente-form')).toBeNull();
    expect(compiled.querySelector('.workspace-grid #odontograma')).toBeTruthy();
  });

  it('should keep edited odontogram data in page memory when switching views', () => {
    component.dientes.update((dientes) =>
      dientes.map((diente) =>
        diente.numero === 16
          ? {
              ...diente,
              caras: {
                ...diente.caras,
                mesial: { ...diente.caras.mesial, estado: 'Caries', colorHex: '#EF4444' }
              }
            }
          : diente
      )
    );

    component.mostrarPaciente();
    fixture.detectChanges();
    const patientForm = fixture.debugElement.query(By.directive(PacienteFormComponent))
      .componentInstance as PacienteFormComponent;
    expect(patientForm.odontograma().find((diente) => diente.numero === 16)?.caras.mesial.estado)
      .toBe('Caries');

    component.mostrarOdontograma();
    fixture.detectChanges();
    component.mostrarPaciente();
    fixture.detectChanges();

    const reabierto = fixture.debugElement.query(By.directive(PacienteFormComponent))
      .componentInstance as PacienteFormComponent;
    expect(reabierto.odontograma().find((diente) => diente.numero === 16)?.caras.mesial.estado)
      .toBe('Caries');
  });

  it('should render 32 teeth and show the interactive detail when a tooth is selected', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.diente-container')).toHaveLength(32);
    expect(compiled.querySelectorAll('.caras-svg')).toHaveLength(0);

    const tooth = compiled.querySelector('button[aria-label^="Seleccionar diente 11"]');
    expect(tooth).toBeTruthy();
    tooth?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('#detalle-pieza-titulo')?.textContent).toContain('Diente 11');
    expect(compiled.querySelectorAll('.cara-superficie')).toHaveLength(5);
  });

  it('should send VoiceCaptureRequest to backend and paint updated tooth states from OdontogramaUpdateResponse', () => {
    const apiService = TestBed.inject(OdontogramaApiService);
    const mockResponse: OdontogramaUpdateResponse = {
      odontogramaId: 'odont-001',
      dientes: [
        {
          numero: 16,
          nombreColoquial: 'Primer molar superior derecho',
          cuadrante: 1,
          grupoDental: 'POSTERIOR',
          estadoGeneral: { estado: 'Presente', colorHex: null },
          caras: {
            mesial: { etiquetaVisual: 'Mesial', estado: 'Caries', colorHex: '#EF4444' },
            distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: '#22C55E' },
            vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#22C55E' },
            palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: '#22C55E' },
            oclusal_incisal: { etiquetaVisual: 'Oclusal', estado: 'Restaurado', colorHex: '#3B82F6' }
          }
        }
      ]
    };

    const spy = vi.spyOn(apiService, 'procesarDictadoVoz').mockReturnValue(of(mockResponse));

    component.finalizarConsulta('Paciente con caries mesial y restauración oclusal en diente 16');
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith({
      odontogramaId: 'odont-001',
      textoCapturado: 'Paciente con caries mesial y restauración oclusal en diente 16'
    });

    const diente16 = component.dientes().find((d) => d.numero === 16);
    expect(diente16?.caras.mesial.estado).toBe('Caries');
    expect(diente16?.caras.oclusal_incisal.estado).toBe('Restaurado');
    expect(component.dienteSeleccionado()).toBeNull();

    const compiled = fixture.nativeElement as HTMLElement;
    const tooth16Button = compiled.querySelector('button[aria-label^="Seleccionar diente 16"]');
    expect(tooth16Button?.classList.contains('has-finding')).toBe(true);
    expect(compiled.querySelector('app-modal-detalle-diente')).toBeNull();
    const legend = compiled.querySelector('.chart-legend')?.textContent ?? '';
    expect(legend).toContain('Caries');
    expect(legend).toContain('Restaurado');
    expect(legend).not.toContain('Sano');
    expect(legend).not.toContain('Presente');
    expect(legend).not.toContain('Endodoncia');
  });

  it('should open the modal on tooth click and update 3D diagram, 5-face circle, root SVG and crown SVG when saving face and root edits', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const tooth11Button = compiled.querySelector('button[aria-label^="Seleccionar diente 11"]') as HTMLButtonElement;
    tooth11Button.click();
    fixture.detectChanges();

    const modal = compiled.querySelector('app-modal-detalle-diente');
    expect(modal).toBeTruthy();

    // Editar cara Mesial -> Caries (#EF4444)
    const pills = modal!.querySelectorAll('.resumen-cara-pill');
    const mesialPill = [...pills].find((p) => p.textContent?.includes('Mesial')) as HTMLButtonElement;
    mesialPill.click();
    fixture.detectChanges();

    const opcionCaries = [...modal!.querySelectorAll('.estado-opcion-btn')].find(
      (b) => b.textContent?.trim() === 'Caries'
    ) as HTMLButtonElement;
    opcionCaries.click();
    fixture.detectChanges();

    // Editar Raíz -> Fractura Radicular (#B91C1C)
    const raizPill = [...pills].find((p) => p.textContent?.includes('Raíz')) as HTMLButtonElement;
    raizPill.click();
    fixture.detectChanges();

    const opcionFractura = [...modal!.querySelectorAll('.estado-opcion-btn')].find(
      (b) => b.textContent?.trim() === 'Fractura Radicular'
    ) as HTMLButtonElement;
    opcionFractura.click();
    fixture.detectChanges();

    // Presionar "Actualizar información" centrado en .estado-cara
    const btnGuardar = modal!.querySelector('.estado-cara .btn-actualizar-cara') as HTMLButtonElement;
    btnGuardar.click();
    fixture.detectChanges();

    // Verificar que se cerró el modal del diagrama 3D y apareció el mensaje de confirmación de edición
    expect(compiled.querySelector('app-modal-detalle-diente')).toBeNull();
    expect(compiled.querySelector('.alerta-confirmacion-edicion')?.textContent).toContain(
      'Se ha actualizado correctamente el estado del diente 11.'
    );

    // Verificar actualización en app-diente-grafico (corona general, raíz y diagrama circular de 5 estados)
    expect(tooth11Button.classList.contains('has-crown-finding')).toBe(true);
    expect(tooth11Button.classList.contains('has-root-finding')).toBe(true);
    expect(tooth11Button.style.getPropertyValue('--crown-color')).toBe('#EF4444');
    expect(tooth11Button.style.getPropertyValue('--root-color')).toBe('#B91C1C');

    const sectorMesial = tooth11Button.querySelector('.sector-mesial');
    expect(sectorMesial?.getAttribute('fill')).toBe('#EF4444');
    const sectorDistal = tooth11Button.querySelector('.sector-distal');
    expect(sectorDistal?.getAttribute('fill')).toBe('#fffef9');
  });
});
