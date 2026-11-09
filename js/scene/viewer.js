// SPDX-License-Identifier: Apache-2.0
//
// The 3D view of the installation: renderer, camera and controls; lights that travel with the
// camera, so the subject is lit as on a dark stage; framing a subject into the stage's free area
// (U4) and flying there (V2); picking (V1); the live scope face, the lamps, the cables' traffic
// and the Tube's beam, all read from the machine (D1). It renders only while it is shown (V8).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { beamAt } from "../view/beam.js";
import { token } from "../view/theme.js";
import { buildTerminal } from "./terminal3d.js";

/** @typedef {import("./terminal3d.js").TerminalParams} TerminalParams */
/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

/** A subject fills this much of whichever side of the free area runs out first (U4). */
export const FILL = 0.9;
/** A flight's length, ms (V2). */
const FLIGHT_MS = 900;
/** A pointer that moves farther than this between down and up is a drag, not a click (V1). */
const CLICK_PX = 5;
/**
 * The directions a close look tries, in order, from the part towards the camera (three.js: +Z
 * is the operator's side of the room, where every part's front faces): from the front and a
 * little above, then turned left and right, then higher, then from the sides. The first from
 * which nothing hides the part is used, so a part is always seen from the same place (V1a).
 */
const LOOK_DIRECTIONS = {
  front: [
    [0, 0.35, 1], [-0.45, 0.35, 1], [0.45, 0.35, 1],
    [0, 0.8, 1], [-0.6, 0.8, 1], [0.6, 0.8, 1],
    [-1, 0.5, 0.4], [1, 0.5, 0.4], [0, 1.6, 1],
  ],
  // a part whose controls are on its top (the dial box, the function switches): from above,
  // a little in front, so the controls face the reader the way the operator saw them
  top: [
    [0, 2, 1], [-0.5, 2, 1], [0.5, 2, 1],
    [0, 1.2, 1], [-0.6, 1.2, 1], [0.6, 1.2, 1],
    [0, 0.6, 1], [-1, 1.2, 0.4], [1, 1.2, 0.4],
  ],
};
/**
 * Points of the part a close look must see, as fractions of its box from the centre: the
 * corners of the face its controls are on (the front, +Z, the operator's side; or the top), 5 %
 * in, and the face's middle.
 */
const LOOK_SAMPLES = {
  front: [[0, 0, 0.45], [-0.45, -0.45, 0.45], [0.45, -0.45, 0.45], [-0.45, 0.45, 0.45], [0.45, 0.45, 0.45], [0, 0.45, 0]],
  top: [[0, 0.45, 0], [-0.45, 0.45, -0.45], [0.45, 0.45, -0.45], [-0.45, 0.45, 0.45], [0.45, 0.45, 0.45], [0, 0, 0.45]],
};

/** How bright the machines stay under Connections, so the cables stand out. */
const DIM = 0.22;

/** A dial's travel each side of its centre, degrees: a potentiometer's 300 degrees in all. */
export const DIAL_TRAVEL_DEG = 150;

/**
 * The free area of the stage: what the band, the strip and an open card leave, in CSS pixels
 * from the stage's top left.
 * @typedef {{ left: number; top: number; width: number; height: number }} Rect
 */

/**
 * Where the camera looks from and at.
 * @typedef {{ pos: THREE.Vector3; target: THREE.Vector3 }} Pose
 */

export class TerminalView {
  /**
   * @param {HTMLElement} host
   * @param {TerminalParams} params
   * @param {HTMLCanvasElement} faceCanvas the canvas the CRT is painted on
   */
  constructor(host, params, faceCanvas) {
    this.host = host;
    this.built = buildTerminal(params, palette());
    this.scene = new THREE.Scene();
    this.scene.add(this.built.root);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    host.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.02, 60);
    this.camera.position.set(2.4, 2.8, 6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.8, -0.6);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 16;
    this.controls.minDistance = 0.15;
    this.scene.add(new THREE.HemisphereLight(0xdde6f0, 0x20262e, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, 1, 0.8);
    this.camera.add(key);
    this.scene.add(this.camera);
    // the scope's face shows the CRT canvas; both sides, so that from inside the tube (the
    // cutaway) the picture shows too, mirrored, where the beam lands
    this.faceTexture = new THREE.CanvasTexture(faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    this.built.face.material = new THREE.MeshBasicMaterial({ map: this.faceTexture, toneMapped: false, side: THREE.DoubleSide });
    /** Whether it is shown and rendering (V8). */
    this.active = true;
    /** @type {THREE.Object3D | null} */
    this.selected = null;
    /** Show the cables strongly and the machines faintly (Room's Connections). */
    this.connections = false;
    /** @type {Rect | null} */
    this.free = null;
    /** The reader has moved the camera: refitting stops until a viewpoint is chosen (U4). */
    this.userMoved = false;
    /** @type {(() => Pose) | null} the pose the current viewpoint frames, for refits */
    this.framing = null;
    /** @type {{ from: Pose; to: Pose; t0: number; done: () => void; fromOffset: { x: number; y: number }; toOffset: { x: number; y: number } } | null} */
    this.flight = null;
    /** The view offset applied now (applyOffset). */
    this.offset = { x: 0, y: 0 };
    /** @type {(name: string | null) => void} */
    this.onPick = () => {};
    /** @type {(name: string) => void} */
    this.onActivate = () => {};
    /** @type {(n: number, dyPx: number, start: boolean) => void} a dial on the desk dragged up or down (U5, P2) */
    this.onDial = () => {};
    this.raycaster = new THREE.Raycaster();
    const canvas = this.renderer.domElement;
    /** @type {{ x: number; y: number } | null} */
    let down = null;
    /** @type {{ n: number; y0: number } | null} a dial being turned on the desk */
    let dial = null;
    canvas.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY };
      const m = this.rawHit(e)?.match(/^console\.dials\.knob\.(\d)/);
      if (m) {
        dial = { n: Number(m[1]), y0: e.clientY };
        this.controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        this.onDial(dial.n, 0, true);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (dial) this.onDial(dial.n, dial.y0 - e.clientY, false);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (dial) {
        dial = null;
        this.controls.enabled = true;
      } else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= CLICK_PX) this.pick(e);
      down = null;
    });
    canvas.addEventListener("dblclick", (e) => {
      const name = this.hit(e);
      if (name) this.onActivate(name);
    });
    // the reader takes the camera: a flight under way ends where it is, and counts as arrived
    this.controls.addEventListener("start", () => {
      this.userMoved = true;
      const f = this.flight;
      this.flight = null;
      if (f) this.applyOffset(f.toOffset);
      f?.done();
    });
    // the Tube's beam: from the gun to the yoke, then bent to the spot; faint while blanked
    const beamColor = token("--phosphor", "#7dff9b");
    const unit = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    /** @param {number} opacity */
    const beamMat = (opacity) => new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.beam = [0, 1].map(() => ({ core: new THREE.Mesh(unit, beamMat(1)), glow: new THREE.Mesh(unit, beamMat(0.25)) }));
    for (const b of this.beam) {
      b.core.name = "beam.core";
      b.glow.name = "beam.glow";
      this.scene.add(b.core, b.glow);
      b.core.visible = b.glow.visible = false;
    }
    this.inside = false;
    /** @type {{ direction: number[]; seen: number; of: number } | null} */
    this.lastLook = null;
    /** The six knobs on the desk, turned as the dials are. */
    this.knobs = Array.from({ length: 6 }, (_, n) => this.built.root.getObjectByName(`console.dials.knob.${n}`));
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(100, r.width);
    const h = Math.max(100, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyFree();
    if (this.framing && !this.userMoved && !this.flight) this.jump(this.framing());
  }

  /**
   * Sets the free area, and moves the projection's centre to its centre.
   * @param {Rect} rect
   */
  setFree(rect) {
    this.free = rect;
    this.applyFree();
    if (this.framing && !this.userMoved && !this.flight) this.jump(this.framing());
  }

  /**
   * Sets the free area for the next flight without moving the picture now: the flight moves the
   * picture's centre there in step with the camera, so nothing jumps before it starts.
   * @param {Rect} rect
   */
  setFreeForFlight(rect) {
    this.free = rect;
  }

  /** @returns {{ x: number; y: number }} the view offset that centres the projection on the free area */
  offsetFor() {
    const W = this.host.clientWidth || 1;
    const H = this.host.clientHeight || 1;
    const f = this.free ?? { left: 0, top: 0, width: W, height: H };
    return { x: W / 2 - (f.left + f.width / 2), y: H / 2 - (f.top + f.height / 2) };
  }

  /** @param {{ x: number; y: number }} o */
  applyOffset(o) {
    const W = this.host.clientWidth || 1;
    const H = this.host.clientHeight || 1;
    this.offset = o;
    this.camera.setViewOffset(W, H, o.x, o.y, W, H);
    this.camera.updateProjectionMatrix();
  }

  applyFree() {
    if (this.flight) this.flight.toOffset = this.offsetFor();
    else this.applyOffset(this.offsetFor());
  }

  /**
   * The pose that frames a box seen from a direction, filling the free area (U4).
   * @param {THREE.Box3} box
   * @param {THREE.Vector3} dir from the subject towards the camera
   * @returns {Pose}
   */
  frame(box, dir) {
    const W = this.host.clientWidth || 1;
    const H = this.host.clientHeight || 1;
    const f = this.free ?? { left: 0, top: 0, width: W, height: H };
    const center = box.getCenter(new THREE.Vector3());
    const back = dir.clone().normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right).normalize();
    // each corner, at its own depth, must fall inside the free area: at distance D a metre is
    // H / (2 D tan) pixels, and a corner nearer the camera by b is at D = d - b
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    let d = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const c = new THREE.Vector3(x, y, z).sub(center);
          const b = c.dot(back);
          d = Math.max(d, b + (Math.abs(c.dot(right)) * H) / (FILL * f.width * tan), b + (Math.abs(c.dot(up)) * H) / (FILL * f.height * tan));
        }
    return { pos: center.clone().addScaledVector(back, d), target: center };
  }

  /**
   * The pose of a close look at a part (V1a): the first of LOOK_DIRECTIONS for the side its
   * controls are on (its face) from which every sample point of that face is seen, or else the one that sees most of them. It does not
   * depend on where the camera is, so the same part is always seen from the same place.
   * @param {THREE.Object3D} part
   * @returns {Pose}
   */
  lookPose(part) {
    const box = new THREE.Box3().setFromObject(part);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    /** Whether a mesh is the part, or a piece of it (the scope's face is its own node). @param {THREE.Object3D} o */
    const ofPart = (o) => {
      for (let q = /** @type {THREE.Object3D | null} */ (o); q; q = q.parent) if (q === part || q.userData.partOf === part.name) return true;
      return false;
    };
    /** @param {THREE.Object3D} o */
    const shown = (o) => {
      for (let q = /** @type {THREE.Object3D | null} */ (o); q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    /** Whether a mesh hides what is behind it: not glass, the floor or the beam. @param {THREE.Object3D} o */
    const opaque = (o) => {
      const m = /** @type {THREE.Material} */ (/** @type {THREE.Mesh} */ (o).material);
      return shown(o) && o.name !== "room.floor" && !o.name.startsWith("beam.") && !(m && m.transparent && m.opacity < 0.5);
    };
    const ray = new THREE.Raycaster();
    /** @type {Pose | null} */
    let best = null;
    let bestSeen = -1;
    const face = part.userData.face === "top" ? "top" : "front";
    const samples = LOOK_SAMPLES[face];
    // a part may name the direction to try first (its look in the params, in three.js's frame here)
    const own = /** @type {number[] | undefined} */ (part.userData.look);
    for (const d of own ? [own, ...LOOK_DIRECTIONS[face]] : LOOK_DIRECTIONS[face]) {
      const pose = this.frame(box, new THREE.Vector3(...d));
      let seen = 0;
      for (const [sx, sy, sz] of samples) {
        const target = center.clone().add(new THREE.Vector3(sx * size.x, sy * size.y, sz * size.z));
        const dir = target.clone().sub(pose.pos);
        ray.set(pose.pos, dir.clone().normalize());
        // only what stands in front of the point hides it (a thin part's box has air beside it)
        ray.far = dir.length() + 0.005;
        const hit = ray.intersectObjects(this.built.root.children, true).find((h) => opaque(h.object));
        if (!hit || ofPart(hit.object)) seen++;
      }
      if (seen > bestSeen) {
        bestSeen = seen;
        best = pose;
        /** which direction a close look took, and how many of its points it saw (for ?debug) */
        this.lastLook = { direction: d, seen, of: samples.length };
      }
      if (seen === samples.length) break;
    }
    return /** @type {Pose} */ (best);
  }

  /**
   * Frames a viewpoint and flies there; it refits as the stage changes, until the reader moves.
   * @param {() => Pose} framing
   * @param {boolean} [animate]
   * @returns {Promise<void>} when the camera has arrived
   */
  goTo(framing, animate = true) {
    this.framing = framing;
    this.userMoved = false;
    const to = framing();
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce || !this.active) {
      this.flight = null;
      this.jump(to);
      return Promise.resolve();
    }
    this.stopInertia();
    return new Promise((done) => {
      this.flight?.done();
      this.flight = { from: { pos: this.camera.position.clone(), target: this.controls.target.clone() }, to, t0: performance.now(), done, fromOffset: { ...this.offset }, toOffset: this.offsetFor() };
    });
  }

  /**
   * Stops what the reader's last drag or scroll is still doing: OrbitControls' damping carries a
   * turn, a pan and a zoom on after the pointer is released. Left alone, it pushes the camera
   * during a flight and after it lands, so the same viewpoint came out different each time.
   */
  stopInertia() {
    const c = /** @type {any} */ (this.controls);
    c._sphericalDelta?.set(0, 0, 0);
    c._panOffset?.set(0, 0, 0);
    if (typeof c._scale === "number") c._scale = 1;
  }

  /** @param {Pose} p */
  jump(p) {
    this.stopInertia();
    this.applyOffset(this.offsetFor());
    this.camera.position.copy(p.pos);
    this.controls.target.copy(p.target);
    this.controls.update();
  }

  /** Steps a flight. */
  fly() {
    const f = this.flight;
    if (!f) return;
    this.stopInertia();
    const u = Math.min(1, (performance.now() - f.t0) / FLIGHT_MS);
    const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    this.camera.position.lerpVectors(f.from.pos, f.to.pos, e);
    this.controls.target.lerpVectors(f.from.target, f.to.target, e);
    this.applyOffset({ x: f.fromOffset.x + (f.toOffset.x - f.fromOffset.x) * e, y: f.fromOffset.y + (f.toOffset.y - f.fromOffset.y) * e });
    if (u >= 1) {
      this.flight = null;
      f.done();
    }
  }

  /**
   * Zooms by a factor towards the target.
   * @param {number} k below 1 moves in
   */
  zoom(k) {
    this.userMoved = true;
    const off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(k);
    this.camera.position.copy(this.controls.target).add(off);
    this.controls.update();
  }

  /**
   * The nearest shown mesh under a pointer.
   * @param {MouseEvent} e
   * @returns {THREE.Object3D | null}
   */
  meshAt(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    /** @param {THREE.Object3D} o */
    const shown = (o) => {
      for (let q = /** @type {THREE.Object3D | null} */ (o); q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    const hits = this.raycaster.intersectObjects(this.built.root.children, true).filter((h) => h.object.name !== "room.floor" && !h.object.name.startsWith("beam.") && shown(h.object));
    return hits.length ? hits[0].object : null;
  }

  /**
   * The name of the mesh under a pointer, itself (not its part's).
   * @param {MouseEvent} e
   * @returns {string | null}
   */
  rawHit(e) {
    return this.meshAt(e)?.name ?? null;
  }

  /**
   * The part or cable under a pointer, by its name.
   * @param {MouseEvent} e
   * @returns {string | null}
   */
  hit(e) {
    /** @type {THREE.Object3D | null} */
    let o = this.meshAt(e);
    // a part or a cable: what has a confidence or a kind of signal
    while (o && o.userData.confidence === undefined && o.userData.kind === undefined) o = o.parent;
    // a piece of another part (the scope's glass face) picks that part
    return o ? (o.userData.partOf ?? o.name) : null;
  }

  /** @param {MouseEvent} e */
  pick(e) {
    const name = this.hit(e);
    this.select(name);
    this.onPick(name);
  }

  /**
   * Highlights a part (or none), and fades the rest under Connections.
   * @param {string | null} name
   */
  select(name) {
    this.selected = name ? (this.built.parts.get(name) ?? this.built.cables.get(name) ?? null) : null;
    const accent = token("--md-primary", "#9ecaff");
    this.built.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === this.built.face || o.name === "room.floor") return;
      if (o.userData.glass || o.name.endsWith(".tube.funnel") || o.name.endsWith(".tube.neck")) return;
      const m = /** @type {THREE.MeshStandardMaterial} */ (o.material);
      if (!m.emissive) return;
      let inSel = false;
      for (let p = /** @type {THREE.Object3D | null} */ (o); p; p = p.parent) if (p === this.selected) inSel = true;
      if (!o.name.startsWith("cable.") && !o.name.includes(".lamp.")) {
        if (!o.userData.own) o.material = m.clone();
        o.userData.own = true;
        const mm = /** @type {THREE.MeshStandardMaterial} */ (o.material);
        mm.emissive.set(accent);
        mm.emissiveIntensity = inSel ? 0.25 : 0;
        // Connections dims the machines rather than making them see-through: transparent
        // pieces close together (a tape door's reels, its glass, the columns behind) are sorted
        // by distance and swapped places as the camera turned, so parts flickered in and out
        o.userData.base ??= mm.color.clone();
        mm.color.copy(o.userData.base).multiplyScalar(this.connections && !inSel ? DIM : 1);
      }
    });
  }

  /**
   * The cutaway (R20): the scope's side and the CRT module's wall removed, the tube and the beam
   * shown.
   * @param {boolean} on
   */
  setInside(on) {
    const t = this.built.tube;
    if (!t || on === this.inside) return;
    this.inside = on;
    t.group.visible = on;
    for (const o of t.cut) o.visible = !on;
    for (const b of this.beam) b.core.visible = b.glow.visible = false;
  }

  /**
   * The beam, where the machine has it now.
   * @param {Agt30} agt
   */
  updateBeam(agt) {
    const t = this.built.tube;
    if (!t || !this.inside) return;
    const b = beamAt(agt.segs, agt.now);
    const spot = t.spot(b.x, b.y);
    const on = b.z > 0;
    const legs = [[t.gun, t.bend], [t.bend, spot]];
    this.beam.forEach((leg, i) => {
      const [a, c] = legs[i];
      for (const [m, r] of /** @type {[THREE.Mesh, number][]} */ ([[leg.core, on ? 0.0009 : 0.0005], [leg.glow, on ? 0.003 : 0.0015]])) {
        m.visible = true;
        m.position.copy(a).add(c).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
        m.scale.set(r, a.distanceTo(c), r);
        const mm = /** @type {THREE.MeshBasicMaterial} */ (m.material);
        mm.opacity = on ? (m === leg.core ? 0.35 + 0.65 * b.z : 0.12 + 0.2 * b.z) : m === leg.core ? 0.1 : 0.04;
      }
    });
  }

  /**
   * Shows the machine's state and renders: the face, the lamps (AR), the cables' traffic.
   * @param {Agt30} agt
   */
  update(agt) {
    if (!this.active) return;
    this.fly();
    this.faceTexture.needsUpdate = true;
    this.knobs.forEach((k, n) => k && (k.rotation.y = -THREE.MathUtils.degToRad(agt.dev.dials[n] * DIAL_TRAVEL_DEG)));
    this.built.lamps.forEach((l, i) => {
      const on = Math.floor(agt.cpu.AR / 2 ** (29 - i)) % 2 === 1;
      /** @type {THREE.MeshStandardMaterial} */ (l.material).emissiveIntensity = on ? 1.4 : 0;
    });
    const last = agt.frames.at(-1);
    const recent = last !== undefined && agt.now - last.start < 200000;
    const level = {
      vectors: recent && agt.image !== null ? Math.min(1, 0.25 + last.drawn / 1660) : 0,
      cpu: recent || agt.program ? 0.6 : 0,
      clock: agt.clockCode.length && recent ? 0.7 : 0,
      tty: agt.printQueue.length ? 0.8 : 0,
      none: 0,
    };
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
    for (const c of this.built.cables.values()) {
      const m = /** @type {THREE.MeshStandardMaterial} */ (c.userData.material);
      const a = /** @type {keyof typeof level} */ (c.userData.activity);
      m.emissiveIntensity = (this.connections ? 0.25 : 0.05) + (level[a] ?? 0) * pulse * (this.connections ? 1.6 : 0.8);
    }
    this.updateBeam(agt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

/** The materials' colours, from the theme's tokens (U10). */
function palette() {
  return {
    enamel: token("--enamel", "#9aa7b3"),
    enamel_dark: token("--enamel-dark", "#5f6b77"),
    panel: token("--panel-black", "#23272c"),
    trim: token("--trim", "#c9ced3"),
    bezel: token("--scope-bezel", "#0b0c0e"),
    metal: token("--metal", "#b4b9bf"),
    switchRed: token("--switch-red", "#c8352b"),
    boxBrown: token("--box-brown", "#3d2f28"),
    boxTop: token("--box-top", "#8b8d86"),
    knobBlack: token("--knob-black", "#1a1513"),
    deskTop: token("--desk-top", "#d3d0c6"),
    rackBlack: token("--rack-black", "#1b1d20"),
    rackPanel: token("--rack-panel", "#2e3136"),
    rackWhite: token("--rack-white", "#d9d6cc"),
    glass: token("--glass", "#9fb4c4"),
    tty: token("--tty-case", "#a9a08c"),
    ttyCover: token("--tty-cover", "#c4bea9"),
    ttyStand: token("--tty-stand", "#8f8c82"),
    ttyKey: token("--tty-key", "#e4e0d2"),
    ttyDark: token("--tty-dark", "#2d2f31"),
    paper: token("--paper", "#efe8d2"),
    crt: token("--crt-face", "#050806"),
    lampOff: token("--lamp-off", "#4a4033"),
    lampOn: token("--lamp-on", "#ffd36b"),
    analog: token("--analog", "#ffb86b"),
    digital: token("--digital", "#9ecaff"),
    floor: token("--md-surface-mid", "#1b2026"),
  };
}
