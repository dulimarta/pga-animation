
import { TextureLoader } from 'three';
<template>
  <canvas ref="glcanvas" id="glcanvas"/>
</template>
<script setup lang="ts">
import {
  Color,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  TorusGeometry,
  Group,
  CylinderGeometry,
  Matrix4,
  AxesHelper,
  PlaneGeometry,
  TextureLoader,
  AmbientLight,
} from "three";
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
let camera: PerspectiveCamera;
const textureLoader = new TextureLoader();
const scene = new Scene();
scene.add(new AmbientLight());
scene.background = new Color("skyblue");
let animationFrameHandle: number | null = null;

const geometry = new BoxGeometry(2, 2, 2);
const material = new MeshBasicMaterial({ color: "#433F81" });
const cube = new Mesh(geometry, material);

scene.add(makeTire(26, 3));
let renderer: WebGLRenderer;
onMounted(async () => {
  const marbleTexture = await textureLoader.loadAsync("marble.jpg");
  console.debug("Texture", marbleTexture);
  const groundPlane = new PlaneGeometry(500, 500);
  const groundMaterial = new MeshBasicMaterial({
    map: marbleTexture,
  });
  const ground = new Mesh(groundPlane, groundMaterial);
  ground.rotateX(-Math.PI / 2);
  scene.add(ground);
  console.debug("Canvas at", glcanvas.value);
  const canvasHeight = glcanvas.value!.clientHeight;
  const canvasWidth = glcanvas.value!.clientWidth;
  camera = new PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 1000);
  camera.position.set(0, 65, 120);
  camera.lookAt(0, 0, 0);
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.setSize(
    glcanvas.value?.clientWidth ?? 800,
    glcanvas.value?.clientHeight ?? 600
  );

  renderer.setClearColor(0xffff00, 1);
  updateGraphics();
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});
function updateGraphics() {
  renderer.render(scene, camera);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  animationFrameHandle = requestAnimationFrame(() => updateGraphics());
}
// import Algebra from 'ts-geometric-algebra';

// const Complex = Algebra(0, 1)
// const a = new Complex([3, 2])
// const b = new Complex([-3,5])
// console.log("Is this a complex number", a, b)
// console.log("I'm here")

function makeTire(tireRadius: number, tubeRadius: number): Group {
  const NUM_SPOKES = 6;
  const tireGroup = new Group();
  tireGroup.translateY(tubeRadius + tireRadius);
  // tireGroup.add(new AxesHelper(10))
  const torusGeometry = new TorusGeometry(tireRadius, tubeRadius, 10);
  const torusMaterial = new MeshBasicMaterial({ color: "black" });
  const tire = new Mesh(torusGeometry, torusMaterial);
  tireGroup.add(tire);
  const translation = new Matrix4().makeTranslation(0, tireRadius / 2, 0);
  const rotation = new Matrix4();
  for (let k = 0; k < NUM_SPOKES; k++) {
    const cylinderGeometry = new CylinderGeometry(1, 1, tireRadius);
    const cylinderMaterial = new MeshBasicMaterial({ color: "grey" });
    const cylinder = new Mesh(cylinderGeometry, cylinderMaterial);
    rotation.makeRotationZ((k * 2 * Math.PI) / NUM_SPOKES);
    cylinder.applyMatrix4(translation);
    cylinder.applyMatrix4(rotation);
    tireGroup.add(cylinder);
  }
  return tireGroup;
}
</script>
<style lang="scss">
#glcanvas {
  width: 800px;
  height: 600px;
  // background-color: red;
  border: 2px solid red;
}
</style>