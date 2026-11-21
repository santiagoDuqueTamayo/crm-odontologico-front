import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OdontogramaApiService } from '../../services/odontograma-api.service';
import { SpeechTranscriptionService } from '../../services/speech-transcription.service';
import { PacienteFormComponent } from './paciente-form';

const { pdfMock, jsPdfMock } = vi.hoisted(() => {
  const pdf = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setProperties: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    roundedRect: vi.fn(),
    setDrawColor: vi.fn(),
    addSvgAsImage: vi.fn(() => Promise.resolve(pdf)),
    splitTextToSize: vi.fn((text: string) => [text]),
    addPage: vi.fn(),
    save: vi.fn()
  };
  return { pdfMock: pdf, jsPdfMock: vi.fn(function () { return pdf; }) };
});

vi.mock('jspdf', () => ({ jsPDF: jsPdfMock }));

describe('PacienteFormComponent', () => {
  let fixture: ComponentFixture<PacienteFormComponent>;
  let component: PacienteFormComponent;
  let transcription: {
    transcribir: ReturnType<typeof vi.fn>;
  };
  let patientApi: { procesarDictadoPaciente: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transcription = {
      transcribir: vi.fn(() =>
        of('María López tiene 34 años y es alérgica a la penicilina.')
      )
    };
    patientApi = {
      procesarDictadoPaciente: vi.fn(() =>
        of({
          nombres: 'María',
          apellidos: 'López',
          identificacion: '',
          edad: '34',
          genero: '',
          telefono: '',
          correo: '',
          direccion: '',
          ocupacion: '',
          aseguradora: '',
          contactoEmergencia: '',
          alergias: 'Penicilina',
          medicamentos: '',
          antecedentesMedicos: '',
          antecedentesOdontologicos: ''
        })
      )
    };
    await TestBed.configureTestingModule({
      imports: [PacienteFormComponent],
      providers: [
        { provide: SpeechTranscriptionService, useValue: transcription },
        { provide: OdontogramaApiService, useValue: patientApi }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PacienteFormComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should render patient details and update the patient model on input', () => {
    fixture.detectChanges();

    const names = fixture.nativeElement.querySelector('#patient-nombres') as HTMLInputElement;
    names.value = 'María José';
    names.dispatchEvent(new Event('input'));

    expect(component.paciente().nombres).toBe('María José');
    expect(fixture.nativeElement.textContent).toContain('Antecedentes odontológicos');
  });

  it('should export the patient details as a PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<svg></svg>'
      })
    );
    fixture.detectChanges();

    const exportButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) =>
        button.textContent?.includes('Exportar ficha y odontograma en PDF')
    );
    if (!exportButton) throw new Error('PDF export button was not rendered');
    exportButton.click();
    await fixture.whenStable();

    expect(jsPdfMock).toHaveBeenCalledOnce();
    expect(pdfMock.addSvgAsImage).toHaveBeenCalled();
    expect(pdfMock.text).toHaveBeenCalledWith('Datos personales', 21, 53.5);
    expect(pdfMock.save).toHaveBeenCalledWith('ficha-paciente.pdf');
    expect(fixture.nativeElement.textContent).toContain(
      'La ficha y el odontograma se descargaron en PDF.'
    );
  });

  it('should include the current odontogram findings in the exported PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<svg></svg>'
      })
    );
    fixture.componentRef.setInput('odontograma', [
      {
        numero: 16,
        nombreColoquial: 'Primer molar superior derecho',
        estadoGeneral: { estado: 'Sano', colorHex: '#ffffff' },
        caras: {
          mesial: { etiquetaVisual: 'Mesial', estado: 'Caries', colorHex: '#EF4444' },
          distal: { etiquetaVisual: 'Distal', estado: 'Sano', colorHex: '#ffffff' },
          vestibular: { etiquetaVisual: 'Vestibular', estado: 'Sano', colorHex: '#ffffff' },
          palatino_lingual: { etiquetaVisual: 'Palatino', estado: 'Sano', colorHex: '#ffffff' },
          oclusal_incisal: { etiquetaVisual: 'Oclusal', estado: 'Sano', colorHex: '#ffffff' }
        }
      }
    ]);
    fixture.detectChanges();

    await component['exportarPdf']();

    expect(pdfMock.text).toHaveBeenCalledWith(
      '16 · Mesial: Caries',
      expect.any(Number),
      expect.any(Number)
    );
    expect(pdfMock.text).toHaveBeenCalledWith(
      '16',
      expect.any(Number),
      expect.any(Number),
      { align: 'center' }
    );
  });

  it('should transcribe all patient details and distribute them into the matching fields', async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    });

    class MockMediaRecorder extends FakeMediaRecorder {}
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder
    });

    fixture.detectChanges();
    component.paciente.update((patient) => ({ ...patient, telefono: '3001234567' }));
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const startButton = [...buttons].find((button) =>
      button.textContent?.includes('Dictar información del paciente')
    );
    if (!startButton) throw new Error('Voice dictation button was not rendered');
    startButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const stopButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Detener grabación')
    );
    if (!stopButton) throw new Error('Stop dictation button was not rendered');
    stopButton.click();
    fixture.detectChanges();

    const names = fixture.nativeElement.querySelector('#patient-nombres') as HTMLInputElement;
    const surname = fixture.nativeElement.querySelector('#patient-apellidos') as HTMLInputElement;
    const age = fixture.nativeElement.querySelector('#patient-edad') as HTMLInputElement;
    const phone = fixture.nativeElement.querySelector('#patient-telefono') as HTMLInputElement;
    const allergies = fixture.nativeElement.querySelector('#patient-alergias') as HTMLTextAreaElement;
    expect(names.value).toBe('María');
    expect(surname.value).toBe('López');
    expect(age.value).toBe('34');
    expect(phone.value).toBe('3001234567');
    expect(allergies.value).toBe('Penicilina');
    expect(transcription.transcribir).toHaveBeenCalledWith(expect.any(Blob));
    expect(patientApi.procesarDictadoPaciente).toHaveBeenCalledWith(
      'María López tiene 34 años y es alérgica a la penicilina.'
    );
    expect(fixture.nativeElement.querySelector('#patient-transcript')?.value).toContain('María López');
    expect(stopTrack).toHaveBeenCalled();

    Reflect.deleteProperty(window, 'MediaRecorder');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });
});

class FakeMediaRecorder {
  static isTypeSupported(): boolean {
    return true;
  }

  state: RecordingState = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(
    _stream: MediaStream,
    _options?: MediaRecorderOptions
  ) {}

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['patient detail audio'], { type: 'audio/webm' })
    } as BlobEvent);
    this.onstop?.(new Event('stop'));
  }
}
