import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ActualizarDienteRequest,
  CarasDiente,
  CaraVisual,
  CATALOGO_ESTADOS_CLINICOS,
  construirDienteActualizado,
  DienteData,
  esEstadoExclusivoDeRaiz,
  OpcionEstadoClinico,
  resolverColorPorEstadoClinico,
  SuperficieDentalId
} from '../../models/odontograma.models';
import type * as THREE from 'three';

export type CaraDienteId = SuperficieDentalId;
type TipoParte3d = 'corona' | 'raiz';

const ESTADOS_DIENTE_COMPLETO_CON_RAIZ = new Set<string>([
  'endodoncia',
  'núcleo/poste',
  'nucleo/poste',
  'implante',
  'ausente',
  'extraído',
  'extraido',
  'retenido',
  'en erupción',
  'en erupcion'
]);

@Component({
  selector: 'app-detalle-pieza',
  standalone: true,
  templateUrl: './detalle-pieza.html',
  styleUrl: './detalle-pieza.scss'
})
export class DetallePiezaComponent implements AfterViewInit, OnDestroy {
  readonly diente = input.required<DienteData>();
  readonly caraSeleccionada = input<CaraDienteId | null>(null);
  readonly caraClickeada = output<CaraDienteId>();
  readonly actualizarDiente = output<ActualizarDienteRequest>();

  readonly estadoVisor3d = signal<'cargando' | 'listo' | 'alternativa' | 'error'>('cargando');
  readonly numeroModelo = signal<number | null>(null);
  readonly errorVisor3d = signal('');
  readonly caraMenuAbierto = signal<CaraDienteId | null>(null);
  readonly estadosCatalogo: readonly OpcionEstadoClinico[] = CATALOGO_ESTADOS_CLINICOS;

  private readonly caraSeleccionadaInterna = signal<{
    dienteNumero: number;
    cara: CaraDienteId | null;
  } | null>(null);

  private readonly cambiosPendientes = signal<{
    dienteReferencia: DienteData;
    cambios: Partial<Record<CaraDienteId, string>>;
  } | null>(null);

  private readonly edicionConfirmada = signal<{
    dienteReferencia: DienteData;
    dienteActualizado: DienteData;
  } | null>(null);

  /**
   * Diente efectivo confirmado (refleja el input actual o la última actualización guardada).
   */
  readonly dienteEfectivo = computed<DienteData>(() => {
    const entrada = this.diente();
    const confirmada = this.edicionConfirmada();
    if (confirmada && confirmada.dienteReferencia === entrada) {
      return confirmada.dienteActualizado;
    }
    return entrada;
  });

  /**
   * Cara actualmente activa (prioriza el input externo si se provee o la selección interna).
   */
  readonly caraActivaId = computed<CaraDienteId | null>(() => {
    const externa = this.caraSeleccionada();
    if (externa !== null) {
      return externa;
    }
    const interna = this.caraSeleccionadaInterna();
    if (interna && interna.dienteNumero === this.diente().numero) {
      return interna.cara;
    }
    return null;
  });

  /**
   * Estado en borrador de las 5 caras coronales y la raíz antes de presionar "Actualizar información".
   */
  readonly borradorCaras = computed<Record<CaraDienteId, string>>(() => {
    const actual = this.dienteEfectivo();
    const pendientes = this.cambiosPendientes();
    const cambios =
      pendientes && pendientes.dienteReferencia === this.diente() ? pendientes.cambios : {};
    const estadoRaizBase = this.obtenerEstadoInicialRaiz(actual);

    return {
      vestibular: cambios.vestibular ?? actual.caras.vestibular.estado,
      palatino_lingual: cambios.palatino_lingual ?? actual.caras.palatino_lingual.estado,
      mesial: cambios.mesial ?? actual.caras.mesial.estado,
      distal: cambios.distal ?? actual.caras.distal.estado,
      oclusal_incisal: cambios.oclusal_incisal ?? actual.caras.oclusal_incisal.estado,
      raiz: cambios.raiz ?? estadoRaizBase
    };
  });

  readonly caraActiva = computed<CaraVisual | null>(() => {
    const id = this.caraActivaId();
    if (!id) {
      return null;
    }
    const pieza = this.dienteEfectivo();
    const estadoBorrador = this.borradorCaras()[id];
    const etiquetaVisual =
      id === 'raiz'
        ? pieza.raiz?.etiquetaVisual || 'Raíz'
        : pieza.caras[id]?.etiquetaVisual || id;
    const colorOriginal =
      id === 'raiz' ? pieza.raiz?.colorHex ?? null : pieza.caras[id]?.colorHex ?? null;

    return {
      etiquetaVisual,
      estado: estadoBorrador,
      colorHex: this.esEstadoSanoOPresente(estadoBorrador)
        ? null
        : resolverColorPorEstadoClinico(estadoBorrador, colorOriginal)
    };
  });

  readonly tituloPieza = computed(() => {
    const actual = this.dienteEfectivo();
    const numStr = String(actual.numero);
    if (actual.nombreColoquial.includes(numStr)) {
      return actual.nombreColoquial;
    }
    return `${actual.nombreColoquial} (Diente ${numStr})`;
  });

  readonly resumenCaras = computed(() => {
    const pieza = this.dienteEfectivo();
    const caras = pieza.caras;
    const borrador = this.borradorCaras();
    const ids: CaraDienteId[] = [
      'vestibular',
      'palatino_lingual',
      'mesial',
      'distal',
      'oclusal_incisal',
      'raiz'
    ];
    return ids.map((id) => {
      const etiquetaVisual =
        id === 'raiz' ? pieza.raiz?.etiquetaVisual || 'Raíz' : caras[id].etiquetaVisual;
      const estado = borrador[id];
      const colorHex = this.colorBadgeCara(id);
      return {
        id,
        etiquetaVisual,
        estado,
        colorHex,
        tieneHallazgo: !this.esEstadoSanoOPresente(estado)
      };
    });
  });

  @ViewChild('visor3d') private visor3d?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly aparienciaEffect = effect(() => {
    const pieza = this.dienteEfectivo();
    const numero = pieza.numero;
    this.caraActivaId();
    if (this.three && this.toothGroup && this.numeroModelo() !== numero) {
      this.limpiarModelo();
      this.crearDiente3d();
    }
    this.actualizarColores();
  });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materiales: THREE.Material[] = [];
  private three?: typeof import('three');
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private toothGroup?: THREE.Group;
  private regionLines?: THREE.Group;
  private resizeObserver?: ResizeObserver;
  private pointerStart: { x: number; y: number; theta: number; phi: number } | null = null;
  private cameraTheta = 0.45;
  private cameraPhi = 0.95;
  private readonly cameraRadius = 7;
  private cameraTarget?: THREE.Vector3;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const host = this.visor3d?.nativeElement;
    if (!host) return;

    if (typeof WebGL2RenderingContext === 'undefined') {
      this.estadoVisor3d.set('alternativa');
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!context) {
      this.estadoVisor3d.set('alternativa');
      return;
    }

    let three: typeof import('three');
    try {
      three = await import('three');
    } catch (error) {
      if (this.destroyed) return;
      console.error('No fue posible cargar el visor 3D del diente.', error);
      this.errorVisor3d.set('No se pudo cargar el modelo 3D. Puedes seguir usando la vista ilustrada.');
      this.estadoVisor3d.set('error');
      return;
    }
    if (this.destroyed) return;
    this.three = three;

    this.renderer = new three.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = three.SRGBColorSpace;
    this.renderer.setClearColor(0xffffff, 0);
    host.appendChild(canvas);

    this.scene = new three.Scene();
    this.camera = new three.PerspectiveCamera(32, 1, 0.1, 100);
    this.cameraTarget = new three.Vector3(0, -0.12, 0);
    this.toothGroup = new three.Group();
    this.regionLines = new three.Group();
    this.scene.add(this.toothGroup);
    this.scene.add(this.regionLines);

    this.scene.add(new three.HemisphereLight(0xffffff, 0xd8d0c4, 2.1));
    const keyLight = new three.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-3, 5, 5);
    this.scene.add(keyLight);
    const fillLight = new three.DirectionalLight(0xf1f6ff, 1.5);
    fillLight.position.set(4, 1, -4);
    this.scene.add(fillLight);

    this.crearDiente3d();
    this.actualizarCamara();
    this.resizeObserver = new ResizeObserver(() => this.redimensionar());
    this.resizeObserver.observe(host);
    this.estadoVisor3d.set('listo');
    requestAnimationFrame(() => this.redimensionar());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materiales.forEach((material) => material.dispose());
  }

  seleccionarCara(cara: CaraDienteId): void {
    this.caraSeleccionadaInterna.set({
      dienteNumero: this.diente().numero,
      cara
    });
    this.caraClickeada.emit(cara);
  }

  /**
   * Abre o cierra la lista desplegable de estados clínicos al hacer clic sobre la etiqueta/botón de una cara.
   */
  onClickEtiquetaCara(cara: CaraDienteId, event?: Event): void {
    event?.stopPropagation();
    this.seleccionarCara(cara);
    this.caraMenuAbierto.update((actual) => (actual === cara ? null : cara));
  }

  /**
   * Asigna un nuevo estado clínico en el borrador para la cara o raíz indicada y cierra el desplegable.
   */
  seleccionarEstadoParaCara(cara: CaraDienteId, nuevoEstado: string, event?: Event): void {
    event?.stopPropagation();
    const referencia = this.diente();
    const previos =
      this.cambiosPendientes()?.dienteReferencia === referencia
        ? this.cambiosPendientes()!.cambios
        : {};

    this.cambiosPendientes.set({
      dienteReferencia: referencia,
      cambios: {
        ...previos,
        [cara]: nuevoEstado
      }
    });
    this.caraMenuAbierto.set(null);
  }

  /**
   * Confirma y aplica los cambios de estado de las caras y la raíz, actualizando el modelo 3D
   * y emitiendo la solicitud hacia el componente padre / servicio para actualizar el odontograma.
   */
  guardarCambiosDiente(): void {
    const borrador = this.borradorCaras();
    const request: ActualizarDienteRequest = {
      numeroDiente: this.diente().numero,
      caras: {
        vestibular: borrador.vestibular,
        palatino_lingual: borrador.palatino_lingual,
        mesial: borrador.mesial,
        distal: borrador.distal,
        oclusal_incisal: borrador.oclusal_incisal
      },
      raiz: borrador.raiz
    };

    const dienteActualizado = construirDienteActualizado(
      this.dienteEfectivo(),
      request.caras,
      request.raiz
    );

    this.edicionConfirmada.set({
      dienteReferencia: this.diente(),
      dienteActualizado
    });
    this.caraMenuAbierto.set(null);
    this.actualizarColores();
    this.actualizarDiente.emit(request);
  }

  onCaraKeydown(cara: CaraDienteId, evento: KeyboardEvent): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      this.seleccionarCara(cara);
    }
  }

  colorCaraSvg(face: keyof CarasDiente): string {
    const pieza = this.dienteEfectivo();
    const cara = pieza.caras[face];
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);

    if (pieza.raiz !== undefined) {
      if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
        return resolverColorPorEstadoClinico(cara.estado, cara.colorHex);
      }
      return '#fffdf5';
    }

    if (
      cara &&
      !this.esEstadoSanoOPresente(cara.estado) &&
      !esEstadoExclusivoDeRaiz(cara.estado) &&
      cara.colorHex &&
      !coloresNeutros.has(cara.colorHex.toLowerCase())
    ) {
      return cara.colorHex;
    }
    const estadoGeneral = pieza.estadoGeneral;
    if (
      estadoGeneral &&
      !this.esEstadoSanoOPresente(estadoGeneral.estado) &&
      !esEstadoExclusivoDeRaiz(estadoGeneral.estado) &&
      estadoGeneral.colorHex &&
      !coloresNeutros.has(estadoGeneral.colorHex.toLowerCase())
    ) {
      return estadoGeneral.colorHex;
    }
    return '#fffdf5';
  }

  colorRaizSvg(): string {
    const pieza = this.dienteEfectivo();
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);

    if (pieza.raiz !== undefined) {
      if (!this.esEstadoSanoOPresente(pieza.raiz.estado)) {
        return resolverColorPorEstadoClinico(pieza.raiz.estado, pieza.raiz.colorHex);
      }
      return '#f5f0e5';
    }

    const estadoGeneral = pieza.estadoGeneral;
    if (
      estadoGeneral &&
      this.afectaRaiz(estadoGeneral.estado) &&
      estadoGeneral.colorHex &&
      !coloresNeutros.has(estadoGeneral.colorHex.toLowerCase())
    ) {
      return estadoGeneral.colorHex;
    }
    return '#f5f0e5';
  }

  colorBadgeCara(face: CaraDienteId): string | null {
    const pieza = this.dienteEfectivo();
    const estadoBorrador = this.borradorCaras()[face];
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);

    if (face === 'raiz') {
      if (this.esEstadoSanoOPresente(estadoBorrador)) {
        return null;
      }
      return resolverColorPorEstadoClinico(estadoBorrador, pieza.raiz?.colorHex ?? null);
    }

    const cara = pieza.caras[face];
    const tieneCambioPendiente =
      this.cambiosPendientes()?.dienteReferencia === this.diente() &&
      this.cambiosPendientes()?.cambios[face] !== undefined;

    if (tieneCambioPendiente || pieza.raiz !== undefined) {
      if (this.esEstadoSanoOPresente(estadoBorrador)) {
        return null;
      }
      return resolverColorPorEstadoClinico(estadoBorrador, null);
    }

    if (!cara || this.esEstadoSanoOPresente(cara.estado) || esEstadoExclusivoDeRaiz(cara.estado)) {
      return null;
    }
    if (cara.colorHex && !coloresNeutros.has(cara.colorHex.toLowerCase())) {
      return cara.colorHex;
    }
    return resolverColorPorEstadoClinico(cara.estado, cara.colorHex);
  }

  iniciarRotacion(event: PointerEvent): void {
    this.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      theta: this.cameraTheta,
      phi: this.cameraPhi
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  moverRotacion(event: PointerEvent): void {
    if (!this.pointerStart) return;

    this.cameraTheta = this.pointerStart.theta - (event.clientX - this.pointerStart.x) * 0.009;
    const three = this.three;
    if (!three) return;
    this.cameraPhi = three.MathUtils.clamp(
      this.pointerStart.phi + (event.clientY - this.pointerStart.y) * 0.009,
      0.15,
      Math.PI - 0.15
    );
    this.actualizarCamara();
  }

  finalizarRotacion(event: PointerEvent): void {
    if (!this.pointerStart) return;

    const moved = Math.hypot(
      event.clientX - this.pointerStart.x,
      event.clientY - this.pointerStart.y
    );
    if (moved < 5) this.seleccionarSuperficie(event);
    this.pointerStart = null;
  }

  cancelarRotacion(): void {
    this.pointerStart = null;
  }

  reiniciarVista(): void {
    this.cameraTheta = 0.45;
    this.cameraPhi = 0.95;
    this.actualizarCamara();
  }

  private obtenerEstadoInicialRaiz(pieza: DienteData): string {
    if (pieza.raiz?.estado) {
      return pieza.raiz.estado;
    }
    if (this.afectaRaiz(pieza.estadoGeneral?.estado)) {
      return pieza.estadoGeneral.estado;
    }
    return 'Sano';
  }

  private esEstadoSanoOPresente(estado: string | null | undefined): boolean {
    if (!estado) return true;
    const norm = estado.trim().toLowerCase();
    return norm === 'sano' || norm === 'presente';
  }

  private afectaRaiz(estado: string | null | undefined): boolean {
    if (!estado) return false;
    const norm = estado.trim().toLowerCase();
    return esEstadoExclusivoDeRaiz(norm) || ESTADOS_DIENTE_COMPLETO_CON_RAIZ.has(norm);
  }

  private crearDiente3d(): void {
    const three = this.three;
    if (!this.toothGroup || !this.regionLines || !three) return;

    const numero = this.dienteEfectivo().numero;
    const ultimoDigito = numero % 10;
    this.agregarParte(this.crearGeometriaCorona(three, numero), 'corona');
    this.crearLineasRegionales(three, numero);

    const rootPositions = ultimoDigito >= 6
      ? [[-0.34, 0.2], [0.34, 0.2], [0, -0.34]]
      : ultimoDigito >= 4
        ? [[-0.2, 0], [0.2, 0]]
        : [[0, 0]];

    rootPositions.forEach(([x, z], index) => {
      const rootGeometry = new three.CylinderGeometry(0.22, 0.025, 1.35, 24, 12);
      const lean = rootPositions.length === 1 ? 0.12 : (index % 2 === 0 ? -0.12 : 0.12);
      rootGeometry.applyMatrix4(new three.Matrix4().compose(
        new three.Vector3(x, -0.83, z),
        new three.Quaternion().setFromEuler(new three.Euler(0, 0, lean)),
        new three.Vector3(1, 1, 1)
      ));
      this.agregarParte(rootGeometry, 'raiz');
    });
    this.numeroModelo.set(numero);
  }

  private crearGeometriaCorona(
    three: typeof import('three'),
    numero: number
  ): THREE.BufferGeometry {
    const segmentos = 48;
    const exponent = 3.2;
    const { width, depth } = this.dimensionesCorona(numero);
    const anillos = [
      { y: -0.08, radio: 0.58 },
      { y: 0.08, radio: 0.76 },
      { y: 0.42, radio: 0.86 },
      { y: 0.72, radio: 0.84 },
      { y: 0.94, radio: 0.72 },
      { y: 1.08, radio: 0.62 }
    ];
    const positions: number[] = [];
    const indices: number[] = [];

    anillos.forEach(({ y, radio }) => {
      for (let segment = 0; segment < segmentos; segment++) {
        const angle = (segment / segmentos) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const [x, z] = this.puntoCorona(cos, sin, radio, exponent, width, depth);
        positions.push(x, y, z);
      }
    });

    for (let ring = 0; ring < anillos.length - 1; ring++) {
      for (let segment = 0; segment < segmentos; segment++) {
        const next = (segment + 1) % segmentos;
        const lower = ring * segmentos + segment;
        const lowerNext = ring * segmentos + next;
        const upper = (ring + 1) * segmentos + segment;
        const upperNext = (ring + 1) * segmentos + next;
        indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext);
      }
    }

    const topCenter = positions.length / 3;
    positions.push(0, 1.08, 0);
    const topRing = (anillos.length - 1) * segmentos;
    for (let segment = 0; segment < segmentos; segment++) {
      indices.push(topRing + segment, topCenter, topRing + ((segment + 1) % segmentos));
    }

    const geometry = new three.BufferGeometry();
    geometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private dimensionesCorona(numero: number): { width: number; depth: number } {
    const tipo = numero % 10;
    if (tipo >= 6) return { width: 0.9, depth: 0.86 };
    if (tipo >= 4) return { width: 0.76, depth: 0.72 };
    if (tipo === 3) return { width: 0.67, depth: 0.68 };
    return { width: 0.58, depth: 0.64 };
  }

  private puntoCorona(
    cos: number,
    sin: number,
    radio: number,
    exponent: number,
    width: number,
    depth: number
  ): [number, number] {
    return [
      Math.sign(cos) * Math.pow(Math.abs(cos), 2 / exponent) * radio * width,
      Math.sign(sin) * Math.pow(Math.abs(sin), 2 / exponent) * radio * depth
    ];
  }

  private crearLineasRegionales(three: typeof import('three'), numero: number): void {
    if (!this.regionLines) return;

    const { width, depth } = this.dimensionesCorona(numero);
    const profile = [
      { y: -0.08, radio: 0.58 },
      { y: 0.08, radio: 0.76 },
      { y: 0.42, radio: 0.86 },
      { y: 0.72, radio: 0.84 },
      { y: 0.94, radio: 0.72 },
      { y: 1.08, radio: 0.62 }
    ];
    const lineMaterial = new three.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const points: THREE.Vector3[] = [];
      profile.forEach(({ y, radio }) => {
        const [x, z] = this.puntoCorona(
          Math.cos(angle),
          Math.sin(angle),
          radio + 0.008,
          3.2,
          width,
          depth
        );
        points.push(new three.Vector3(x, y, z));
      });
      this.agregarLineaRegional(three, points, lineMaterial);
    }

    const topPoints = Array.from({ length: 49 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      const [x, z] = this.puntoCorona(
        Math.cos(angle),
        Math.sin(angle),
        0.62 + 0.009,
        3.2,
        width,
        depth
      );
      return new three.Vector3(x, 1.08, z);
    });
    this.agregarLineaRegional(three, topPoints, lineMaterial);
  }

  private agregarLineaRegional(
    three: typeof import('three'),
    points: THREE.Vector3[],
    material: THREE.LineBasicMaterial
  ): void {
    if (!this.regionLines) return;

    const geometry = new three.BufferGeometry().setFromPoints(points);
    this.geometries.push(geometry);
    this.regionLines.add(new three.Line(geometry, material));
    if (!this.materiales.includes(material)) this.materiales.push(material);
  }

  private limpiarModelo(): void {
    if (!this.three || !this.toothGroup || !this.regionLines) return;

    for (const group of [this.toothGroup, this.regionLines]) {
      group.clear();
    }
    this.geometries.forEach((geometry) => geometry.dispose());
    this.geometries.length = 0;
    this.materiales.forEach((material) => material.dispose());
    this.materiales.length = 0;
    this.numeroModelo.set(null);
  }

  private agregarParte(geometry: THREE.BufferGeometry, tipoParte: TipoParte3d): void {
    const three = this.three;
    if (!this.toothGroup || !three) return;

    this.geometries.push(geometry);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);

    for (let index = 0; index < position.count; index++) {
      const color = tipoParte === 'raiz'
        ? this.colorRaiz3d(three)
        : this.colorSuperficie(
            this.superficieEn(new three.Vector3().fromBufferAttribute(position, index)),
            three
          );
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new three.BufferAttribute(colors, 3));
    const material = new three.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.46,
      metalness: 0
    });
    this.materiales.push(material);
    const mesh = new three.Mesh(geometry, material);
    mesh.userData = { tipoParte };
    this.toothGroup.add(mesh);
  }

  private seleccionarSuperficie(event: PointerEvent): void {
    const three = this.three;
    if (!this.renderer || !this.camera || !this.toothGroup || !three) return;

    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new three.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    const raycaster = new three.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const [hit] = raycaster.intersectObjects(this.toothGroup.children, false);
    if (!hit) return;

    if (hit.object.userData?.['tipoParte'] === 'raiz') {
      this.seleccionarCara('raiz');
      return;
    }

    const localPoint = this.toothGroup.worldToLocal(hit.point.clone());
    this.seleccionarCara(this.superficieEn(localPoint));
  }

  private superficieEn(point: THREE.Vector3): keyof CarasDiente {
    if (point.y > 0.82) return 'oclusal_incisal';
    if (Math.abs(point.z) >= Math.abs(point.x)) {
      return point.z >= 0 ? 'vestibular' : 'palatino_lingual';
    }
    return point.x >= 0 ? 'distal' : 'mesial';
  }

  private colorSuperficie(face: keyof CarasDiente, three: typeof import('three')): THREE.Color {
    const pieza = this.dienteEfectivo();
    const cara = pieza.caras[face];
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);

    let hexElegido = '#e9ddc6';

    if (pieza.raiz !== undefined) {
      if (cara && !this.esEstadoSanoOPresente(cara.estado)) {
        hexElegido = resolverColorPorEstadoClinico(cara.estado, cara.colorHex);
      }
    } else {
      const esSana =
        this.esEstadoSanoOPresente(cara?.estado) || esEstadoExclusivoDeRaiz(cara?.estado);
      const clinicalColor = cara?.colorHex?.toLowerCase();

      if (!esSana && clinicalColor && !coloresNeutros.has(clinicalColor)) {
        hexElegido = clinicalColor;
      } else if (esSana) {
        const estadoGeneral = pieza.estadoGeneral;
        if (
          estadoGeneral &&
          !this.esEstadoSanoOPresente(estadoGeneral.estado) &&
          !esEstadoExclusivoDeRaiz(estadoGeneral.estado) &&
          estadoGeneral.colorHex &&
          !coloresNeutros.has(estadoGeneral.colorHex.toLowerCase())
        ) {
          hexElegido = estadoGeneral.colorHex;
        }
      }
    }

    const color = new three.Color(hexElegido);
    if (this.caraActivaId() === face) {
      color.lerp(new three.Color('#55a978'), 0.4);
    }
    return color;
  }

  private colorRaiz3d(three: typeof import('three')): THREE.Color {
    const pieza = this.dienteEfectivo();
    const coloresNeutros = new Set(['#fff', '#ffffff', '#fffdf5', '#fffefa', '#fffef9']);

    let hexRaiz = '#e2d5bc';

    if (pieza.raiz !== undefined) {
      if (!this.esEstadoSanoOPresente(pieza.raiz.estado)) {
        hexRaiz = resolverColorPorEstadoClinico(pieza.raiz.estado, pieza.raiz.colorHex);
      }
    } else {
      const estadoGeneral = pieza.estadoGeneral;
      if (
        estadoGeneral &&
        this.afectaRaiz(estadoGeneral.estado) &&
        estadoGeneral.colorHex &&
        !coloresNeutros.has(estadoGeneral.colorHex.toLowerCase())
      ) {
        hexRaiz = estadoGeneral.colorHex;
      }
    }

    const color = new three.Color(hexRaiz);
    if (this.caraActivaId() === 'raiz') {
      color.lerp(new three.Color('#55a978'), 0.4);
    }
    return color;
  }

  private actualizarColores(): void {
    const three = this.three;
    if (!this.toothGroup || !three) return;

    this.toothGroup.children.forEach((child) => {
      if (!(child instanceof three.Mesh)) return;
      const tipoParte: TipoParte3d = child.userData?.['tipoParte'] === 'raiz' ? 'raiz' : 'corona';
      const position = child.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colors = child.geometry.getAttribute('color') as THREE.BufferAttribute;

      if (tipoParte === 'raiz') {
        const rootColor = this.colorRaiz3d(three);
        for (let index = 0; index < position.count; index++) {
          colors.setXYZ(index, rootColor.r, rootColor.g, rootColor.b);
        }
      } else {
        for (let index = 0; index < position.count; index++) {
          const color = this.colorSuperficie(
            this.superficieEn(new three.Vector3().fromBufferAttribute(position, index)),
            three
          );
          colors.setXYZ(index, color.r, color.g, color.b);
        }
      }
      colors.needsUpdate = true;
    });
    this.renderizar();
  }

  private actualizarCamara(): void {
    const three = this.three;
    if (!this.camera || !this.cameraTarget || !three) return;

    this.camera.position.setFromSphericalCoords(
      this.cameraRadius,
      this.cameraPhi,
      this.cameraTheta
    ).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.renderizar();
  }

  private redimensionar(): void {
    const host = this.visor3d?.nativeElement;
    if (!host || !this.renderer || !this.camera) return;

    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderizar();
  }

  private renderizar(): void {
    if (this.scene && this.camera && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
