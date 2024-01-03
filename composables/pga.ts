import Algebra from "ganja.js";
import {
  Mesh,
  MeshBasicMaterial,
  Plane,
  PlaneHelper,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
const PGA2D = Algebra({ p: 2, q: 0, r: 1, graded: false });
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: false });
// console.debug("In composable", PGA3D);
export interface GAElement {
  Dot(_: GAElement): GAElement;
  Sub(_: GAElement): GAElement;
  Add(_: GAElement): GAElement;
  Vee(_: GAElement): GAElement;
  Wedge(_: GAElement): GAElement;
  Mul(_: GAElement): GAElement;
  get Dual(): GAElement;
  get Normalized(): GAElement;
  get Reverse(): GAElement;
  get Length(): number;
  get VLength(): number; // infinity norm/vanishing norm
  get e0(): number;
  get e1(): number;
  get e2(): number;
  get e3(): number;
  get e01(): number;
  get e12(): number;
  get e13(): number;
  get e23(): number;
  get e012(): number;
  get e013(): number;
  get e023(): number;
  get e123(): number;
  set e01(_: number);
  set e02(_: number);
  set e03(_: number);
  set e12(_: number);
  set e013(_: number);
  set e023(_: number);
}

export function usePGA2D() {
  function makePoint(x: number, y: number) {
    const p = new PGA2D().nVector(1, 1, x, y).Dual;
    return p;
  }
  function makeDirection(dx: number, dy: number) {
    const d = new PGA2D().nVector(1, 0, dx, dy).Dual.Normalized;
    return d;
  }
  return { makePoint, makeDirection };
}

export function usePGA3D() {
  const ORIGIN = makePoint(0, 0, 0);

  function makeScalar(s: number): GAElement {
    return new PGA3D().nVector(0,s)
  }

  function makePoint(x: number, y: number, z: number): GAElement {
    const p = new PGA3D().nVector(1, 1, x, y, z).Dual;
    // console.debug("Make point", PGA3D.describe())
    // console.debug(`3D point (${x},${y},${z})`, p.toString(), p);
    return p;
  }

  function makeDirection(dx: number, dy: number, dz: number): GAElement {
    const p = new PGA3D().nVector(1, 0, dx, dy, dz).Dual;
    // console.debug(`3D direction (${dx},${dy},${dz})`, p.toString(), p);
    return p;
  }

  function makeRotor(
    axis: GAElement,
    angleInRadiansOrDistance: number
  ): GAElement {
    const out = PGA3D.Mul(angleInRadiansOrDistance / 2, axis).Exp();
    // console.debug("Incoming axis", axis, out)
    return out;
  }

  function makePlane(
    nx: number,
    ny: number,
    nz: number,
    distanceToOrig: number
  ): GAElement {
    const p = new PGA3D().nVector(1, distanceToOrig, nx, ny, nz);
    // console.debug(
    //   `Plane ${nx}x + ${ny}y + ${nz}x + ${distanceToOrig} ==> `,
    //   p.toString()
    // );
    return p;
  }
  
  function parsePGAPoint(text: string, pointEl: GAElement) {
    const px = -pointEl.e023;
    const py = pointEl.e013;
    const pz = -pointEl.e012;
    console.debug(
      text,
      `a point at (${px.toFixed(2)},${py.toFixed(2)},${pz.toFixed(2)})`,
      "Raw point",
      pointEl.toString()
    );
  }

  function isIdealLine(aLine: GAElement): boolean {
    const dx = aLine.e23;
    const dy = aLine.e13;
    const dz = aLine.e12;
    return Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5 && Math.abs(dz) < 1e-5;
  }

  function parsePGALine(text: string, lineEl: GAElement) {
    // Lines are represented using Plucker 6-dim homogeneous coordinates
    // (moment_x, moment_y, moment_z; dir_x, dir_y, dir_z)
    // such that the moment vector is perpendicular to the direction vector
    // Get the moment of the line
    // console.debug(text, "Raw data", lineEl, lineEl.toString())
    const mx = lineEl.e01;
    const my = lineEl.e02;
    const mz = lineEl.e03;
    const thruPoint = lineEl.Dual.Vee(ORIGIN).Wedge(lineEl);
    if (!isIdealLine(lineEl)) {
      // Get line direction
      const dx = lineEl.e23;
      const dy = lineEl.e13;
      const dz = lineEl.e12;
      console.debug(
        text,
        `A line thru (${-thruPoint.e023.toFixed(2)}, ${thruPoint.e013.toFixed(
          2
        )},${-thruPoint.e012.toFixed(2)})`,
        `with direction [${dx.toFixed(2)}, ${dy.toFixed(2)},${dz.toFixed(2)}]`,
        `with moment [${mx.toFixed(2)}, ${my.toFixed(2)},${mz.toFixed(2)}]`
      );
    } else {
      console.debug(
        text,
        `An ideal line with moment [${mx.toFixed(2)}, ${my.toFixed(
          2
        )},${mz.toFixed(2)}]`
      );
    }
  }

  function parsePGAPlane(text: string, elem: GAElement) {
    console.debug(
      `${text} a plane with normal (${elem.e1.toFixed(2)},${elem.e2.toFixed(
        2
      )},${elem.e3.toFixed(2)}) distance to origin ${elem.e0.toFixed(2)}`
    );
  }

  return {
    makePoint,
    makeDirection,
    makePlane,
    makeRotor,
    makeScalar,
    parsePGALine,
    parsePGAPlane,
    parsePGAPoint,
    isIdealLine
  };
}
