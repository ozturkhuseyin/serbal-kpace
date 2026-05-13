import * as THREE from 'three';
import { Vec3 } from '../physics/Vector3';

export type CameraMode = 'chase' | 'orbital' | 'free' | 'cockpit';

/**
 * Owns the Three.js renderer, scene and the floating-origin camera rig.
 *
 * The simulation uses real-world scale (millions of metres). To keep WebGL
 * precision usable we offset every renderable by `focusPosition` so the active
 * vessel sits near the world origin, and we use a logarithmic depth buffer.
 */
export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Map view uses an orthographic camera looking down the z axis. */
  mapCamera: THREE.PerspectiveCamera;
  /** Sun light pointing toward the player. Positioned each frame from the star. */
  sunLight: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  /** Active vessel world-space position. All world coords are rendered relative to this. */
  focusPosition: Vec3 = new Vec3();
  /** Distance from the camera to the focus point in chase/orbital mode. */
  cameraDistance = 30;
  /** Camera spherical orbit angles. */
  cameraTheta = 0;
  cameraPhi = Math.PI / 4;
  cameraMode: CameraMode = 'chase';
  /** True while the user is in map view. */
  mapMode = false;
  /** Map view zoom (units of focus distance). */
  mapZoom = 1e7;
  mapTheta = 0;
  mapPhi = Math.PI / 3;
  mapTarget = new Vec3();

  private container: HTMLElement;
  private clock = new THREE.Clock();
  private mouseDragging = false;
  private mouseLast = { x: 0, y: 0 };
  private mouseListeners: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000004, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e12);
    this.camera.position.set(0, 8, 30);
    this.camera.lookAt(0, 0, 0);

    this.mapCamera = new THREE.PerspectiveCamera(45, 1, 1, 1e13);
    this.mapCamera.position.set(0, 0, 1e7);

    this.sunLight = new THREE.DirectionalLight(0xfff5e1, 1.6);
    this.sunLight.position.set(1, 0.6, 0.3);
    this.scene.add(this.sunLight);

    this.ambient = new THREE.AmbientLight(0x223344, 0.3);
    this.scene.add(this.ambient);

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
    this.installMouseControls();
  }

  /**
   * Wire up mouse drag (left or right) to orbit the camera and the scroll
   * wheel to zoom. Works in both flight and map view; in map view it pans
   * with the middle button.
   */
  private installMouseControls(): void {
    const dom = this.renderer.domElement;
    const onDown = (e: MouseEvent) => {
      this.mouseDragging = true;
      this.mouseLast = { x: e.clientX, y: e.clientY };
      dom.style.cursor = 'grabbing';
    };
    const onMove = (e: MouseEvent) => {
      if (!this.mouseDragging) return;
      const dx = (e.clientX - this.mouseLast.x) * 0.005;
      const dy = (e.clientY - this.mouseLast.y) * 0.005;
      this.mouseLast = { x: e.clientX, y: e.clientY };
      if (e.shiftKey && this.mapMode) {
        this.panMap(-dx * 60, dy * 60);
      } else {
        this.rotateCamera(-dx, -dy);
      }
    };
    const onUp = () => {
      this.mouseDragging = false;
      dom.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoomCamera(e.deltaY);
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContext);
    dom.style.cursor = 'grab';
    this.mouseListeners.push(
      () => dom.removeEventListener('mousedown', onDown),
      () => window.removeEventListener('mousemove', onMove),
      () => window.removeEventListener('mouseup', onUp),
      () => dom.removeEventListener('wheel', onWheel),
      () => dom.removeEventListener('contextmenu', onContext),
    );
  }

  handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.mapCamera.aspect = w / h;
    this.mapCamera.updateProjectionMatrix();
  }

  /** Move the floating origin to the active vessel position. */
  setFocus(world: Vec3): void {
    this.focusPosition = world.clone();
  }

  /** Translate a world-space point into render space (relative to focus). */
  toRender(world: Vec3): THREE.Vector3 {
    return new THREE.Vector3(world.x - this.focusPosition.x, world.y - this.focusPosition.y, world.z - this.focusPosition.z);
  }

  /**
   * Update camera transform.
   * @param targetWorld  World-space point the camera should look at.
   * @param localUpWorld Optional local "up" direction (radial out from parent body).
   *                     When provided, the camera orbits in this local frame, so the
   *                     planet always appears below the rocket.
   * @param vesselForward Body forward direction for cockpit view.
   */
  updateCamera(targetWorld: Vec3, localUpWorld?: Vec3, vesselForward?: Vec3): void {
    if (this.mapMode) {
      const target = this.toRender(this.mapTarget);
      const r = this.mapZoom;
      this.mapCamera.position.set(
        target.x + r * Math.sin(this.mapPhi) * Math.cos(this.mapTheta),
        target.y + r * Math.cos(this.mapPhi),
        target.z + r * Math.sin(this.mapPhi) * Math.sin(this.mapTheta),
      );
      this.mapCamera.up.set(0, 1, 0);
      this.mapCamera.lookAt(target);
      return;
    }
    const target = this.toRender(targetWorld);
    if (this.cameraMode === 'cockpit' && vesselForward) {
      const offset = new THREE.Vector3(vesselForward.x, vesselForward.y, vesselForward.z).multiplyScalar(2);
      this.camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
      if (localUpWorld) this.camera.up.set(localUpWorld.x, localUpWorld.y, localUpWorld.z);
      this.camera.lookAt(target.x + offset.x * 10, target.y + offset.y * 10, target.z + offset.z * 10);
      return;
    }
    const r = this.cameraDistance;
    if (localUpWorld) {
      // Build orthonormal local frame around the vessel.
      const up = localUpWorld.normalize();
      let east = up.cross(new Vec3(0, 0, 1));
      if (east.lengthSq() < 1e-6) east = up.cross(new Vec3(1, 0, 0));
      east = east.normalize();
      const north = east.cross(up).normalize();
      const sinPhi = Math.sin(this.cameraPhi);
      const cosPhi = Math.cos(this.cameraPhi);
      const sinT = Math.sin(this.cameraTheta);
      const cosT = Math.cos(this.cameraTheta);
      const offsetX = east.x * sinPhi * cosT + up.x * cosPhi + north.x * sinPhi * sinT;
      const offsetY = east.y * sinPhi * cosT + up.y * cosPhi + north.y * sinPhi * sinT;
      const offsetZ = east.z * sinPhi * cosT + up.z * cosPhi + north.z * sinPhi * sinT;
      this.camera.position.set(target.x + offsetX * r, target.y + offsetY * r, target.z + offsetZ * r);
      this.camera.up.set(up.x, up.y, up.z);
    } else {
      this.camera.position.set(
        target.x + r * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta),
        target.y + r * Math.cos(this.cameraPhi),
        target.z + r * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta),
      );
      this.camera.up.set(0, 1, 0);
    }
    this.camera.lookAt(target);
  }

  cycleCameraMode(): void {
    const order: CameraMode[] = ['chase', 'orbital', 'free', 'cockpit'];
    const i = order.indexOf(this.cameraMode);
    this.cameraMode = order[(i + 1) % order.length];
  }

  zoomCamera(delta: number): void {
    const factor = delta > 0 ? 1.1 : 0.9;
    if (this.mapMode) {
      this.mapZoom = THREE.MathUtils.clamp(this.mapZoom * factor, 1e4, 1e12);
    } else {
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance * factor, 4, 4000);
    }
  }

  rotateCamera(dx: number, dy: number): void {
    if (this.mapMode) {
      this.mapTheta += dx;
      this.mapPhi = THREE.MathUtils.clamp(this.mapPhi + dy, 0.05, Math.PI - 0.05);
    } else {
      this.cameraTheta += dx;
      this.cameraPhi = THREE.MathUtils.clamp(this.cameraPhi + dy, 0.05, Math.PI - 0.05);
    }
  }

  panMap(dx: number, dy: number): void {
    const right = new Vec3(Math.cos(this.mapTheta + Math.PI / 2), 0, Math.sin(this.mapTheta + Math.PI / 2));
    const up = new Vec3(0, 1, 0);
    const move = right.mul(dx * this.mapZoom * 0.001).add(up.mul(dy * this.mapZoom * 0.001));
    this.mapTarget = this.mapTarget.add(move);
  }

  setMapMode(on: boolean): void {
    this.mapMode = on;
    if (on) this.mapTarget = this.focusPosition.clone();
  }

  /** Position the sun based on the star's world position. */
  setSunFromWorld(starWorld: Vec3, vesselWorld: Vec3): void {
    const dir = starWorld.sub(vesselWorld).normalize();
    this.sunLight.position.set(dir.x, dir.y, dir.z).multiplyScalar(1e8);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();
  }

  render(): void {
    const cam = this.mapMode ? this.mapCamera : this.camera;
    this.renderer.render(this.scene, cam);
  }

  delta(): number { return Math.min(this.clock.getDelta(), 0.1); }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    for (const off of this.mouseListeners) off();
    this.mouseListeners = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
