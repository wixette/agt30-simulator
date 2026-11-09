// SPDX-License-Identifier: Apache-2.0
//
// The acceptance checks of the 3D installation, built from its params as the page builds it
// (D7). Every clearance check runs over all pairs of parts, never a hand-picked list
// (docs/conventions.md, Tests).

import * as THREE from "three";
import params from "../../params/terminal.json" with { type: "json" };
import { boxOf, buildTerminal, v3 } from "../scene/terminal3d.js";
import { equal, ok } from "./check.js";

/** @typedef {import("./check.js").Check} Check */
/** @typedef {import("../scene/terminal3d.js").TerminalParams} TerminalParams */

const P = /** @type {TerminalParams} */ (/** @type {unknown} */ (params));

/** The triangle budget of the whole installation (low poly, so that a laptop draws it easily). */
export const TRIANGLE_BUDGET = 30000;
/** Two parts closer than this overlap, mm: less is modelling noise. */
const OVERLAP_MM = 1;
/** A part stands on what is under it within this, mm. */
const SUPPORT_MM = 2;
/** A cable's end lies within this of its part's box, mm. */
const CABLE_END_MM = 30;
/** The usable picture: 12 x 12 in (SRM5 GDS1). */
const PICTURE_MM = 304.8;

/** Parts that rest on another part by design, and what they rest on. */
const RESTS_ON = /** @type {Record<string, string>} */ ({
  "console.scope": "console.desk",
  "console.fns": "console.desk",
  "console.dials": "console.desk",
  "console.joystick": "console.desk",
  "console.pen": "console.desk",
});

/** @type {ReturnType<typeof buildTerminal> | null} */
let cache = null;
/** The installation, built once for all the checks. */
const built = () => (cache ??= buildTerminal(P));

/**
 * @param {string} name
 * @returns {number[]}
 */
function box(name) {
  const b = boxOf(P, name);
  ok(b, `no box for ${name}`);
  return b;
}

/** @param {string} name */
const def = (name) => /** @type {any} */ (P.parts.find((q) => q.name === name));

/** @type {Check[]} */
export const SCENE_CHECKS = [
  {
    id: "SCN-1",
    title: `The whole installation is under ${TRIANGLE_BUDGET.toLocaleString("en")} triangles`,
    run() {
      let tris = 0;
      built().root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const g = /** @type {THREE.BufferGeometry} */ (o.geometry);
          tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
        }
      });
      ok(tris < TRIANGLE_BUDGET, `${Math.round(tris)} triangles`);
    },
  },
  {
    id: "SCN-2",
    title: "Every part and cable of the params is a named node, and no two names collide once the dots are removed (docs/conventions.md)",
    run() {
      const names = [...P.parts.map((p) => p.name), ...P.cables.map((c) => c.name)];
      for (const n of names) {
        ok(built().parts.has(n) || built().cables.has(n), `${n} is built`);
        ok(/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(n), `${n}: lower-case ASCII, dotted`);
      }
      const flat = names.map((n) => n.replace(/\./g, ""));
      equal(new Set(flat).size, flat.length, "names unique without their dots");
    },
  },
  {
    id: "SCN-3",
    title: "No two parts intersect, over all pairs, except those designed to rest on another, and the pedals stand in the desk's knee space",
    run() {
      const parts = P.parts.filter((p) => p.box || p.cylinder).map((p) => ({ name: p.name, b: box(p.name) }));
      /** @type {string[]} */
      const bad = [];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const [a, b] = [parts[i], parts[j]];
          if (RESTS_ON[a.name] === b.name || RESTS_ON[b.name] === a.name) continue;
          // the pedals sit under the desk's top, in the knee space: checked below
          if ([a.name, b.name].includes("console.desk") && [a.name, b.name].includes("console.pedals")) continue;
          if ([0, 1, 2].every((k) => Math.min(a.b[k + 3], b.b[k + 3]) - Math.max(a.b[k], b.b[k]) > OVERLAP_MM)) bad.push(`${a.name} / ${b.name}`);
        }
      const k = def("console.desk").desk;
      const desk = box("console.desk");
      const ped = box("console.pedals");
      const pedestalFront = desk[4] - k.pedestal[2] - k.pedestal[1];
      if (ped[0] < desk[0] + k.inset + k.post || ped[3] > desk[3] - k.inset - k.post || ped[4] > pedestalFront || ped[5] > desk[5] - k.top) bad.push("the pedals and the desk's posts, pedestal or top");
      ok(bad.length === 0, bad.join("; "));
    },
  },
  {
    id: "SCN-4",
    title: "Every part stands on the floor or on the part it rests on: nothing floats",
    run() {
      for (const p of P.parts) {
        const b = boxOf(P, p.name);
        if (!b) continue;
        const under = RESTS_ON[p.name];
        const floor = under ? box(under)[5] : 0;
        ok(Math.abs(b[2] - floor) <= SUPPORT_MM, `${p.name} at ${b[2]} mm, not ${floor}`);
      }
    },
  },
  {
    id: "SCN-5",
    title: "Each cable starts in the part it comes from and ends in the part it goes to (R19)",
    run() {
      for (const c of P.cables) {
        const pts = /** @type {THREE.Vector3[]} */ (built().cables.get(c.name)?.userData.points ?? []);
        ok(pts.length >= 2, `${c.name} has a path`);
        for (const [end, part] of /** @type {[THREE.Vector3, string][]} */ ([[pts[0], c.from], [pts[pts.length - 1], c.to]])) {
          const b = box(part);
          const d = new THREE.Box3(v3(b[0], b[4], b[2]), v3(b[3], b[1], b[5])).distanceToPoint(end) * 1000;
          ok(d <= CABLE_END_MM, `${c.name} misses ${part} by ${d.toFixed(0)} mm`);
        }
      }
    },
  },
  {
    id: "SCN-6",
    title: "The face shows the 12 x 12 in usable picture (SRM5 GDS1) on curved glass set behind the CRT module's bezel",
    run() {
      const face = built().face;
      const pos = face.geometry.getAttribute("position");
      const uv = face.geometry.getAttribute("uv");
      face.updateWorldMatrix(true, false);
      const pts = Array.from({ length: pos.count }, (_, i) => ({ p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(face.matrixWorld), u: uv.getX(i), v: uv.getY(i) }));
      /** millimetres per unit of a texture coordinate, along an axis */
      const span = (/** @type {"u" | "v"} */ k, /** @type {"x" | "y"} */ c) => {
        const a = pts.reduce((m, q) => (q[k] < m[k] ? q : m));
        const b = pts.reduce((m, q) => (q[k] > m[k] ? q : m));
        return (Math.abs(b.p[c] - a.p[c]) / (b[k] - a[k])) * 1000;
      };
      ok(Math.abs(span("u", "x") - PICTURE_MM) < 1, `picture width ${span("u", "x").toFixed(1)} mm`);
      ok(Math.abs(span("v", "y") - PICTURE_MM) < 1, `picture height ${span("v", "y").toFixed(1)} mm`);
      const g1 = def("console.scope").gds1;
      const seam = box("console.scope")[1] + g1.seam;
      const ys = pts.map((q) => -q.p.z * 1000);
      ok(Math.min(...ys) > seam, "the glass's apex is behind the bezel's front edge");
      ok(Math.max(...ys) < seam + g1.module, "the glass is inside the CRT module");
    },
  },
  {
    id: "SCN-7",
    title: "The tube fits the scope's cabinet, and the beam, bent at the yoke, reaches every corner of the picture inside the glass (R16, R20)",
    run() {
      const t = built().tube;
      ok(t, "a tube");
      const g1 = def("console.scope").gds1;
      const fd = def("console.scope.face");
      const seam = box("console.scope")[1] + g1.seam;
      ok(fd.at[1] + g1.tube[0] + 14 < seam + g1.module, "the tube ends inside the CRT module");
      const axis = t.spot(0, 0).clone().sub(t.bend);
      const angle = (/** @type {THREE.Vector3} */ p) => p.clone().sub(t.bend).angleTo(axis);
      const [fw, fh] = fd.plane;
      const r = g1.corner;
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ru = sx * (fw / 2 - r + r * Math.SQRT1_2);
        const rv = sy * (fh / 2 - r + r * Math.SQRT1_2);
        const rim = v3(fd.at[0] + ru, fd.at[1] + (ru * ru + rv * rv) / (2 * fd.radius), fd.at[2] + rv);
        ok(angle(rim) > angle(t.spot(6 * sx, 6 * sy)), `the corner (${sx}, ${sy}) is inside the funnel`);
      }
    },
  },
];
