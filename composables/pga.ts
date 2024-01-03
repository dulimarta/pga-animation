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

  // function isProperLine(elem: GAElement): boolean {
  //   const thru_x = elem[10];
  //   const thru_y = -elem[9];
  //   const thru_z = elem[8];
  //   return (
  //     Math.abs(thru_x) > 1e-5 ||
  //     Math.abs(thru_y) > 1e-5 ||
  //     Math.abs(thru_z) > 1e-5
  //   );
  // }

  function gradedRender(scene: Scene, elem: typeof PGA3D) {
    // When the Algebra is graded, multivectors are stored in different
    // sparse arrays based on their grade
    let k = 0;
    while (k < elem.length) {
      if (elem[k]) break;
      else k++;
    }
    // The incoming parameter is a JS Sparse Array and may contain 'empty' elements.
    // We will replace these 'empty' elements with zeros
    const elems = [...elem[k]].map((v: any) => (typeof v === "number" ? v : 0));
    console.debug(
      "rendering input",
      elem[k],
      "Sanitized rendering input",
      elems
    );
    switch (k) {
      case 0:
        console.debug("Rendering scalar", elems);
        break;
      case 1: // Plane
        const normal = elems.slice(1, 4);
        while (normal.length < 3) normal.push(0);
        console.debug(
          "Rendering a plane with normal",
          normal,
          "distance",
          elems[0]
        );
        const plane = new Plane(
          new Vector3(normal[0], normal[1], normal[2]),
          elems[0]
        );
        // plane.translate(new Vector3(WHEEL_BASE/2,0,WHEEL_RADIUS))
        const planeHelper = new PlaneHelper(plane, 20, 0xff0000);
        // const steeringPlaneMat = new MeshStandardMaterial({ color: 0x00ff00 })
        scene.add(planeHelper);
        return planeHelper;
      case 2: // Line
        const direction = elems.slice(3, 7);
        // When the sparse array contains "empty" elements,
        // we may not get enough values. Pad with zeros
        while (direction.length < 3) direction.push(0);
        const thruPoint = elems.slice(0, 3);
        console.debug(
          "Rendering a line",
          elem.toString(),
          "thru",
          thruPoint,
          "dir",
          direction.reverse()
        );
        break;
      case 3: // Point (Euclidean or Ideal)
        const px = -elems[2];
        const py = elems[1];
        const pz = -elems[0];
        const pw = elems[3];
        if (Math.abs(pw) > 1e-5) {
          console.debug(
            "Rendering a point ",
            elems,
            elem.toString(),
            `==> (${px.toFixed(2)},${py.toFixed(2)},${pz.toFixed(2)})`
          );
          const pGeo = new SphereGeometry(2, 20, 20);
          const pMat = new MeshBasicMaterial({ color: 0xffff00 });
          const pMesh = new Mesh(pGeo, pMat);
          pMesh.position.set(px, py, pz);
          scene.add(pMesh);
        } else {
          console.error("Directions are not rendered");
        }
        break;
      case 4:
        console.debug("Rendering superscalar", elems);
        break;
    }
  }

  return {
    makePoint,
    makeDirection,
    makePlane,
    makeRotor,
    parsePGALine,
    parsePGAPlane,
    parsePGAPoint,
    isIdealLine
  };
}
