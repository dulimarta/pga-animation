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
const PGA2D = Algebra(2, 0, 1);
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: false });
// console.debug("In composable", PGA3D);
interface GAElement {
  Vee(_: GAElement): GAElement;
}

export function usePGA2D() {
  function makePoint(x: number, y: number): GAElement {
    // const p = new PGA2D([0, 0, 0, 0, y, -x, 1])
    // console.debug("Using arg", p.toString())
    const p = new PGA2D();

    p.nVector(2, y, -x, 1);
    // console.debug(`Point (${x},${y}) => `, p.toString(), p)
    return p;
  }
  return { makePoint };
}

export function usePGA3D() {
  const ORIGIN = makePoint(0, 0, 0);

  function makePoint(x: number, y: number, z: number) {
    const p = new PGA3D().nVector(1, 1, x, y, z).Dual;
    // console.debug("Make point", PGA3D.describe())
    // console.debug(`3D point (${x},${y},${z})`, p.toString(), p);
    return p;
  }

  function makeDirection(dx: number, dy: number, dz: number) {
    const p = new PGA3D().nVector(1, 0, dx, dy, dz).Dual;
    // console.debug(`3D direction (${dx},${dy},${dz})`, p.toString(), p);
    return p;
  }

  function makeRotor(axis: any, angleInRadiansOrDistance: number): any {
    const out = PGA3D.Mul(angleInRadiansOrDistance / 2, axis).Exp();
    // console.debug("Incoming axis", axis, out)
    return out;
  }

  function makePlane(
    nx: number,
    ny: number,
    nz: number,
    distanceToOrig: number
  ) {
    const p = new PGA3D().nVector(1, distanceToOrig, nx, ny, nz);
    // console.debug(
    //   `Plane ${nx}x + ${ny}y + ${nz}x + ${distanceToOrig} ==> `,
    //   p.toString()
    // );
    return p;
  }
  function parsePGAPoint(text: string, pointEl: any) {
    const px = -pointEl.e023
    const py = pointEl.e013
    const pz = -pointEl.e012
    console.debug(text, `a point at (${px.toFixed(2)},${py.toFixed(2)},${pz.toFixed(2)})`, "Raw point", pointEl.toString())    
  }

  function parsePGALine(text: string, lineEl: any) {
    // Lines are represented using Plucker 6-dim homogeneous coordinates
    // (moment_x, moment_y, moment_z; dir_x, dir_y, dir_z)
    // such that the moment vector is perpendicular to the direction vector
    // Get the moment of the line
    // console.debug(text, "Raw data", lineEl, lineEl.toString())
    const mx = lineEl.e01;
    const my = lineEl.e02;
    const mz = lineEl.e03;
    // Get line direction
    const dx = lineEl.e23;
    const dy = lineEl.e13;
    const dz = lineEl.e12;
    // P = lineEl.Dua.Vee(ORIGIN) is the plane thru the origin and perpendicular to the line
    // P.Wedge(lineEl)            is the  intersection of the plane with the line
    const thruPoint = lineEl.Dual.Vee(ORIGIN).Wedge(lineEl);
    if (Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5 || Math.abs(dz) > 1e-5) {
      console.debug(
        text,
        `A line thru (${-thruPoint.e023.toFixed(2)}, ${thruPoint.e013.toFixed(
          2
        )},${-thruPoint.e012.toFixed(2)})`,
        `with direction [${dx.toFixed(2)}, ${dy.toFixed(2)},${dz.toFixed(2)}]`,
        `with moment [${mx.toFixed(2)}, ${my.toFixed(2)},${mz.toFixed(2)}]`
      );
    } else {
      console.debug(text, 
        `An ideal line with moment [${mx.toFixed(2)}, ${my.toFixed(
          2
        )},${mz.toFixed(2)}]`
      );
    }
  }

  function parsePGAPlane(text: string, elem: any) {
    console.debug(
      `${text} a plane with normal (${elem[2].toFixed(2)},${elem[3].toFixed(
        2
      )},${elem[4].toFixed(2)}) distance to origin ${elem[1].toFixed(2)}`
    );
  }

  function isProperLine(elem: any): boolean {
    const thru_x = elem[10];
    const thru_y = -elem[9];
    const thru_z = elem[8];
    return (
      Math.abs(thru_x) > 1e-5 ||
      Math.abs(thru_y) > 1e-5 ||
      Math.abs(thru_z) > 1e-5
    );
  }

  function render(scene: Scene, elem: typeof PGA3D) {
    console.debug("Rendering input", elem, elem.toString());
  }

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
        break;
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

  return { makePoint, makeDirection, makePlane, makeRotor, parsePGALine, parsePGAPlane, parsePGAPoint };
}
