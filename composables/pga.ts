import Algebra from "ganja.js";
import { Mesh, MeshBasicMaterial, Plane, PlaneHelper, Scene, SphereGeometry, Vector3 } from "three";
const PGA2D = Algebra(2, 0, 1);
const PGA3D = Algebra({ p: 3, q: 0, r: 1, graded: true });
// console.debug("In composable", PGA3D.describe());
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
  function makePoint(x: number, y: number, z: number) {
    const p = new PGA3D();
    p.nVector(3, -z, y, -x, 1).Dual;
    console.debug(`3D point (${x},${y},${z})`, p.toString(), p);
    return p;
  }

  function makePlane(
    nx: number,
    ny: number,
    nz: number,
    distanceToOrig: number
  ) {
    const p = new PGA3D();
    p.nVector(1, distanceToOrig, nx, ny, nz);
    console.debug(
      `Plane ${nx}x + ${ny}y + ${nz}x + ${distanceToOrig} ==> `,
      p.toString()
    );
    return p;
  }

  function render(scene: Scene, elem: typeof PGA3D) {
    
    let k = 0;
    while (k < elem.length) {
      if (elem[k]) break;
      else k++;
    }
    // The incoming parameter is a JS Sparse Array and may contain 'empty' elements.
    // We will replace these 'empty' elements with zeros
    const elems = [...elem[k]].map((v:any) => typeof(v) === 'number' ? v : 0)
    console.debug("rendering input", elem[k], "Sanitized rendering input", elems)
    switch (k) {
      case 0:
        console.debug("Rendering scalar", elems);
        break;
      case 1:
        const normal = elems.slice(1,4)
        while (normal.length < 3)
          normal.push(0)
        console.debug("Rendering a plane with normal", normal, "distance", elems[0]);
        const plane = new Plane(new Vector3(normal[0], normal[1], normal[2]), elems[0])
        // plane.translate(new Vector3(WHEEL_BASE/2,0,WHEEL_RADIUS))
        const planeHelper = new PlaneHelper(plane, 20, 0xff0000)
        // const steeringPlaneMat = new MeshStandardMaterial({ color: 0x00ff00 })
        scene.add(planeHelper)
      
        break;
      case 2:
        const direction = elems.slice(3, 7)
        // When the sparse array contains "empty" elements, 
        // we may not get enough values. Pad with zeros
        while (direction.length < 3)
          direction.push(0)
        const thruPoint = elems.slice(0, 3)
        console.debug("Rendering a line", elem.toString(), "thru", thruPoint, "dir", direction.reverse());
        break;
      case 3:
        const px = -elems[2]
        const py = elems[1]
        const pz = -elems[0]
        const pw = elems[3]
        console.debug(pw ? "Rendering a point " : "Rendering a direction", elems, elem.toString(),
          `==> (${px.toFixed(2)},${py.toFixed(2)},${pz.toFixed(2)})`);
        const pGeo = new SphereGeometry(2, 20, 20)
        const pMat = new MeshBasicMaterial({ color: 0xFFFF00 })
        const pMesh = new Mesh(pGeo, pMat)
        pMesh.position.set(px,py,pz)
        scene.add(pMesh)
        break;
      case 4:
        console.debug("Rendering superscalar", elems);
        break;
    }
  }

  function makeDirection(dx: number, dy: number, dz: number) {
    const p = new PGA3D();
    p.nVector(3, -dz, dy, -dx, 0);
    console.debug(`3D direction (${dx},${dy},${dz})`, p.toString(), p);
    return p;
  }

  return { makePoint, makeDirection, makePlane, render };
}
