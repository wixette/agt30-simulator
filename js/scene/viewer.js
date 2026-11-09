// SPDX-License-Identifier: Apache-2.0
//
// The 3D view of the installation: renderer, camera, controls, lights that travel with the camera
// (the subject lit as on a dark stage), picking, the live scope face, and the lamps and cables
// driven by the machine.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildTerminal } from "./terminal3d.js";
import { token } from "../view/theme.js";
import { beamAt } from "../view/beam.js";

/** @typedef {import("./terminal3d.js").TerminalParams} TerminalParams */
/** @typedef {import("../sim/agt.js").Agt30} Agt30 */

export class TerminalView {
  /**
   * @param {HTMLElement} host
   * @param {TerminalParams} params
   * @param {HTMLCanvasElement} faceCanvas the canvas the CRT is painted on
   */
  constructor(host, params, faceCanvas) {
    this.host = host;
    const palette = {
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
    this.built = buildTerminal(params, palette);
    this.scene = new THREE.Scene();
    this.scene.add(this.built.root);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    host.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
    this.camera.position.set(1.6, 2.4, 4.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.8, -0.6);
    this.controls.enableDamping = true;
    // lights that move with the camera, so dark enamel stays readable on a dark stage
    this.scene.add(new THREE.HemisphereLight(0xdde6f0, 0x20262e, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, 1, 0.8);
    this.camera.add(key);
    this.scene.add(this.camera);
    // the scope's face shows the CRT canvas
    this.faceTexture = new THREE.CanvasTexture(faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    // both sides: the phosphor is on the inside of the glass, so from inside the tube (the cutaway)
    // the picture shows too, mirrored, where the beam lands
    this.built.face.material = new THREE.MeshBasicMaterial({ map: this.faceTexture, toneMapped: false, side: THREE.DoubleSide });
    /** @type {THREE.Object3D | null} */
    this.selected = null;
    /** Show the cables strongly and the machines faintly. */
    this.connections = false;
    this.raycaster = new THREE.Raycaster();
    /** @type {(name: string | null) => void} */
    this.onPick = () => {};
    this.renderer.domElement.addEventListener("pointerup", (e) => this.pick(e));
    // the cutaway's beam: from the gun straight to the yoke, then bent to the spot; a faint
    // path while it is blanked (an electron beam is invisible: drawn here to teach)
    const beamColor = token("--phosphor", "#7dff9b");
    const unit = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    /** @param {number} opacity */
    const beamMat = (opacity) => new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    /** The beam's two legs, each a core and a glow. */
    this.beam = [0, 1].map(() => ({ core: new THREE.Mesh(unit, beamMat(1)), glow: new THREE.Mesh(unit, beamMat(0.25)) }));
    for (const b of this.beam) {
      b.core.name = "beam.core";
      b.glow.name = "beam.glow";
      this.scene.add(b.core, b.glow);
      b.core.visible = b.glow.visible = false;
    }
    this.inside = false;
    /** @type {{ pos: THREE.Vector3; target: THREE.Vector3 } | null} the camera before the cutaway */
    this.savedView = null;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(100, r.width);
    const h = Math.max(100, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** @param {PointerEvent} e */
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    /** @param {THREE.Object3D} o */
    const shown = (o) => {
      for (let q = /** @type {THREE.Object3D | null} */ (o); q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    const hits = this.raycaster.intersectObjects(this.built.root.children, true).filter((h) => h.object.name !== "room.floor" && shown(h.object));
    /** @type {THREE.Object3D | null} */
    let o = hits.length ? hits[0].object : null;
    // a part or a cable: what has a confidence or a kind of signal
    while (o && o.userData.confidence === undefined && o.userData.kind === undefined) o = o.parent;
    // a piece of another part (the scope's glass face) picks that part
    const name = o ? (o.userData.partOf ?? o.name) : null;
    this.select(name);
    this.onPick(name);
  }

  /** @param {string | null} name */
  select(name) {
    this.selected = name ? (this.built.parts.get(name) ?? this.built.cables.get(name) ?? null) : null;
    this.built.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === this.built.face || o.name === "room.floor") return;
      // glass (the tube's, the tape doors') keeps its own transparency
      if (o.userData.glass || o.name.endsWith(".tube.funnel") || o.name.endsWith(".tube.neck")) return;
      const m = /** @type {THREE.MeshStandardMaterial} */ (o.material);
      if (!m.emissive) return;
      let inSel = false;
      for (let p = /** @type {THREE.Object3D | null} */ (o); p; p = p.parent) if (p === this.selected) inSel = true;
      if (!o.name.startsWith("cable.") && !o.name.includes(".lamp.")) {
        if (!o.userData.own) o.material = m.clone();
        o.userData.own = true;
        const mm = /** @type {THREE.MeshStandardMaterial} */ (o.material);
        mm.emissive.set(token("--md-primary", "#9ecaff"));
        mm.emissiveIntensity = inSel ? 0.25 : 0;
        mm.transparent = this.connections && !inSel;
        mm.opacity = this.connections && !inSel ? 0.25 : 1;
      }
    });
  }

  /**
   * The cutaway: the scope's left side and the CRT module's left wall removed, the tube and the
   * beam shown; the camera goes to the scope's left. Off: the scope as it was, and the view back.
   * @param {boolean} on
   */
  setInside(on) {
    const t = this.built.tube;
    if (!t || on === this.inside) return;
    this.inside = on;
    t.group.visible = on;
    for (const o of t.cut) o.visible = !on;
    for (const b of this.beam) b.core.visible = b.glow.visible = false;
    if (on) {
      this.savedView = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
      const mid = t.bend.clone().lerp(t.spot(0, 0), 0.5);
      this.controls.target.copy(mid);
      this.camera.position.copy(mid).add(new THREE.Vector3(-1.0, 0.36, 1.0));
    } else if (this.savedView) {
      this.camera.position.copy(this.savedView.pos);
      this.controls.target.copy(this.savedView.target);
    }
    this.controls.update();
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
   * Shows the machine's state: the face, the lamps (AR), the cables' traffic.
   * @param {Agt30} agt
   */
  update(agt) {
    this.faceTexture.needsUpdate = true;
    this.built.lamps.forEach((l, i) => {
      const on = Math.floor(agt.cpu.AR / 2 ** (29 - i)) % 2 === 1;
      /** @type {THREE.MeshStandardMaterial} */ (l.material).emissiveIntensity = on ? 1.4 : 0;
    });
    const last = agt.frames[agt.frames.length - 1];
    const recent = last && agt.now - last.start < 200000;
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
