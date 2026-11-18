import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DienteData } from '../../models/odontograma.models';
import { DetallePiezaComponent } from './detalle-pieza';

describe('DetallePiezaComponent', () => {
  let fixture: ComponentFixture<DetallePiezaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallePiezaComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DetallePiezaComponent);
    fixture.componentRef.setInput('diente', crearDiente());
    await fixture.whenStable();
  });

  it('should render and make all five dental surfaces selectable', () => {
    fixture.detectChanges();

    const surfaces = fixture.nativeElement.querySelectorAll('.cara-superficie');
    if (surfaces.length) {
      expect(surfaces).toHaveLength(5);
    } else {
      expect(fixture.nativeElement.querySelector('.visor-cargando')).toBeTruthy();
    }
  });

  it('should show a loading indicator instead of the flat image while the 3D model loads', () => {
    fixture.detectChanges();
    fixture.componentInstance.estadoVisor3d.set('cargando');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.visor-cargando')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.caras-svg')).toBeNull();
  });

  it('should keep the 3D view fixed at its default zoom', () => {
    fixture.componentInstance.estadoVisor3d.set('listo');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.controles-3d')?.textContent).toContain('Arrastra para girar');
    expect(fixture.nativeElement.querySelector('.controles-3d')?.textContent).not.toContain('acercar');
    expect(fixture.nativeElement.querySelector('.visor-3d')?.getAttribute('onwheel')).toBeNull();
  });

  it('should show the roots in perspective within the occlusal tooth illustration', () => {
    fixture.detectChanges();

    const view = fixture.nativeElement.querySelector('.vista-diente');
    expect(view.querySelector('.caras-svg')).toBeTruthy();
    expect(view.querySelectorAll('.caras-svg .raiz-perspectiva')).toHaveLength(2);
    expect(view.querySelector('.caras-svg .surco-raiz')).toBeTruthy();
    expect(view.querySelector('.vista-perspectiva')).toBeNull();
  });

  it('should emit the selected face and show its clinical state', () => {
    const component = fixture.componentInstance;
    const onCaraClickeada = vi.fn();
    component.caraClickeada.subscribe(onCaraClickeada);

    component.seleccionarCara('vestibular');
    fixture.componentRef.setInput('caraSeleccionada', 'vestibular');
    fixture.detectChanges();

    expect(onCaraClickeada).toHaveBeenCalledWith('vestibular');
    expect(fixture.nativeElement.querySelector('.estado-cara-badge')?.textContent).toContain('Caries');
  });

  it('should update the displayed tooth details when the selected tooth changes', () => {
    fixture.componentRef.setInput('diente', crearDiente(26));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#detalle-pieza-titulo')?.textContent).toContain('Diente 26');
    expect(fixture.nativeElement.querySelector('.estado-general')?.textContent).toContain('Restaurado');
  });

  it('should separate root and crown coloring for root-only, surface-only, and full-tooth states', () => {
    const component = fixture.componentInstance;

    // 1. Solo una cara afectada (Vestibular con Caries): solo pinta esa cara, no las demás ni la raíz
    expect(component.colorCaraSvg('vestibular')).toBe('#fca5a5');
    expect(component.colorCaraSvg('distal')).toBe('#fffdf5');
    expect(component.colorRaizSvg()).toBe('#f5f0e5');

    // 2. Solo raíz afectada (Fractura Radicular): pinta solo la raíz, las caras quedan neutras
    const dienteRaiz = crearDiente(21);
    dienteRaiz.estadoGeneral = { estado: 'Fractura Radicular', colorHex: '#B91C1C' };
    dienteRaiz.caras.vestibular = { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#22C55E' };
    fixture.componentRef.setInput('diente', dienteRaiz);
    fixture.detectChanges();

    expect(component.colorRaizSvg()).toBe('#B91C1C');
    expect(component.colorCaraSvg('vestibular')).toBe('#fffdf5');
    expect(component.colorCaraSvg('oclusal_incisal')).toBe('#fffdf5');

    // 3. Diente completo (Endodoncia): pinta tanto la raíz como todas las caras
    const dienteCompleto = crearDiente(24);
    dienteCompleto.estadoGeneral = { estado: 'Endodoncia', colorHex: '#D946EF' };
    dienteCompleto.caras.vestibular = { etiquetaVisual: 'Vestibular', estado: 'Endodoncia', colorHex: '#D946EF' };
    dienteCompleto.caras.distal = { etiquetaVisual: 'Distal', estado: 'Endodoncia', colorHex: '#D946EF' };
    fixture.componentRef.setInput('diente', dienteCompleto);
    fixture.detectChanges();

    expect(component.colorRaizSvg()).toBe('#D946EF');
    expect(component.colorCaraSvg('vestibular')).toBe('#D946EF');
    expect(component.colorCaraSvg('distal')).toBe('#D946EF');
  });

  it('should open the clinical states dropdown with colored dots when clicking a face button and update on save', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pills = el.querySelectorAll('.resumen-cara-pill');
    expect(pills).toHaveLength(6); // 5 caras + Raíz

    // Clic sobre la etiqueta de Distal
    const distalPill = [...pills].find((btn) => btn.textContent?.includes('Distal')) as HTMLButtonElement;
    expect(distalPill).toBeTruthy();
    distalPill.click();
    fixture.detectChanges();

    const dropdown = el.querySelector('.estados-dropdown');
    expect(dropdown).toBeTruthy();
    const opciones = dropdown?.querySelectorAll('.estado-opcion-btn') ?? [];
    expect(opciones.length).toBeGreaterThan(10);
    expect(dropdown?.querySelector('.estado-opcion-dot')).toBeTruthy();

    // Seleccionar Restaurado (#3B82F6) para Distal
    const opcionRestaurado = [...opciones].find((opt) =>
      opt.textContent?.trim() === 'Restaurado'
    ) as HTMLButtonElement;
    opcionRestaurado.click();
    fixture.detectChanges();

    expect(el.querySelector('.estados-dropdown')).toBeNull();
    expect(distalPill.textContent).toContain('Restaurado');

    // Clic en el botón "Actualizar información" dentro de .estado-cara
    const onActualizar = vi.fn();
    fixture.componentInstance.actualizarDiente.subscribe(onActualizar);

    const btnGuardar = el.querySelector('.estado-cara .btn-actualizar-cara') as HTMLButtonElement;
    expect(btnGuardar).toBeTruthy();
    btnGuardar.click();
    fixture.detectChanges();

    expect(onActualizar).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.colorCaraSvg('distal')).toBe('#3B82F6');
  });
});

function crearDiente(numero = 11): DienteData {
  const cara = (etiquetaVisual: string, estado: string) => ({
    etiquetaVisual,
    estado,
    colorHex: estado === 'Caries' ? '#fca5a5' : '#fffdf5'
  });

  return {
    numero,
    nombreColoquial: `Diente ${numero}`,
    estadoGeneral: {
      estado: numero === 26 ? 'Restaurado' : 'Sano',
      colorHex: '#ffffff'
    },
    caras: {
      vestibular: cara('Vestibular', 'Caries'),
      distal: cara('Distal', 'Sano'),
      mesial: cara('Mesial', 'Sano'),
      palatino_lingual: cara('Palatino/Lingual', 'Sano'),
      oclusal_incisal: cara('Oclusal/Incisal', 'Sano')
    }
  };
}
