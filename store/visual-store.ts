import { defineStore } from "pinia";
import {
  Group,
  Mesh,
  Vector3,
  CylinderGeometry,
  MeshPhongMaterial,
  SphereGeometry,
  TorusGeometry,
  Matrix4,
  Scene,
  Camera,
} from "three";

export const useVisualStore = defineStore("visual", () => {
  function makePipe(
    pipeLength: number,
    pipeRadius: number,
    color?: string
  ): Mesh {
    const cylinderGeometry = new CylinderGeometry(
      pipeRadius,
      pipeRadius,
      pipeLength
    );
    const cylinderMaterial = new MeshPhongMaterial({ color: color ?? "grey" });
    const mesh = new Mesh(cylinderGeometry, cylinderMaterial);
    mesh.castShadow = true;
    // mesh.add(new AxesHelper(12))
    return mesh;
  }
  function makeSphere(radius: number, color?: string): Mesh {
    const sphereGeo = new SphereGeometry(radius, 20, 10);
    const sphereMat = new MeshPhongMaterial({ color: color ?? "grey" });
    return new Mesh(sphereGeo, sphereMat);
  }

  function makeCone(baseRadius: number, height: number, color?: string): Mesh {
    return new Mesh(
      new CylinderGeometry(0, baseRadius, height, 20),
      new MeshPhongMaterial({
        color: color ?? "white",
      })
    );
  }
  function makeTire(tireRadius: number, tubeRadius: number): Group {
    const NUM_SPOKES = 6;
    const tireGroup = new Group();
    tireGroup.translateZ(tubeRadius + tireRadius);
    tireGroup.rotateX(Math.PI / 2);
    // tireGroup.add(new AxesHelper(10))
    const torusGeometry = new TorusGeometry(tireRadius, tubeRadius, 10);
    const torusMaterial = new MeshPhongMaterial({ color: 0x555555 });
    const tire = new Mesh(torusGeometry, torusMaterial);
    tire.castShadow = true;
    tireGroup.add(tire);
    const translation = new Matrix4().makeTranslation(0, tireRadius / 2, 0);
    const rotation = new Matrix4();
    for (let k = 0; k < NUM_SPOKES; k++) {
      const spoke = makePipe(
        tireRadius,
        0.6 * tubeRadius,
        k === 0 ? "lightgreen" : "white"
      );
      rotation.makeRotationZ((k * 2 * Math.PI) / NUM_SPOKES);
      spoke.applyMatrix4(translation);
      spoke.applyMatrix4(rotation);
      tireGroup.add(spoke);
    }
    return tireGroup;
  }
  function makeArrow(length: number, thickness: number, color: string): Group {
    // const ARROW_LENGTH = 30
    const g = new Group();
    // g.add(new AxesHelper(length * 1.5))
    const arrowBody = makePipe(length, thickness, color);
    arrowBody.rotateZ(-Math.PI/2)
    arrowBody.translateY(length / 2);
    g.add(arrowBody);
    const arrowHead = makeCone(2 * thickness, 0.1 * length, color);
    arrowHead.rotateZ(-Math.PI/2)
    arrowHead.translateY(length);
    g.add(arrowHead);
    return g;
  }
  // const initialMarker: Ref<Group> = ref(makeArrow())
  const visualScene: Ref<Scene | null> = ref(null);
  const visualCamera: Ref<Camera | null> = ref(null);
  const mousePositionOnGround = ref(new Vector3());
  const mouseWheelScrollAmount = ref(0);
  return {
    makePipe,
    makeSphere,
    makeTire,
    visualScene,
    makeArrow,
    visualCamera,
    mousePositionOnGround,
    mouseWheelScrollAmount,
  };
});
