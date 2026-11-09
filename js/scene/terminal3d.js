// SPDX-License-Identifier: Apache-2.0
//
// The AGT-30 installation in low-poly 3D, built from params/terminal.json: the console with its
// scope, the Teletype, four racks, two tape drives, two disk drives, and the cables between them.
// No .glb: every part is a few boxes, profiles or cylinders, made here from the params, so the
// model and its sizes live in one file (D7). Node builds it too, for the scene checks.
//
// The params' frame: millimetres, +X to the operator's right, +Y away from the operator, +Z up.
// three.js: metres, Y up, the operator looking along -Z (docs/conventions.md).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * @typedef {object} PartDef
 * @property {string} name
 * @property {number[]} [box] width, depth, height
 * @property {number[]} [plane] width, height
 * @property {number[]} [cylinder] radius, length; lying along X on what is under it
 * @property {number[]} at bottom centre (box), centre (plane, cylinder)
 * @property {number} [tilt] degrees back, for the plane
 * @property {number} [radius] a curved face: its sphere's radius (mm)
 * @property {number} [picture] a curved face: the side of the square the picture fills (mm)
 * @property {Gds1} [gds1] the scope's front, measured from NCSU's photographs (R16)
 * @property {number} [wedge] a box whose top slopes down to the front: its height at the front (box[2] is the back's)
 * @property {Desk} [desk] the console desk's frame
 * @property {string} [partOf] a piece of another part: picking it picks that part
 * @property {"front" | "top"} [face] the side its controls are on, which a close look shows (front unless given)
 * @property {number[]} [look] the direction a close look tries first, from the part towards the camera (params frame)
 * @property {[string, number][]} [front] a cabinet's front panels, top to bottom: style and height (mm; the last fills what is left)
 * @property {string} material
 * @property {string} confidence
 */

/**
 * The console desk as the 1969 brochure shows it (BRO69; R16): a thin
 * top on slim dark posts that stand on floor runners, and a dark pedestal under the scope.
 * @typedef {object} Desk
 * @property {number} top the top's thickness
 * @property {number} post the posts' square section
 * @property {number} inset the posts' centres in from the top's edges
 * @property {number} rail the rails under the top: their height (sides and back; none at the front, for the knees)
 * @property {number[]} pedestal under the scope: width, depth, back from the top's back edge
 */

/**
 * The scope (NCSU's photographs; R16): a white sheet-metal housing open at the front, split by a
 * partition into an upper section, holding the black CRT module, and a lower one, holding the
 * control panel's black box. Millimetres across from the housing's left edge and down from its
 * top, except where noted.
 * @typedef {object} Gds1
 * @property {number} sheet the housing's sheet thickness
 * @property {number} lip the white flange round the front: its width seen from the front
 * @property {number[]} partition the partition's top, down from the top, and its front border's height
 * @property {number} seam how far behind the housing's front the CRT module's bezel starts
 * @property {number} apex how far behind the bezel's front the glass's apex sits
 * @property {number} module the CRT module's depth
 * @property {number[]} panel the panel box: left, right, top, bottom, setback from the front, depth
 * @property {number[]} knobs the six knobs, across
 * @property {number[]} knob a knob's radius and how far it stands out of the panel
 * @property {number[]} logo the logo's placeholder: centre across, width, height
 * @property {number} switch the power switch, across
 * @property {number[]} nameplate the sign on top: length, left (past the cabinet's left), height, gap above the top
 * @property {number[]} vents count, first and last slot back from the front, top and bottom down from the top
 * @property {number} groove a groove down each side, back from the front
 * @property {number} corner the glass's corner radius
 * @property {number[]} tube the tube behind the glass (an illustration, a typical 21-inch magnetic tube): length from the apex to the neck's end, neck radius, neck length, yoke radius, yoke length
 */

/**
 * @typedef {object} CableDef
 * @property {string} name
 * @property {string} from
 * @property {string} to
 * @property {"analog" | "digital"} kind
 * @property {{ from?: number[][]; to?: number[][] }} [lead] where the cable leaves or enters its part (params mm), before it drops to the floor: from the connector outward
 * @property {string} activity
 */

/** @typedef {{ parts: PartDef[]; cables: CableDef[]; room: { w: number; d: number } }} TerminalParams */

/** The materials' colours; the page passes the theme's tokens. */
export const DEFAULT_PALETTE = {
  enamel: "#9aa7b3",
  enamel_dark: "#5f6b77",
  panel: "#23272c",
  trim: "#c9ced3",
  bezel: "#0b0c0e",
  metal: "#b4b9bf",
  switchRed: "#c8352b",
  boxBrown: "#3d2f28",
  boxTop: "#8b8d86",
  knobBlack: "#1a1513",
  tty: "#a9a08c",
  deskTop: "#d3d0c6",
  rackBlack: "#1b1d20",
  rackPanel: "#2e3136",
  rackWhite: "#d9d6cc",
  glass: "#9fb4c4",
  ttyCover: "#c4bea9",
  ttyStand: "#8f8c82",
  ttyKey: "#e4e0d2",
  ttyDark: "#2d2f31",
  paper: "#efe8d2",
  crt: "#050806",
  lampOff: "#4a4033",
  lampOn: "#ffd36b",
  analog: "#ffb86b",
  digital: "#9ecaff",
  floor: "#1b2026",
};

/** @typedef {typeof DEFAULT_PALETTE} Palette */

/**
 * The params' millimetres to three.js metres.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {THREE.Vector3}
 */
export const v3 = (x, y, z) => new THREE.Vector3(x / 1000, z / 1000, -y / 1000);

/**
 * @typedef {object} Built
 * @property {THREE.Group} root
 * @property {Map<string, THREE.Object3D>} parts by name (the params' names)
 * @property {Map<string, THREE.Group>} cables
 * @property {THREE.Mesh[]} lamps the DPR-2 panel's 30 lamps, bit 0 first
 * @property {THREE.Mesh} face the CRT face
 * @property {Map<string, THREE.MeshStandardMaterial>} materials
 * @property {Tube | null} tube the scope's tube, hidden until the cutaway shows it
 */

/**
 * The scope's tube, for the cutaway: where the beam starts, where it bends, where it lands.
 * Positions in three.js metres.
 * @typedef {object} Tube
 * @property {THREE.Group} group
 * @property {THREE.Object3D[]} cut the scope's parts the cutaway removes
 * @property {THREE.Vector3} gun where the beam leaves the gun
 * @property {THREE.Vector3} bend the deflection centre, in the yoke
 * @property {(x: number, y: number) => THREE.Vector3} spot a point of the picture (inches from its centre) on the glass
 */

/**
 * Builds the installation.
 * @param {TerminalParams} params
 * @param {Palette} [palette]
 * @returns {Built}
 */
export function buildTerminal(params, palette = DEFAULT_PALETTE) {
  const root = new THREE.Group();
  root.name = "agt30";
  /** @type {Map<string, THREE.MeshStandardMaterial>} */
  const materials = new Map();
  /** @param {string} key @returns {THREE.MeshStandardMaterial} */
  const mat = (key) => {
    let m = materials.get(key);
    if (!m) {
      const color = /** @type {Record<string, string>} */ (palette)[key] ?? "#888888";
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: key.startsWith("enamel") ? 0.15 : 0.05 });
      m.name = key;
      materials.set(key, m);
    }
    return m;
  };
  /** @type {Map<string, THREE.Object3D>} */
  const parts = new Map();
  /** @type {THREE.Mesh[]} */
  const lamps = [];
  /** @type {THREE.Mesh | null} */
  let face = null;
  /** @type {Tube | null} */
  let tube = null;

  /**
   * A box in the params' millimetres, by its bottom centre.
   * @param {THREE.Object3D} parent
   * @param {number[]} size w, d, h
   * @param {number[]} at x, y, z (bottom centre, relative to the parent's origin, mm)
   * @param {string} material
   * @param {string} [name]
   * @returns {THREE.Mesh}
   */
  const box = (parent, size, at, material, name) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size[0] / 1000, size[2] / 1000, size[1] / 1000), mat(material));
    m.position.copy(v3(at[0], at[1], at[2] + size[2] / 2));
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  for (const p of params.parts) {
    const g = new THREE.Group();
    g.name = p.name;
    g.userData = { confidence: p.confidence, partOf: p.partOf, face: p.face ?? "front", look: p.look ? [p.look[0], p.look[2], -p.look[1]] : undefined };
    root.add(g);
    parts.set(p.name, g);
    const [x, y, z] = p.at;
    if (p.name === "console.desk" && p.box && p.desk) {
      // a thin top on four slim posts standing on floor runners, rails under the top at the
      // sides and back, and a pedestal under the scope; the knees and the pedals go in front of it
      const [w, d, h] = p.box;
      const k = p.desk;
      box(g, [w, d, k.top], [x, y, z + h - k.top], "deskTop", `${p.name}.top`);
      box(g, [w, 3, k.top], [x, y - d / 2 - 1.5, z + h - k.top], "metal", `${p.name}.edge`);
      const under = h - k.top;
      for (const sx of [-1, 1]) {
        const px = x + sx * (w / 2 - k.inset);
        for (const sy of [-1, 1]) box(g, [k.post, k.post, under - 30], [px, y + sy * (d / 2 - k.inset), z + 30], "panel", `${p.name}.post.${sx < 0 ? "l" : "r"}${sy < 0 ? "f" : "b"}`);
        box(g, [k.post, d - 2 * k.inset + 160, 30], [px, y, z], "panel", `${p.name}.runner.${sx < 0 ? "l" : "r"}`);
        box(g, [25, d - 2 * k.inset, k.rail], [px, y, z + under - k.rail], "panel", `${p.name}.rail.${sx < 0 ? "l" : "r"}`);
      }
      box(g, [w - 2 * k.inset, 25, k.rail], [x, y + d / 2 - k.inset, z + under - k.rail], "panel", `${p.name}.rail.back`);
      const [pw, pd, pb] = k.pedestal;
      box(g, [pw, pd, under], [x, y + d / 2 - pb - pd / 2, z], "panel", `${p.name}.pedestal`);
    } else if (p.name === "console.scope" && p.box && p.gds1) {
      scope(p, g);
    } else if ((p.name.startsWith("rack.") || p.name.startsWith("tape.") || p.name.startsWith("disk.")) && p.box) {
      if (p.name.startsWith("rack.")) cabinet(p, g);
      else if (p.name.startsWith("tape.")) tapeDrive(p, g);
      else diskDrive(p, g);
    } else if (p.name === "console.pedals" && p.box) {
      pedals(p, g);
    } else if (p.name === "tty.asr33" && p.box) {
      asr33(p, g);
    } else if (p.box && p.wedge) {
      wedgeBox(p, g);
    } else if (p.box) {
      const body = box(g, p.box, p.at, p.material, `${p.name}.body`);
      details(p, g, body);
    } else if (p.plane && p.radius && p.picture) {
      // the tube's face: a piece of a sphere, the picture filling the middle p.picture mm square
      // (the canvas's edge, the dark face, is clamped beyond it)
      const geo = new THREE.PlaneGeometry(p.plane[0] / 1000, p.plane[1] / 1000, 24, 24);
      const pos = geo.getAttribute("position");
      const uv = geo.getAttribute("uv");
      const R = p.radius / 1000;
      const side = p.picture / 1000;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        pos.setZ(i, -(px * px + py * py) / (2 * R));
        uv.setXY(i, px / side + 0.5, py / side + 0.5);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: palette.crt }));
      m.position.copy(v3(x, y, z));
      m.name = `${p.name}.glass`;
      m.userData = { picture: p.picture };
      g.add(m);
      face = m;
    } else if (p.plane) {
      const geo = new THREE.PlaneGeometry(p.plane[0] / 1000, p.plane[1] / 1000);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: palette.crt }));
      m.position.copy(v3(x, y, z));
      m.rotation.x = -((p.tilt ?? 0) * Math.PI) / 180;
      m.name = `${p.name}.glass`;
      g.add(m);
      face = m;
    } else if (p.cylinder) {
      // lying on the desk along X, its tip a little thinner
      const [cr, cl] = p.cylinder;
      const c = new THREE.Mesh(new THREE.CylinderGeometry((cr * 0.6) / 1000, cr / 1000, cl / 1000, 12), mat(p.material));
      c.position.copy(v3(x, y, z + cr));
      c.rotation.z = Math.PI / 2;
      c.name = `${p.name}.body`;
      g.add(c);
    }
  }

  /**
   * The GDS1 scope as NCSU's photographs show it (R16): a white sheet-metal housing, open at the front, with a white flange round its
   * front edges and a partition across it. The upper section holds the CRT module, a black box
   * whose front is a bezel sloping in to the curved glass; the lower one, a black panel box on
   * metal feet with six knobs, the logo and a power switch. A nameplate stands on top; vents and a
   * groove run down each side.
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function scope(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const s = /** @type {Gds1} */ (p.gds1);
    const faceDef = params.parts.find((q) => q.name === "console.scope.face");
    const [fw, fh] = faceDef?.plane ?? [305, 305];
    const [fx, apexY, fz] = faceDef?.at ?? [x, y - d / 2, z + h / 2];
    const R = faceDef?.radius ?? 1000;
    const front = y - d / 2;
    const back = y + d / 2;
    const left = x - w / 2;
    const right = x + w / 2;
    const top = z + h;
    const t = s.sheet;
    const W = "trim";
    // the housing: four walls and a back, a flange round the front, the partition
    box(g, [t, d, h], [left + t / 2, y, z], W, `${p.name}.body.l`);
    box(g, [t, d, h], [right - t / 2, y, z], W, `${p.name}.body.r`);
    // the top in two pieces: the cutaway removes the back one and keeps a strip at the front, where
    // the nameplate's posts stand
    const strip = 60;
    box(g, [w - 2 * t, strip, t], [x, front + strip / 2, top - t], W, `${p.name}.body.t.front`);
    box(g, [w - 2 * t, d - strip, t], [x, y + strip / 2, top - t], W, `${p.name}.body.t`);
    box(g, [w - 2 * t, d, t], [x, y, z], W, `${p.name}.body.b`);
    box(g, [w - 2 * t, t, h - 2 * t], [x, back - t / 2, z + t], W, `${p.name}.body.back`);
    box(g, [s.lip, t, h], [left + s.lip / 2, front + t / 2, z], W, `${p.name}.flange.l`);
    box(g, [s.lip, t, h], [right - s.lip / 2, front + t / 2, z], W, `${p.name}.flange.r`);
    box(g, [w - 2 * s.lip, t, s.lip], [x, front + t / 2, top - s.lip], W, `${p.name}.flange.t`);
    box(g, [w - 2 * s.lip, t, s.lip], [x, front + t / 2, z], W, `${p.name}.flange.b`);
    const [partTop, partH] = s.partition;
    box(g, [w - 2 * t, d - 2 * t, partH], [x, y, top - partTop - partH], W, `${p.name}.partition`);

    // the CRT module: a black box filling the upper section, its front a bezel sloping in to the glass
    const m0 = front + s.seam;
    const [bl, br, bb, bt] = [left + t, right - t, top - partTop, top - t];
    const B = "bezel";
    box(g, [t, s.module, bt - bb], [bl + t / 2, m0 + s.module / 2, bb], B, `${p.name}.crt.l`);
    box(g, [t, s.module, bt - bb], [br - t / 2, m0 + s.module / 2, bb], B, `${p.name}.crt.r`);
    box(g, [br - bl, s.module, t], [x, m0 + s.module / 2, bt - t], B, `${p.name}.crt.t`);
    box(g, [br - bl, s.module, t], [x, m0 + s.module / 2, bb], B, `${p.name}.crt.b`);
    box(g, [br - bl, t, bt - bb], [x, m0 + s.module - t / 2, bb], B, `${p.name}.crt.back`);
    // the glass's rim: a rounded rectangle; each rim point sits on the sphere, and the bezel meets
    // it there, sloping forward to the bezel's outer edge along the ray from the face's centre
    const r = s.corner;
    /** @type {number[][]} */
    const rim = [];
    const ARC = 8;
    for (const [cx, cz, a0] of [[fw / 2 - r, fh / 2 - r, 0], [-(fw / 2 - r), fh / 2 - r, 90], [-(fw / 2 - r), -(fh / 2 - r), 180], [fw / 2 - r, -(fh / 2 - r), 270]])
      for (let i = 0; i <= ARC; i++) {
        const a = ((a0 + (90 * i) / ARC) * Math.PI) / 180;
        rim.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
      }
    /** @type {number[]} */
    const verts = [];
    for (const [u, v] of rim) {
      // the inner edge, a hair in front of the glass so the two never fight
      verts.push(fx + u, apexY + (u * u + v * v) / (2 * R) - 0.5, fz + v);
      const k = Math.min(u > 0 ? (br - fx) / u : u < 0 ? (bl - fx) / u : Infinity, v > 0 ? (bt - fz) / v : v < 0 ? (bb - fz) / v : Infinity);
      verts.push(fx + u * k, m0, fz + v * k);
    }
    const n = rim.length;
    /** @type {number[]} */
    const index = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      index.push(2 * i, 2 * j, 2 * i + 1, 2 * j, 2 * j + 1, 2 * i + 1);
    }
    const geo = new THREE.BufferGeometry();
    /** @type {number[]} */
    const xyz = [];
    for (let i = 0; i < verts.length; i += 3) xyz.push(verts[i] / 1000, verts[i + 2] / 1000, -verts[i + 1] / 1000);
    geo.setAttribute("position", new THREE.Float32BufferAttribute(xyz, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const bezelMat = mat(B).clone();
    bezelMat.side = THREE.DoubleSide;
    bezelMat.roughness = 0.45;
    const bezel = new THREE.Mesh(geo, bezelMat);
    bezel.name = `${p.name}.bezel`;
    g.add(bezel);

    // the control panel: a black box on metal feet, set back from the front, its knobs and switch
    // standing out to the housing's front
    const [pl, pr, pt, pb, setback, pd] = s.panel;
    const p0 = front + setback;
    const pz = top - pb;
    const cz = top - (pt + pb) / 2;
    box(g, [pr - pl, pd, pb - pt], [left + (pl + pr) / 2, p0 + pd / 2, pz], "panel", `${p.name}.panel`);
    const floorZ = z + t;
    for (const fxp of [pl + 25, pr - 25]) for (const fyp of [25, pd - 25]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, (pz - floorZ) / 1000, 10), mat("metal"));
      foot.position.copy(v3(left + fxp, p0 + fyp, (pz + floorZ) / 2));
      foot.name = `${p.name}.foot`;
      g.add(foot);
    }
    const [kr, kout] = s.knob;
    for (const [i, k] of s.knobs.entries()) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(kr / 1000, (kr + 1) / 1000, kout / 1000, 20), mat("metal"));
      knob.rotation.x = Math.PI / 2;
      knob.position.copy(v3(left + k, p0 - kout / 2, cz));
      knob.name = `${p.name}.knob.${i}`;
      g.add(knob);
    }
    const [lx, lw, lh] = s.logo;
    box(g, [lw, 1, lh], [left + lx, p0 - 0.5, cz - lh / 2], "paper", `${p.name}.logo`);
    // the power switch: a red bat-handle lever in the slot of a small upright metal plate
    box(g, [11, 2, 24], [left + s.switch, p0 - 1, cz - 12], "metal", `${p.name}.switch.plate`);
    box(g, [3, 2.2, 14], [left + s.switch, p0 - 1, cz - 7], "panel", `${p.name}.switch.slot`);
    // the bat's profile, pivot to tip (mm): a thin neck swelling to a rounded end
    const bat = [[0, 0], [1.2, 0], [1.3, 5], [2.2, 10.5], [2.7, 12.8], [2.6, 14], [2, 14.8], [1, 15.2], [0, 15.3]].map(([r0, l]) => new THREE.Vector2(r0 / 1000, l / 1000));
    const lever = new THREE.Mesh(new THREE.LatheGeometry(bat, 14), mat("switchRed"));
    // pointing out of the panel, tipped up: switched on
    lever.rotation.x = Math.PI / 2 - 0.3;
    lever.position.copy(v3(left + s.switch, p0, cz + 2));
    lever.name = `${p.name}.switch`;
    g.add(lever);

    // the nameplate, standing on two posts
    const [nl, nx, nh, ngap] = s.nameplate;
    const plateX = left - nx + nl / 2;
    const plate = box(g, [nl, 24, nh], [plateX, front + 14, top + ngap], "panel", `${p.name}.nameplate`);
    const label = nameplateTexture();
    if (label) plate.material = [mat("panel"), mat("panel"), mat("panel"), mat("panel"), new THREE.MeshStandardMaterial({ map: label, roughness: 0.6 }), mat("panel")];
    for (const sgn of [-1, 1]) box(g, [30, 14, ngap], [plateX + sgn * (nl / 2 - 60), front + 14, top], "panel", `${p.name}.post.${sgn < 0 ? "l" : "r"}`);
    // vents and a groove down each side
    const [nv, v0, v1, vt, vb] = s.vents;
    for (const side of [-1, 1]) {
      const sx = x + side * (w / 2 + 1);
      for (let i = 0; i < nv; i++) box(g, [2, 8, vb - vt], [sx, front + v0 + ((v1 - v0) * i) / (nv - 1), top - vb], "panel", `${p.name}.vent.${side < 0 ? "l" : "r"}.${i}`);
      box(g, [2, 3, h], [sx, front + s.groove, z], "panel", `${p.name}.groove.${side < 0 ? "l" : "r"}`);
    }
    // the tube, last: the cutaway removes parts made above
    if (s.tube) tube = crtTube(p, g, s.tube, { fx, fz, apexY, R, rim, m0 });
  }

  /**
   * A console box whose top slopes down to the front (NCSU's photographs; R18): a dark brown body, a metal
   * top plate with a grey panel inset, and what sits on the panel. The function switch box: 16
   * white keys in a 4 x 4 grid, the last column set apart, and the PULSE 1 button alone above the
   * second column. The dial box: six dials in three rows of two, each a silver base under a black
   * knob.
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function wedgeBox(p, g) {
    const [w, d, hb] = /** @type {number[]} */ (p.box);
    const hf = /** @type {number} */ (p.wedge);
    const [x, y, z] = p.at;
    // the body: a box with its top front edge lowered
    const geo = new THREE.BoxGeometry(w / 1000, hb / 1000, d / 1000);
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0 && pos.getZ(i) > 0) pos.setY(i, (hf - hb / 2) / 1000);
    geo.computeVertexNormals();
    const body = new THREE.Mesh(geo, mat("boxBrown"));
    body.position.copy(v3(x, y, z + hb / 2));
    body.name = `${p.name}.body`;
    g.add(body);
    // the top: a frame of its own, tilted toward the operator
    const top = new THREE.Group();
    top.position.copy(v3(x, y, z + (hf + hb) / 2));
    top.rotation.x = Math.atan2(hb - hf, d);
    top.name = `${p.name}.top`;
    g.add(top);
    const L = Math.hypot(d, hb - hf);
    box(top, [w, L, 2], [0, 0, 0], "metal", `${p.name}.plate`);
    box(top, [w - 14, L - 14, 1], [0, 0, 2], "boxTop", `${p.name}.panel`);
    if (p.name === "console.fns") {
      const cols = [-45, -19, 7, 45];
      const pitch = (L - 50) / 4;
      /** @param {number} cx @param {number} ry @param {string} name */
      const key = (cx, ry, name) => {
        const k = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.006, 0.012, 14), mat("paper"));
        k.position.copy(v3(cx, ry, 3 + 6));
        k.name = name;
        top.add(k);
      };
      key(cols[1], 2 * pitch, `${p.name}.pulse1`);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) key(cols[c], (1 - r) * pitch, `${p.name}.key.${r * 4 + c}`);
    }
    if (p.name === "console.dials") {
      for (let i = 0; i < 6; i++) {
        // three rows of two, front to back
        const cx = ((i % 2) * 2 - 1) * 34;
        const ry = (1 - Math.floor(i / 2)) * 64;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.01, 24), mat("metal"));
        base.position.copy(v3(cx, ry, 3 + 5));
        base.name = `${p.name}.base.${i}`;
        top.add(base);
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.013, 0.018, 18), mat("knobBlack"));
        knob.position.copy(v3(cx, ry, 13 + 9));
        knob.name = `${p.name}.knob.${i}`;
        // its pointer: a white mark across the top, turned with the dial
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0012, 0.0095), mat("ttyKey"));
        mark.position.set(0, 0.0095, -0.005);
        mark.name = `${p.name}.knob.${i}.mark`;
        knob.add(mark);
        top.add(knob);
      }
    }
  }

  /**
   * The tube inside the CRT module, for the cutaway (hidden until shown): the glass funnel from
   * the face's rim to the neck, the electron gun in the neck, the deflection yoke round the neck
   * where it meets the funnel. No GDS1 tube is documented beyond "21-inch rectangular"; this is a
   * typical magnetic-deflection tube of the period, drawn to teach, not measured.
   * @param {PartDef} p
   * @param {THREE.Group} g
   * @param {number[]} t length, neck radius, neck length, yoke radius, yoke length
   * @param {{ fx: number; fz: number; apexY: number; R: number; rim: number[][]; m0: number }} at
   * @returns {Tube}
   */
  function crtTube(p, g, t, at) {
    const [len, nr, nl, yr, yl] = t;
    const { fx, fz, apexY, R, rim } = at;
    const group = new THREE.Group();
    group.name = `${p.name}.tube`;
    group.visible = false;
    g.add(group);
    const neck0 = apexY + len - nl;
    const glass = new THREE.MeshStandardMaterial({ color: "#6f8796", transparent: true, opacity: 0.09, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const edge = new THREE.LineBasicMaterial({ color: "#9fb6c6", transparent: true, opacity: 0.45 });
    /** @param {THREE.Object3D} o @param {string} name */
    const named = (o, name) => {
      o.name = `${p.name}.tube.${name}`;
      o.userData = { confidence: "est" };
      parts.set(o.name, o);
      return o;
    };
    // the funnel: rings from the face's rounded rim to the neck's circle
    const K = 14;
    /** @type {number[]} */
    const pos = [];
    for (let k = 0; k <= K; k++) {
      const e = k / K;
      for (const [u, v] of rim) {
        const a = Math.atan2(v, u);
        const x = u * (1 - e) + nr * Math.cos(a) * e;
        const z = v * (1 - e) + nr * Math.sin(a) * e;
        const y0 = apexY + (u * u + v * v) / (2 * R) + 4;
        const y = y0 + (neck0 - y0) * (1 - (1 - e) ** 1.4);
        const q = v3(fx + x, y, fz + z);
        pos.push(q.x, q.y, q.z);
      }
    }
    const n = rim.length;
    /** @type {number[]} */
    const idx = [];
    for (let k = 0; k < K; k++)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        idx.push(k * n + i, (k + 1) * n + i, k * n + j, k * n + j, (k + 1) * n + i, (k + 1) * n + j);
      }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    // its outline: a few rings and the lines from the corners to the neck, so the glass reads as glass
    /** @type {number[]} */
    const lines = [];
    const P = (/** @type {number} */ k, /** @type {number} */ i) => [pos[(k * n + i) * 3], pos[(k * n + i) * 3 + 1], pos[(k * n + i) * 3 + 2]];
    for (const k of [0, 3, 7, K]) for (let i = 0; i < n; i++) lines.push(...P(k, i), ...P(k, (i + 1) % n));
    const ARCN = rim.length / 4;
    for (const i of [0, ARCN / 2, ARCN, ARCN * 1.5, ARCN * 2, ARCN * 2.5, ARCN * 3, ARCN * 3.5].map(Math.round)) for (let k = 0; k < K; k++) lines.push(...P(k, i % n), ...P(k + 1, i % n));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const outline = new THREE.LineSegments(lg, edge);
    outline.name = `${p.name}.tube.outline`;
    group.add(outline);
    group.add(named(new THREE.Mesh(fg, glass), "funnel"));
    // the neck, the gun in it, and the base with its pins
    /** @param {number} r0 @param {number} r1 @param {number} y0 @param {number} y1 @param {THREE.Material} m @param {number} [segs] */
    const tubeAlong = (r0, r1, y0, y1, m, segs = 20) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r1 / 1000, r0 / 1000, (y1 - y0) / 1000, segs, 1, m === glass), m);
      c.rotation.x = -Math.PI / 2;
      c.position.copy(v3(fx, (y0 + y1) / 2, fz));
      return c;
    };
    group.add(named(tubeAlong(nr, nr, neck0, neck0 + nl, glass), "neck"));
    const metal = mat("metal");
    const gun = new THREE.Group();
    named(gun, "gun");
    const gEnd = neck0 + nl - 12;
    for (const [r0, y0, y1] of [[9, gEnd - 14, gEnd - 4], [10, gEnd - 30, gEnd - 18], [12, gEnd - 75, gEnd - 36], [12, gEnd - 105, gEnd - 82]]) gun.add(tubeAlong(r0, r0, y0, y1, metal, 16));
    const heater = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8), new THREE.MeshBasicMaterial({ color: "#ff8a3d" }));
    heater.position.copy(v3(fx, gEnd - 2, fz));
    gun.add(heater);
    group.add(gun);
    group.add(named(tubeAlong(nr + 2, nr + 2, neck0 + nl, neck0 + nl + 14, mat("knobBlack")), "base"));
    // the yoke: two pairs of coils in a flared ring round the neck, where the beam bends
    const yokeProfile = [[nr + 2, yl], [nr + 2, 0], [yr * 0.75, 0], [yr, yl * 0.7], [yr, yl]].map(([r0, l]) => new THREE.Vector2(r0 / 1000, l / 1000));
    const yoke = new THREE.Mesh(new THREE.LatheGeometry(yokeProfile, 28), new THREE.MeshStandardMaterial({ color: "#b06a35", roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
    // the lathe's axis is +Y (up); turn it to point back along the tube, its flare toward the face
    yoke.rotation.x = Math.PI / 2;
    const yokeFront = neck0 - yl * 0.55;
    yoke.position.copy(v3(fx, yokeFront + yl, fz));
    group.add(named(yoke, "yoke"));
    const bend = v3(fx, yokeFront + yl * 0.45, fz);
    // the cutaway: the left side, the top (but a strip at the front) and the back, of the housing
    // and of the CRT module
    const cut = ["body.l", "crt.l", "groove.l", "body.t", "body.back", "crt.t", "crt.back"].map((k) => g.getObjectByName(`${p.name}.${k}`)).filter((o) => o !== undefined);
    g.traverse((o) => {
      if (o.name.startsWith(`${p.name}.vent.l.`)) cut.push(o);
    });
    return {
      group,
      cut: /** @type {THREE.Object3D[]} */ (cut),
      gun: v3(fx, gEnd - 105, fz),
      bend,
      spot: (x, y) => {
        const u = x * 25.4;
        const v = y * 25.4;
        return v3(fx + u, apexY + (u * u + v * v) / (2 * R), fz + v);
      },
    };
  }

  /** "ADAGE GRAPHICS TERMINAL", white on black; null without a DOM canvas (Node). */
  function nameplateTexture() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 84;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = palette.panel;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
    // the words centred, as wide as fits inside the border with a margin
    ctx.fillStyle = "#f2f2f2";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    let px = 52;
    ctx.font = `bold ${px}px Helvetica, Arial, sans-serif`;
    const room = c.width - 120;
    const wide = ctx.measureText("ADAGE GRAPHICS TERMINAL").width;
    if (wide > room) {
      px = Math.floor((px * room) / wide);
      ctx.font = `bold ${px}px Helvetica, Arial, sans-serif`;
    }
    ctx.fillText("ADAGE GRAPHICS TERMINAL", c.width / 2, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /**
   * FNS1's two foot pedals. The manuals say only that there are two and that they read like the
   * function keys (SRM5 FNS1): on/off switches, not the continuous levers of a piano or the linked
   * rudder bar of an aircraft. No photo shows them, so they are drawn as the industrial foot
   * switches of the period: each a low housing loose on the floor, with a treadle hinged at the
   * heel that the ball of the foot presses down, and its cord (R18).
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function pedals(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const pw = (w - 90) / 2;
    for (const [i, s] of [-1, 1].entries()) {
      const px = x + s * (w - pw) / 2;
      const side = i ? "right" : "left";
      // the housing: a low cast base, a little narrower at the top
      box(g, [pw, d, 22], [px, y, z], "ttyDark", `${p.name}.${side}.base`);
      // the treadle: hinged at the heel (the operator's end), its toe raised, with ribs for grip
      const rise = h - 22 - 6;
      const L = Math.hypot(d - 20, rise);
      const tread = new THREE.Group();
      tread.position.copy(v3(px, y - (d - 20) / 2, z + 22));
      tread.rotation.x = Math.atan2(rise, d - 20);
      tread.name = `${p.name}.${side}.treadle`;
      g.add(tread);
      box(tread, [pw - 16, L, 6], [0, L / 2, 0], "metal", `${p.name}.${side}.plate`);
      for (let r = 0; r < 6; r++) box(tread, [pw - 36, 6, 3], [0, 30 + r * ((L - 60) / 5), 6], "ttyDark", `${p.name}.${side}.rib.${r}`);
      // the hinge, and a guard at the toe so the pedal is not pressed by accident
      box(g, [pw - 10, 14, 10], [px, y - d / 2 + 12, z + 22], "metal", `${p.name}.${side}.hinge`);
      box(g, [pw, 10, h - 22], [px, y + d / 2 - 5, z + 22], "ttyDark", `${p.name}.${side}.guard`);
      // the cord, back toward the desk
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 6), mat("ttyDark"));
      cord.rotation.x = Math.PI / 2;
      cord.position.copy(v3(px, y + d / 2 + 125, z + 4));
      cord.name = `${p.name}.${side}.cord`;
      g.add(cord);
    }
  }

  /**
   * The Teletype ASR-33 on its stand. The parts and their proportions were measured from a 3D
   * Warehouse model by Comugi ("Teletype ASR-33 (USA:1963)"), used only as a reference: nothing of
   * it is copied. That model is about 1.4 times too big, so each axis is scaled to the documented
   * size on the stand, 22 in wide, 18.5 in deep and 34 in high without the paper (ASR33; R17). The shapes are built in the reference's own millimetres (ASR33_REF), inside a group
   * scaled to the params' box.
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function asr33(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const R = ASR33_REF;
    const m = new THREE.Group();
    m.name = `${p.name}.ref`;
    m.position.copy(v3(x, y, z));
    // the params' x, z (up), y (depth) to three.js x, y, z
    m.scale.set(w / R.size[0], h / R.size[2], d / R.size[1]);
    g.add(m);
    // the reference's frame: x from -400 (left) to 400, y from -300 (front) to 300, z up from the floor
    /** @param {number[]} lo @param {number[]} hi @param {string} material @param {string} name */
    const blk = (lo, hi, material, name) => box(m, [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]], material, `${p.name}.${name}`);
    /**
     * A prism whose side profile (y, z points, the reference's mm) runs across x0..x1.
     * @param {number[][]} profile @param {number} x0 @param {number} x1 @param {string} material @param {string} name
     */
    const prism = (profile, x0, x1, material, name) => {
      const shape = new THREE.Shape(profile.map(([py, pz]) => new THREE.Vector2(py / 1000, pz / 1000)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: (x1 - x0) / 1000, bevelEnabled: false });
      // turned a quarter about y, the shape's x becomes three.js -z (the params' +y) and the extrusion runs along x
      geo.rotateY(Math.PI / 2);
      geo.translate(x0 / 1000, 0, 0);
      const mesh = new THREE.Mesh(geo, mat(material));
      mesh.name = `${p.name}.${name}`;
      m.add(mesh);
      return mesh;
    };
    /**
     * A cylinder lying along x, or standing (axis "z").
     * @param {number} r @param {number} len @param {number[]} c centre @param {string} material @param {string} name @param {"x" | "z" | "y"} [axis]
     */
    const cyl = (r, len, c, material, name, axis = "x") => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r / 1000, r / 1000, len / 1000, 16), mat(material));
      mesh.position.copy(v3(c[0], c[1], c[2]));
      if (axis === "x") mesh.rotation.z = Math.PI / 2;
      if (axis === "y") mesh.rotation.x = Math.PI / 2;
      mesh.name = `${p.name}.${name}`;
      m.add(mesh);
      return mesh;
    };

    // the stand: two feet reaching forward, a pedestal leaning toward the operator (open between
    // its legs at the bottom), and a top plate
    for (const [i, fx] of R.feet.entries()) blk([fx - 25, -280, 0], [fx + 25, 300, 50], "ttyStand", `stand.foot.${i}`);
    const lean = (/** @type {number} */ zz) => R.pedestal.front0 + ((R.pedestal.front1 - R.pedestal.front0) * (zz - 50)) / (R.pedestal.top - 50);
    const prof = (/** @type {number} */ z0) => [[lean(z0), z0], [R.pedestal.back, z0], [R.pedestal.back, R.pedestal.top], [lean(R.pedestal.top), R.pedestal.top]];
    const [px0, px1] = R.pedestal.x;
    prism(prof(R.pedestal.arch), px0 + 50, px1 - 50, "ttyStand", "stand.pedestal");
    prism(prof(50), px0, px0 + 50, "ttyStand", "stand.leg.l");
    prism(prof(50), px1 - 50, px1, "ttyStand", "stand.leg.r");
    blk([-275, -280, R.pedestal.top], [395, 300, R.base[0]], "ttyStand", "stand.top");

    // the machine: its base, the keyboard's sloping nose, the deck under the type cover, the
    // right shoulder, the paper well behind, the reader and punch deck on the left
    const [b0, b1] = R.base;
    blk([-400, -300, b0], [400, 300, b1], "tty", "base");
    const nose = R.nose;
    prism([[-300, b1], [-300, nose.front], [nose.back, nose.top], [nose.back, b1]], -396, 396, "tty", "keyboard.nose");
    blk([-400, nose.back, b1], [400, 300, R.deck], "tty", "deck");
    blk([R.cover.x[1], nose.back, R.deck], [400, 163, R.shoulder], "tty", "shoulder");
    blk([R.cover.x[1] + 6, nose.back + 20, R.shoulder], [380, 140, R.shoulder + 2], "ttyStand", "shoulder.panel");
    blk([R.cover.x[0], R.cover.y[1], R.deck], [R.cover.x[1], 300, R.well], "tty", "well");
    blk([-300, 246, R.well], [400, 300, R.back], "tty", "back");
    blk([-400, 127, R.deck], [-390, 300, R.shoulder], "tty", "wall.left");
    // the type cover over the printer, its top rounded at the front, with the window over the line
    const [cy0, cy1] = R.cover.y;
    const ct = R.cover.top;
    const round = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      round.push([cy0 + 30 - 30 * Math.cos(a), ct - 30 + 30 * Math.sin(a)]);
    }
    prism([[cy0, R.deck], ...round, [cy1, ct], [cy1, R.deck]], R.cover.x[0], R.cover.x[1], "ttyCover", "cover");
    blk([R.cover.x[0] + 70, cy0 + 40, ct], [R.cover.x[1] - 70, cy0 + 150, ct + 1], "ttyDark", "cover.window");
    blk([-226, cy0 - 3, 937], [-142, cy0, 976], "ttyDark", "cover.logo");
    cyl(12, 30, [R.cover.x[0] - 15, -10, 960], "ttyDark", "platen.knob");
    // the paper: the roll behind the cover, the sheet rising from the platen
    cyl(R.roll.r, R.roll.len, R.roll.c, "paper", "paper");
    blk([R.roll.c[0] - 160, 60, R.well], [R.roll.c[0] + 160, 64, 1060], "paper", "paper.sheet");
    // the keyboard: four rows of round keys on the slope, and the space bar
    const keys = [];
    for (const [ky, n, xa, xb, top, dia] of R.keys) {
      // each row stands on the nose's slope
      const under = nose.front + ((nose.top - nose.front) * (ky + 300)) / (nose.back + 300);
      const hgt = Math.max(8, top - under + 6);
      for (let i = 0; i < n; i++) {
        const kx = xa + dia / 2 + ((xb - xa - dia) * i) / (n - 1);
        const k = new THREE.CylinderGeometry(dia / 2000, dia / 2000, hgt / 1000, 12);
        k.translate(kx / 1000, (under + hgt / 2) / 1000, -ky / 1000);
        keys.push(k);
      }
    }
    const kb = new THREE.Mesh(mergeGeometries(keys), mat("ttyKey"));
    kb.name = `${p.name}.keyboard`;
    m.add(kb);
    blk([-70, -278, 846], [40, -266, 856], "ttyKey", "keyboard.space");
    // the tape reader at the front left (its START / STOP / FREE lever), the tape, the punch with
    // its four buttons (ON, OFF, REL, B.SP), and the reel of blank tape at the back
    blk([-380, -265, 856], [-348, -217, 874], "ttyKey", "reader.lever");
    blk([-347, nose.back, R.deck], [-322, 20, R.deck + 3], "paper", "tape");
    blk([-382, -117, R.deck], [-300, 3, 937], "ttyKey", "punch");
    for (let i = 0; i < 4; i++) cyl(5, 10, [-362 + (i % 2) * 40, -85 + Math.floor(i / 2) * 50, 942], "ttyDark", `punch.button.${i}`, "z");
    cyl(52, 25, [-335, 192, 926], "paper", "reel");
    cyl(10, 8, [303, -302, 832], "ttyDark", "knob", "y");
  }

  /**
   * A cabinet of the period (NCSU's photographs; R16): a black frame (sides, top and a recessed plinth)
   * holding a stack of front panels with thin dark gaps between them, most of them off-white, a
   * few black, some with vents. The DPR-2's operator panel has its lamps, the array's panel its
   * window onto the multipliers. A reading of the photographs, not a measurement (R16).
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function cabinet(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const front = y - d / 2;
    const plinth = 90;
    const cap = 50;
    // the frame: the body set back a little, the plinth set back more
    box(g, [w, d - 10, h - plinth], [x, y + 5, z + plinth], "rackBlack", `${p.name}.body`);
    box(g, [w - 40, d - 60, plinth], [x, y + 20, z], "rackBlack", `${p.name}.plinth`);
    const fw = w - 50;
    const panels = p.front ?? [["rackWhite", 0]];
    let top = z + h - cap;
    const bottom = z + plinth + 10;
    panels.forEach(([style, ph], i) => {
      const hh = i === panels.length - 1 || !ph ? top - bottom : ph;
      const pz = top - hh;
      frontPanel(g, p.name, i, style, x, front, fw, pz + 2, hh - 4);
      top = pz;
    });
  }

  /**
   * One front panel of a cabinet, its bottom at z.
   * @param {THREE.Group} g @param {string} name @param {number} i @param {string} style
   * @param {number} x @param {number} front @param {number} w @param {number} z @param {number} h
   */
  function frontPanel(g, name, i, style, x, front, w, z, h) {
    const id = `${name}.panel.${i}`;
    const dark = style === "black" || style === "lamps" || style === "avg";
    box(g, [w, 8, h], [x, front - 4, z], dark ? "rackPanel" : "rackWhite", id);
    const face = front - 8;
    if (style === "vent") for (let k = 0; k < 7; k++) box(g, [w - 120, 2, 8], [x, face - 1, z + h * 0.2 + (k * h * 0.6) / 6], "rackBlack", `${id}.slot.${k}`);
    if (style === "drawer") box(g, [w * 0.35, 18, 14], [x, face - 9, z + h - 40], "metal", `${id}.handle`);
    if (style === "switches") for (let k = 0; k < 12; k++) box(g, [10, 16, 22], [x - w / 2 + 60 + (k * (w - 120)) / 11, face - 8, z + h / 2 - 11], "metal", `${id}.switch.${k}`);
    if (style === "meters") {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), mat("rackPanel"));
        m.rotation.x = Math.PI / 2;
        m.position.copy(v3(x + s * w * 0.22, face - 5, z + h * 0.55));
        m.name = `${id}.meter.${s < 0 ? "l" : "r"}`;
        g.add(m);
        box(g, [60, 2, 36], [x + s * w * 0.22, face - 11, z + h * 0.55 - 10], "paper", `${id}.dial.${s < 0 ? "l" : "r"}`);
      }
      box(g, [30, 20, 50], [x, face - 10, z + h * 0.3], "switchRed", `${id}.breaker`);
    }
    if (style === "avg") for (let k = 0; k < 4; k++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), mat("metal"));
      knob.rotation.x = Math.PI / 2;
      knob.position.copy(v3(x - 150 + k * 100, face - 10, z + h / 2));
      knob.name = `${id}.knob.${k}`;
      g.add(knob);
    }
    if (style === "lamps") {
      // the DPR-2's operator panel: 30 lamps showing AR in groups of three, the 30 toggles of the
      // PRI instruction register below them, and the RUN, HALT, STEP and other buttons
      const span = w - 100;
      const at = (/** @type {number} */ k) => x - span / 2 + (k + Math.floor(k / 3) * 0.6) * (span / (29 + 9 * 0.6));
      for (let k = 0; k < 30; k++) {
        const lamp = box(g, [11, 8, 11], [at(k), face - 4, z + h * 0.72], "lampOff", `${name}.lamp.${String(k).padStart(2, "0")}`);
        lamp.material = new THREE.MeshStandardMaterial({ color: palette.lampOff, emissive: palette.lampOn, emissiveIntensity: 0 });
        lamps.push(lamp);
        box(g, [6, 12, 16], [at(k), face - 6, z + h * 0.45], "metal", `${name}.toggle.${String(k).padStart(2, "0")}`);
      }
      for (let k = 0; k < 6; k++) box(g, [40, 14, 26], [x - 150 + k * 60, face - 7, z + h * 0.12], "rackWhite", `${name}.button.${k}`);
    }
    if (style === "array") {
      // a window onto the twelve MDAC cards, 4 x 3: blue the nine rotation ones, orange the three scales
      box(g, [w - 60, 2, h - 60], [x, face - 1, z + 30], "rackBlack", `${id}.window`);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) box(g, [110, 8, (h - 120) / 3 - 20], [x - 195 + c * 130, face - 5, z + 50 + (2 - r) * ((h - 120) / 3 + 10)], c < 3 ? "digital" : "analog", `rack.array.mdac.${r}${c}`);
    }
  }

  /**
   * A 7-track tape drive as in NCSU's photographs (R16): a silver frame, a dark control strip
   * across the top (a power rocker and the mode knobs), and a glass door in a silver frame over the
   * two reels, the head and the vacuum columns; a black panel and plinth below.
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function tapeDrive(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const front = y - d / 2;
    box(g, [w, d - 10, h - 90], [x, y + 5, z + 90], "metal", `${p.name}.body`);
    box(g, [w - 40, d - 60, 90], [x, y + 20, z], "rackBlack", `${p.name}.plinth`);
    const face = front - 8;
    // the control strip
    const sTop = z + h - 40;
    box(g, [w - 40, 8, 200], [x, front - 4, sTop - 200], "rackPanel", `${p.name}.controls`);
    box(g, [26, 14, 44], [x - w / 2 + 90, face - 7, sTop - 120], "rackWhite", `${p.name}.power`);
    for (let k = 0; k < 3; k++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.025, 14), mat("metal"));
      knob.rotation.x = Math.PI / 2;
      knob.position.copy(v3(x - 90 + k * 140, face - 12, sTop - 100));
      knob.name = `${p.name}.knob.${k}`;
      g.add(knob);
    }
    // the door: a silver frame, the deck behind the glass with its reels, head and columns
    const dTop = sTop - 220;
    const dBot = z + 560;
    const dh = dTop - dBot;
    box(g, [w - 40, 6, dh], [x, front - 3, dBot], "trim", `${p.name}.deck`);
    for (const [k, rz] of [dBot + dh * 0.72, dBot + dh * 0.28].entries()) {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 24), mat("rackPanel"));
      reel.rotation.x = Math.PI / 2;
      reel.position.copy(v3(x - 120, front - 20, rz));
      reel.name = `${p.name}.reel.${k}`;
      g.add(reel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), mat("metal"));
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(v3(x - 120, front - 24, rz));
      hub.name = `${p.name}.hub.${k}`;
      g.add(hub);
    }
    box(g, [70, 30, 130], [x + 70, front - 18, dBot + dh / 2 - 65], "rackWhite", `${p.name}.head`);
    for (const k of [0, 1]) box(g, [50, 4, dh - 120], [x + 170 + k * 70, front - 8, dBot + 60], "rackBlack", `${p.name}.column.${k}`);
    const glass = new THREE.Mesh(new THREE.BoxGeometry((w - 60) / 1000, (dh - 20) / 1000, 0.006), new THREE.MeshStandardMaterial({ color: palette.glass, transparent: true, opacity: 0.18, roughness: 0.1 }));
    glass.position.copy(v3(x, front - 42, dBot + dh / 2));
    glass.name = `${p.name}.glass`;
    // keeps its own transparency when the view highlights or fades parts
    glass.userData.glass = true;
    g.add(glass);
    for (const [k, [fw, fh, fx, fz]] of [[w - 40, 26, 0, dTop - 13], [w - 40, 26, 0, dBot - 13], [26, dh, -(w - 66) / 2, dBot], [26, dh, (w - 66) / 2, dBot]].entries()) box(g, [fw, 16, fh], [x + fx, front - 46, fz], "metal", `${p.name}.frame.${k}`);
    box(g, [12, 20, 120], [x + (w - 100) / 2, front - 60, dBot + dh / 2 - 60], "metal", `${p.name}.handle`);
    // below: a black panel with vents
    box(g, [w - 40, 8, dBot - z - 120], [x, front - 4, z + 100], "rackPanel", `${p.name}.lower`);
    for (let k = 0; k < 6; k++) box(g, [w - 200, 2, 8], [x, face - 1, z + 180 + k * 50], "rackBlack", `${p.name}.slot.${k}`);
  }

  /**
   * A removable-pack disk drive, loaded from the top: an off-white cabinet on a black plinth, a
   * dark lid over the pack, a control strip with its lamps at the top of the front.
   * @param {PartDef} p
   * @param {THREE.Group} g
   */
  function diskDrive(p, g) {
    const [w, d, h] = /** @type {number[]} */ (p.box);
    const [x, y, z] = p.at;
    const front = y - d / 2;
    box(g, [w, d, h - 80], [x, y, z + 80], "rackWhite", `${p.name}.body`);
    box(g, [w - 40, d - 40, 80], [x, y, z], "rackBlack", `${p.name}.plinth`);
    box(g, [w - 60, d - 120, 20], [x, y + 30, z + h], "rackPanel", `${p.name}.lid`);
    box(g, [160, 30, 16], [x, y - d / 2 + 90, z + h + 20], "metal", `${p.name}.lid.handle`);
    box(g, [w - 40, 8, 120], [x, front - 4, z + h - 150], "rackPanel", `${p.name}.controls`);
    ["lampOff", "lampOff", "lampOff"].forEach((m, k) => box(g, [24, 8, 16], [x - 180 + k * 60, front - 12, z + h - 92], m, `${p.name}.lamp.${k}`));
    box(g, [50, 14, 34], [x + 170, front - 15, z + h - 108], "rackWhite", `${p.name}.start`);
    for (let k = 0; k < 5; k++) box(g, [w - 160, 2, 8], [x, front - 1, z + 160 + k * 45], "rackBlack", `${p.name}.slot.${k}`);
  }

  /**
   * The few details that say what a box is.
   * @param {PartDef} p
   * @param {THREE.Group} g
   * @param {THREE.Mesh} body
   */
  function details(p, g, body) {
    const [x, y, z] = p.at;
    if (p.name === "console.joystick") {
      // a low flat box with a thin stick in the middle of its top (NCSU's photographs; R18): the stick
      // stands 1.3 times the box's height, a rod swelling a little to a rounded head
      const [, d, h] = /** @type {number[]} */ (p.box);
      const L = 1.3 * h;
      const sx = x;
      const sy = y + 0.05 * d;
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.004, 16), mat("knobBlack"));
      boot.position.copy(v3(sx, sy, z + h + 2));
      boot.name = "console.joystick.boot";
      g.add(boot);
      const prof = [[0, 0], [3.4, 0], [3.5, 0.55], [4.4, 0.82], [5, 0.9], [4.9, 0.95], [4, 0.98], [2.2, 0.995], [0, 1]].map(([r, f]) => new THREE.Vector2(r / 1000, (f * L) / 1000));
      const stick = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), mat("metal"));
      stick.position.copy(v3(sx, sy, z + h));
      stick.name = "console.joystick.stick";
      g.add(stick);
    }
    void body;
  }

  /** @type {Map<string, THREE.Group>} */
  const cables = new Map();
  for (const c of params.cables) {
    const a = boxOf(params, c.from);
    const b = boxOf(params, c.to);
    if (!a || !b) continue;
    const pts = route(a, b, c.lead);
    const color = c.kind === "analog" ? palette.analog : palette.digital;
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.05, roughness: 0.6 });
    const g = new THREE.Group();
    g.name = c.name;
    g.userData = { from: c.from, to: c.to, kind: c.kind, activity: c.activity, points: pts, material };
    // one straight piece per run, with a ball at each bend
    for (let i = 0; i + 1 < pts.length; i++) {
      const len = pts[i].distanceTo(pts[i + 1]);
      if (len < 1e-6) continue;
      const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 6), material);
      piece.position.copy(pts[i]).add(pts[i + 1]).multiplyScalar(0.5);
      piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pts[i + 1].clone().sub(pts[i]).normalize());
      piece.name = `${c.name}.run.${i}`;
      g.add(piece);
      const bend = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), material);
      bend.position.copy(pts[i + 1]);
      bend.name = `${c.name}.bend.${i}`;
      g.add(bend);
    }
    root.add(g);
    cables.set(c.name, g);
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(params.room.w / 1000, params.room.d / 1000), new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.001, -1);
  floor.name = "room.floor";
  root.add(floor);

  return { root, parts, cables, lamps, face: /** @type {THREE.Mesh} */ (/** @type {unknown} */ (face)), materials, tube };
}

/**
 * A part's box in the params' millimetres: [minX, minY, minZ, maxX, maxY, maxZ].
 * @param {TerminalParams} params
 * @param {string} name
 * @returns {number[] | null}
 */
export function boxOf(params, name) {
  const p = params.parts.find((q) => q.name === name);
  if (!p) return null;
  const [x, y, z] = p.at;
  if (p.cylinder) {
    const [r, l] = p.cylinder;
    return [x - l / 2, y - r, z, x + l / 2, y + r, z + 2 * r];
  }
  if (!p.box) return null;
  const [w, d, h] = p.box;
  return [x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h];
}

/**
 * A cable's path between two boxes: from the side of one facing the other, down to the floor,
 * along it in right angles, and up into the other. A lead (params mm) replaces an end: the cable
 * leaves its connector along the lead's points and drops to the floor from the last one.
 * @param {number[]} a box: x0, y0, z0, x1, y1, z1
 * @param {number[]} b
 * @param {{ from?: number[][]; to?: number[][] }} [lead]
 * @returns {THREE.Vector3[]}
 */
export function route(a, b, lead) {
  const floor = 15;
  /** @param {number[]} p @param {number[]} q @returns {number[][]} the end's points, connector first */
  const end = (p, q) => {
    // leave at the side facing the other part, a little above the floor
    const x = (p[0] + p[3]) / 2;
    const yy = Math.min(p[4], Math.max(p[1], (q[1] + q[4]) / 2));
    return [[x, yy, Math.min(p[5], p[2] + 300)]];
  };
  const fa = lead?.from ?? end(a, b);
  const fb = lead?.to ?? end(b, a);
  const [ax, ay] = fa[fa.length - 1];
  const [bx, by] = fb[fb.length - 1];
  const my = (ay + by) / 2;
  /** @type {number[][]} */
  const pts = [...fa, [ax, ay, floor], [ax, my, floor], [bx, my, floor], [bx, by, floor], ...[...fb].reverse()];
  return pts.map(([px, py, pz]) => v3(px, py, pz));
}

/**
 * The ASR-33's parts, measured from the reference model (see asr33()), in its own millimetres:
 * x from -400 (left) to 400, y from -300 (front) to 300, z up from the floor. The machine is
 * scaled from `size` to the params' box.
 */
export const ASR33_REF = {
  /** the machine without its paper: 800 wide, 600 deep, 1000 high */
  size: [800, 600, 1000],
  /** the stand's feet, their centres across */
  feet: [-235, 355],
  /** the pedestal: across, its back, its front at the feet and at the top (it leans forward), the top, the arch between the legs */
  pedestal: { x: [-260, 380], back: 280, front0: 93, front1: 5, top: 730, arch: 200 },
  /** the machine's base: bottom and top */
  base: [756, 816],
  /** the keyboard's nose: its top at the front edge and at the back, where the deck starts */
  nose: { front: 845, top: 888, back: -137 },
  /** the deck under the cover, the right shoulder, the paper well, the back edge */
  deck: 888,
  shoulder: 988,
  well: 938,
  back: 954,
  /** the type cover */
  cover: { x: [-259, 229], y: [-137, 153], top: 1000 },
  /** the paper roll: radius, length, centre */
  roll: { r: 68, len: 319, c: [-15, 164, 974] },
  /** the key rows, front to back: centre y, keys, x from, x to, the keytops' height, diameter */
  keys: [
    [-236, 12, -186, 150, 860, 20],
    [-210, 14, -200, 197, 872, 20],
    [-181, 13, -207, 153, 883, 18],
    [-156, 13, -193, 167, 894, 18],
  ],
};
