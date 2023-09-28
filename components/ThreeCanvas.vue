import { TextureLoader } from 'three';
<template>
  <canvas ref="glcanvas" id="glcanvas" />
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
import { usePGAStore } from "~/store/pga-store";
import { storeToRefs } from "pinia";
const glcanvas: Ref<HTMLCanvasElement | null> = ref(null);
const PGAStore = usePGAStore();
let camera: PerspectiveCamera;
const textureLoader = new TextureLoader();
const scene = new Scene();
scene.add(new AxesHelper(12));
scene.add(new AmbientLight());
// scene.background = new Color("skyblue");
let animationFrameHandle: number | null = null;
let { driveWheelSpeed, steerAngle } = storeToRefs(PGAStore);
let speedFlipFactor = 1;
const tireSpeedRadsPerSecond = computed(
  () => (Math.PI * driveWheelSpeed.value) / 30
);
let tireAngle = 0;
let tirePosition = 0;
let previousTimeStamp = 0;

let renderer: WebGLRenderer;
let bike: Group
let driveWheel: Group
let steeringWheel:Group
onMounted(async () => {
  const marbleTexture = await textureLoader.loadAsync("marble.jpg");
  console.debug("Texture", marbleTexture);
  const groundPlane = new PlaneGeometry(1000, 1000, 100, 100);
  const groundMaterial = new MeshBasicMaterial({
    map: marbleTexture,
  });
  const ground = new Mesh(groundPlane, groundMaterial);
  // ground.add(new AxesHelper(6))
  ground.rotateX(0);
  scene.add(ground);
  // console.debug("Canvas at", glcanvas.value);
  const canvasHeight = glcanvas.value!.clientHeight;
  const canvasWidth = glcanvas.value!.clientWidth;
  camera = new PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 1000);
  camera.position.set(100, 100, 80);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);
  bike = makeBike();
  bike.add(camera);
  scene.add(bike);
  renderer = new WebGLRenderer({
    canvas: glcanvas.value!,
    antialias: true,
  });
  renderer.setSize(
    glcanvas.value?.clientWidth ?? 800,
    glcanvas.value?.clientHeight ?? 600
  );

  renderer.setClearColor(0xffff00, 1);
  // if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
  updateGraphics(0);
});

onBeforeUnmount(() => {
  if (animationFrameHandle != null) cancelAnimationFrame(animationFrameHandle);
});

function run_integrator(timeStamp: number /* in milliseconds */) {
  const elapsed = (timeStamp - previousTimeStamp) / 1000;
  tireAngle =
    tireAngle + speedFlipFactor * tireSpeedRadsPerSecond.value * elapsed;
  tirePosition = -tireAngle * 29;
  // console.log("Tirepos", tirePosition)
  if (Math.abs(tirePosition) > 500) {
    speedFlipFactor *= -1;
  }
  previousTimeStamp = timeStamp;
}
function updateGraphics(timeStamp: number) {
  run_integrator(timeStamp);
  driveWheel.rotation.z = tireAngle
  driveWheel.rotation.y = -steerAngle.value * Math.PI/180
  steeringWheel.rotation.z = tireAngle
  bike.position.x = tirePosition;
  renderer.render(scene, camera);
  animationFrameHandle = requestAnimationFrame((t) => updateGraphics(t));
}
// import Algebra from 'ts-geometric-algebra';

// const Complex = Algebra(0, 1)
// const a = new Complex([3, 2])
// const b = new Complex([-3,5])
// console.log("Is this a complex number", a, b)
// console.log("I'm here")

function makeBike(): Group {
  const WHEEL_BASE = 48 // inches
  const bikeFrame = new Group();
  bikeFrame.add(new AxesHelper(24))
  driveWheel = makeTire(13, 1.5);
  driveWheel.translateX(-WHEEL_BASE/2)
  steeringWheel = makeTire(13, 1.5)
  steeringWheel.translateX(WHEEL_BASE / 2)  
  bikeFrame.add(driveWheel);
  bikeFrame.add(steeringWheel)
  return bikeFrame;
}
function makeTire(tireRadius: number, tubeRadius: number): Group {
  const NUM_SPOKES = 6;
  const tireGroup = new Group();
  tireGroup.translateZ(tubeRadius + tireRadius);
  tireGroup.rotateX(Math.PI / 2);
  // tireGroup.add(new AxesHelper(10))
  const torusGeometry = new TorusGeometry(tireRadius, tubeRadius, 10);
  const torusMaterial = new MeshBasicMaterial({ color: "black" });
  const tire = new Mesh(torusGeometry, torusMaterial);
  tireGroup.add(tire);
  const translation = new Matrix4().makeTranslation(0, tireRadius / 2, 0);
  const rotation = new Matrix4();
  for (let k = 0; k < NUM_SPOKES; k++) {
    const cylinderGeometry = new CylinderGeometry(0.6 * tubeRadius, 0.6 * tubeRadius, tireRadius);
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
