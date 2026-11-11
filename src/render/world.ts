import * as THREE from 'three';
import { tilePosition, transformed } from '../engine/graph';
import { project } from '../engine/projection';
import type { Level, States, Vec3 } from '../engine/types';

const v3 = (v: Vec3) => new THREE.Vector3(...v);
const ease = (t: number) => t * t * (3 - 2 * t);
type Pick = { tile?: string; mechanism?: string };

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  private root = new THREE.Group();
  private character = new THREE.Group();
  private halo = new THREE.Group();
  private groups = new Map<string, THREE.Group>();
  private tiles = new Map<string, THREE.Mesh>();
  private handles = new Map<string, THREE.Object3D>();
  private targets: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private level!: Level;
  private states!: States;
  private mode: 'title' | 'game' | 'select' | 'complete' = 'title';
  private bounds = { x: 0, y: 0, width: 10, height: 10 };
  private motes: THREE.Points | null = null;
  private frame = 0;
  private sparkle = 0;
  private flashUntil = new Map<string, number>();
  onPick: (pick: Pick, event: PointerEvent) => void = () => {};
  onDrag: (id: string, pixels: number, end: boolean) => void = () => {};
  private down: { x: number; y: number; id: number; pick: Pick; dragging: boolean } | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0, 0);
    this.scene.add(new THREE.AmbientLight('#fff6e8', 2.1));
    const light = new THREE.DirectionalLight('#fff9ef', 2.6);
    light.position.set(-3, 9, 6); this.scene.add(light);
    this.scene.add(this.root);
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => {
      const pick = this.pick(e.clientX, e.clientY);
      this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, pick, dragging: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (this.down?.pick.mechanism &&
        (this.down.dragging || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8)) {
        this.down.dragging = true;
        this.onDrag(this.down.pick.mechanism, e.clientX - this.down.x, false);
      }
      const p = this.pick(e.clientX, e.clientY);
      canvas.style.cursor = p.mechanism ? 'grab' : p.tile ? 'pointer' : 'default';
    });
    canvas.addEventListener('pointerup', e => {
      const d = this.down;
      this.down = null;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, distance = Math.hypot(dx, e.clientY - d.y);
      if (d.pick.mechanism && d.dragging) this.onDrag(d.pick.mechanism, dx, true);
      else if (distance < 12) this.onPick(d.pick, e);
    });
    canvas.addEventListener('pointercancel', () => {
      if (this.down?.pick.mechanism) this.onDrag(this.down.pick.mechanism, 0, true);
      this.down = null;
    });
    this.loop();
  }

  private material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
  }
  private mesh(geometry: THREE.BufferGeometry, color: string, parent: THREE.Object3D, at: Vec3 = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(...at); parent.add(mesh); return mesh;
  }
  private box(size: Vec3, at: Vec3, color: string, parent: THREE.Object3D = this.root) {
    return this.mesh(new THREE.BoxGeometry(...size), color, parent, at);
  }
  private cylinder(top: number, bottom: number, height: number, at: Vec3, color: string, parent = this.root, segments = 32) {
    return this.mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, parent, at);
  }
  private arch(at: Vec3, scale: number, color: string, parent = this.root) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.67, 0); shape.lineTo(-0.67, 1.13);
    shape.absarc(0, 1.13, 0.67, Math.PI, 0, true);
    shape.lineTo(0.67, 0); shape.lineTo(0.40, 0);
    shape.lineTo(0.40, 1.13);
    shape.absarc(0, 1.13, 0.40, 0, Math.PI, false);
    shape.lineTo(-0.40, 0); shape.lineTo(-0.67, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .28, bevelEnabled: false, curveSegments: 24 });
    geometry.translate(0, 0, -.14);
    const mesh = this.mesh(geometry, color, parent, at);
    mesh.scale.setScalar(scale);
    return mesh;
  }
  private tree(at: Vec3, scale = 1) {
    const g = new THREE.Group(); g.position.set(...at); g.scale.setScalar(scale); this.root.add(g);
    this.cylinder(.055, .09, .7, [0, .35, 0], '#927a61', g, 6);
    this.mesh(new THREE.IcosahedronGeometry(.45, 1), '#638477', g, [0, .93, 0]).scale.set(.7, 1.3, .7);
    this.mesh(new THREE.IcosahedronGeometry(.32, 0), '#8aa18a', g, [.21, .72, .02]);
  }
  private disposeRoot() {
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => m.dispose());
      }
    });
    this.scene.remove(this.root);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.groups.clear(); this.tiles.clear(); this.handles.clear(); this.targets = [];
    this.flashUntil.clear(); this.motes = null; this.sparkle = 0;
  }

  load(level: Level, states: States, mode: typeof this.mode) {
    this.disposeRoot(); this.level = level; this.states = { ...states }; this.mode = mode;
    const p = level.palette;
    document.documentElement.style.setProperty('--sky-top', p.background[0]);
    document.documentElement.style.setProperty('--sky-bottom', p.background[1]);
    document.documentElement.style.setProperty('--accent', p.dark);
    for (const m of level.mechanisms) {
      const group = new THREE.Group(); this.root.add(group); this.groups.set(m.id, group);
      if (m.type === 'rotate') {
        const [x, y, z] = m.pivot;
        if (level.id === 3) {
          // The lower return path projects beneath this pivot. A compact
          // suspension keeps that path and its illusion seam unobstructed.
          this.cylinder(.23, .28, .2, [x, y - .52, z], p.dark);
        } else {
          this.cylinder(.36, .44, 2.65, [x, y - 1.9, z], p.dark);
          this.cylinder(.61, .61, .16, [x, y - 3.25, z], p.accent);
          for (let i = 0; i < 3; i++) this.cylinder(.39, .39, .08, [x, y - .65 - i * .65, z], p.accent);
        }
        this.cylinder(.52, .52, .18, [0, -.36, 0], p.accent, group);
        if (m.id === 'spire') this.box([1.5, .22, .32], [-.5, -.2, 0], p.dark, group);
        const handle = new THREE.Group(); handle.position.set(0, -.95, .65); group.add(handle);
        const torus = this.mesh(new THREE.TorusGeometry(.3, .055, 8, 40), p.accent, handle);
        torus.rotation.x = -.2;
        this.box([.5, .065, .07], [0, 0, 0], p.accent, handle);
        this.box([.065, .5, .07], [0, 0, 0], p.accent, handle);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(.48, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
        handle.add(hit); hit.userData = { mechanism: m.id };
        this.targets.push(hit); this.handles.set(m.id, handle);
      } else {
        for (const tile of level.tiles.filter(t => t.mechanism === m.id)) {
          const [x, y, z] = tile.at;
          this.box([4, .045, .045], [x + 1.5, y - .43, z + .42], p.accent);
          this.box([4, .045, .045], [x + 1.5, y - .43, z - .42], p.accent);
          const grip = this.cylinder(.13, .13, .09, [x, y + .08, z + .35], p.accent, group);
          grip.userData = { mechanism: m.id }; this.targets.push(grip);
          this.handles.set(`${m.id}-${tile.id}`, grip);
        }
      }
    }
    for (const tile of level.tiles) {
      const parent = tile.mechanism ? this.groups.get(tile.mechanism)! : this.root;
      const [x, y, z] = tile.at;
      const color = tile.mechanism ? p.dark : p.top;
      const cube = this.box([1, .46, 1], [x, y - .23, z], color, parent);
      cube.userData = { tile: tile.id }; this.targets.push(cube); this.tiles.set(tile.id, cube);
      const cap = this.box([.96, .035, .96], [x, y + .009, z], tile.mechanism ? '#d9c39a' : p.top, parent);
      cap.userData = { tile: tile.id }; this.targets.push(cap);
      // Inlaid diamonds mark walkable tops without imposing a grid on the architecture.
      const diamond = this.box([.115, .009, .115], [x, y + .031, z], p.accent, parent);
      diamond.rotation.y = Math.PI / 4;
      if (tile.support) {
        this.box([.91, tile.support, .91], [x, y - tile.support / 2 - .46, z], p.side);
        this.box([1.10, .15, 1.10], [x, y - tile.support - .45, z], p.top);
        // Recessed facade niches, visible on the forward face.
        const niche = this.arch([x, y - 1.75, z + .46], .52, p.top);
        this.box([.37, .6, .018], [x, y - 1.38, z + .467], p.dark);
        niche.position.z += .025;
      }
    }
    // Gate: a freestanding original pavilion and a softly luminous threshold.
    const goal = tilePosition(level.tiles.find(t => t.id === level.goal)!, level, states);
    const gate = new THREE.Group(); gate.position.copy(v3(goal)); gate.rotation.y = Math.PI / 4; this.root.add(gate);
    this.arch([0, .025, 0], .9, p.dark, gate);
    this.box([1.35, .13, .65], [0, 1.64, 0], p.dark, gate);
    const roof = this.mesh(new THREE.ConeGeometry(.97, .6, 4), p.dark, gate, [0, 2, 0]);
    roof.rotation.y = Math.PI / 4; roof.scale.z = .68;
    this.mesh(new THREE.SphereGeometry(.055, 12, 8), p.accent, gate, [0, 2.37, 0]);
    this.halo = new THREE.Group(); gate.add(this.halo);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(.54, 1.22), new THREE.MeshBasicMaterial({
      color: '#fff7d2', transparent: true, opacity: .34, side: THREE.DoubleSide, depthWrite: false,
    }));
    glow.position.set(0, .68, -.035); this.halo.add(glow);
    for (let i = 0; i < 3; i++) {
      const line = this.mesh(new THREE.TorusGeometry(.26 + i * .065, .012, 6, 32), p.accent, this.halo, [0, .04, .12]);
      line.rotation.x = -Math.PI / 2;
    }
    this.createCharacter();
    this.sync(states);
    this.placeCharacter(tilePosition(level.tiles.find(t => t.id === level.start)!, level, states));
    this.decorate(level);
    const projected: [number, number][] = [];
    const measure = () => {
      this.root.updateMatrixWorld(true);
      this.root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry.type === 'RingGeometry' || object.geometry.type === 'OctahedronGeometry') return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox!;
        // All eight corners are needed: opposite 3D corners alone can collapse
        // onto the same screen coordinate in an isometric projection.
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const point = object.localToWorld(new THREE.Vector3(x, y, z));
          projected.push(project([point.x, point.y, point.z]));
        }
      });
    };
    measure();
    for (const mechanism of level.mechanisms) for (let state = 0; state < mechanism.states; state++) {
      this.sync({ ...states, [mechanism.id]: state }); measure();
    }
    this.sync(states);
    const xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    this.bounds = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
    this.resize();
  }

  private decorate(level: Level) {
    const p = level.palette;
    // Detached garden ledges add a sense of scale, without masquerading as paths.
    if (level.id === 1) {
      this.box([1.5, .25, 1.6], [-2.6, -2.1, -1.25], p.top);
      this.box([1.35, 1.4, 1.4], [-2.6, -2.9, -1.25], p.side);
      this.tree([-2.8, -1.97, -1.45], 1.25);
      this.tree([-2.3, -1.97, -1.05], .65);
      this.box([1.55, .22, 1.6], [3.3, -1.45, -1.2], p.top);
      this.tree([3.4, -1.34, -1.4], 1.2);
      for (let i = 0; i < 5; i++) this.box([.85, .12, .25], [-3, -2.1 - i * .15, .62 + i * .24], p.top);
    } else if (level.id === 2) {
      this.tree([-1.3, -1.3, 2.65], .85);
      this.box([1.2, .18, 1], [-1.3, -1.4, 2.65], p.top);
      this.tree([5, -.7, 2.65], .85);
      this.box([1.2, .18, 1], [5, -.8, 2.65], p.top);
    }
    // Thin atmospheric ellipses and floating fragments beneath the monument.
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.6 + i * .75, 2.61 + i * .75, 100),
        new THREE.MeshBasicMaterial({ color: p.dark, transparent: true, opacity: .085, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(.3, -4.2 - i * .035, 0); this.root.add(ring);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39;
      const rock = this.mesh(new THREE.OctahedronGeometry(.13 + (i % 3) * .065), i % 2 ? p.side : p.top,
        this.root, [Math.cos(a) * 3.5, -3.6 - (i % 2) * .5, Math.sin(a) * 2.1]);
      rock.rotation.set(a, a * .4, 0);
    }
    const particles = new Float32Array(45 * 3);
    let seed = 94;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < particles.length; i += 3) {
      particles[i] = (rand() - .5) * 12;
      particles[i + 1] = rand() * 6 - 3;
      particles[i + 2] = (rand() - .5) * 7;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    this.motes = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fffdf0', size: .045, transparent: true, opacity: .7, depthWrite: false }));
    this.root.add(this.motes);
  }

  private createCharacter() {
    this.character = new THREE.Group(); this.root.add(this.character);
    const add = (geometry: THREE.BufferGeometry, color: string, y: number) => {
      const mesh = this.mesh(geometry, color, this.character, [0, y, 0]);
      (mesh.material as THREE.MeshStandardMaterial).depthTest = false; mesh.renderOrder = 20;
      return mesh;
    };
    add(new THREE.ConeGeometry(.16, .36, 16), '#fbf5e5', .24);
    add(new THREE.SphereGeometry(.105, 16, 12), '#e6c0a0', .49);
    add(new THREE.ConeGeometry(.16, .3, 16), '#fbf5e5', .7);
    const scarf = add(new THREE.TorusGeometry(.085, .025, 6, 16), '#bd795e', .40);
    scarf.rotation.x = Math.PI / 2;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.2, 24), new THREE.MeshBasicMaterial({
      color: '#304944', transparent: true, opacity: .18, depthWrite: false,
    }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .039; this.character.add(shadow);
  }
  setMode(mode: typeof this.mode) { this.mode = mode; this.resize(); }
  sync(states: States) {
    this.states = { ...states };
    for (const m of this.level.mechanisms) {
      const g = this.groups.get(m.id)!;
      if (m.type === 'rotate') {
        g.position.set(...m.pivot); g.rotation.y = states[m.id] * Math.PI / 2;
      } else {
        g.position.copy(v3(m.pivot)).addScaledVector(v3(m.axis!), m.stops![states[m.id]]);
      }
    }
    this.root.updateMatrixWorld(true);
  }
  placeCharacter(at: Vec3, bob = 0) { this.character.position.set(at[0], at[1] + .04 + bob, at[2]); }
  async animateMechanism(id: string, from: number, to: number, rider?: string) {
    const m = this.level.mechanisms.find(m => m.id === id)!;
    const group = this.groups.get(id)!;
    const tile = this.level.tiles.find(t => t.id === rider && t.mechanism === id);
    await this.animate(650, t => {
      const e = ease(t);
      if (m.type === 'rotate') group.rotation.y = (from + e) * Math.PI / 2;
      else group.position.copy(v3(m.pivot)).addScaledVector(v3(m.axis!), m.stops![from] + (m.stops![to] - m.stops![from]) * e);
      if (tile) {
        group.updateMatrixWorld(true);
        const pos = group.localToWorld(v3(tile.at));
        this.placeCharacter([pos.x, pos.y, pos.z]);
      }
    });
  }
  previewSlide(id: string, value: number, rider: string) {
    const m = this.level.mechanisms.find(m => m.id === id)!;
    const group = this.groups.get(id)!;
    group.position.copy(v3(m.pivot)).addScaledVector(v3(m.axis!), value);
    const tile = this.level.tiles.find(t => t.id === rider && t.mechanism === id);
    if (tile) {
      group.updateMatrixWorld(true);
      const pos = group.localToWorld(v3(tile.at));
      this.placeCharacter([pos.x, pos.y, pos.z]);
    }
  }
  async settleSlide(id: string, fromDistance: number, to: number, rider: string) {
    const m = this.level.mechanisms.find(m => m.id === id)!;
    await this.animate(300, t => this.previewSlide(id, fromDistance + (m.stops![to] - fromDistance) * ease(t), rider));
  }
  animate(duration: number, update: (t: number) => void): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration); update(t);
        if (t < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
  async celebrate() {
    await this.animate(1100, t => {
      this.sparkle = Math.sin(t * Math.PI);
      this.character.scale.setScalar(1 - Math.max(0, t - .45) * 1.7);
      this.halo.scale.setScalar(1 + Math.sin(t * Math.PI) * .22);
    });
  }
  flash(id: string) { this.flashUntil.set(id, performance.now() + 550); }
  private pick(x: number, y: number): Pick {
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.camera);
    const hits = this.ray.intersectObjects(this.targets, false);
    const first = hits.find(h => h.object.userData.mechanism || (h.face?.normal.y ?? 0) > .9);
    return first?.object.userData ?? {};
  }
  screenTile(id: string) {
    const tile = this.level.tiles.find(t => t.id === id)!;
    return this.screenPoint(tilePosition(tile, this.level, this.states).map((v, i) => v + (i === 1 ? .04 : 0)) as Vec3);
  }
  screenMechanism(id: string) {
    const target = this.handles.get(id) ?? this.handles.get(`${id}-ferry`)!;
    const p = target.getWorldPosition(new THREE.Vector3());
    return this.screenPoint([p.x, p.y, p.z]);
  }
  screenPoint(at: Vec3) {
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    const p = v3(at).project(this.camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  }
  slidePixelLength(id: string) {
    const m = this.level.mechanisms.find(m => m.id === id)!;
    const a = this.screenPoint(transformed([0, 0, 0], m, 0));
    const b = this.screenPoint(transformed([0, 0, 0], m, m.states - 1));
    return b.x - a.x;
  }
  resize() {
    const width = innerWidth, height = innerHeight, aspect = width / height;
    this.renderer.setSize(width, height);
    const mobile = width < 760;
    const { x, y, width: bw, height: bh } = this.bounds;
    const availableWidth = mobile ? .87 : this.mode === 'title' ? .53 : .67;
    const availableHeight = mobile ? .49 : .72;
    const viewHeight = Math.max(bh / availableHeight, bw / (aspect * availableWidth));
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2; this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2; this.camera.bottom = -viewHeight / 2;
    const offsetX = mobile ? 0 : this.mode === 'title' ? .18 : .075;
    const offsetY = mobile ? -.08 : -.005;
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const up = new THREE.Vector3(-1, 2, -1).normalize();
    const target = right.multiplyScalar(x - offsetX * viewWidth).add(up.multiplyScalar(y - offsetY * viewHeight));
    this.camera.position.copy(target).add(new THREE.Vector3(30, 30, 30));
    this.camera.lookAt(target); this.camera.updateProjectionMatrix();
  }
  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const time = performance.now();
    if (this.motes) {
      this.motes.rotation.y = Math.sin(time / 15000) * .1;
      this.motes.position.y = Math.sin(time / 3500) * .16 + this.sparkle * .5;
    }
    for (const [id, until] of this.flashUntil) {
      const mesh = this.tiles.get(id)!;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(time < until ? 0xc77a48 : 0);
      material.emissiveIntensity = .3 + .3 * Math.sin(time / 50);
      if (time >= until) this.flashUntil.delete(id);
    }
    this.renderer.render(this.scene, this.camera);
  };
}
